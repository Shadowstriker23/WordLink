import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { lookupWord } from "@/lib/dict";
import { getOrCreateReview } from "@/lib/fsrs";
import type { WordModel } from "@/generated/prisma/models";
import type { TagType } from "@/generated/prisma/enums";

async function upsertTag(
  name: string,
  type: "ROOT" | "AFFIX" | "MEANING" | "GRAMMAR" | "CUSTOM",
  description?: string
) {
  return prisma.tag.upsert({
    where: { name_type: { name, type } },
    update: { description: description || undefined },
    create: { name, type, description: description || undefined },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const wordText = (body.word ?? "").trim().toLowerCase();
  const aiEnrich = Boolean(body.aiEnrich);

  if (!wordText) {
    return NextResponse.json({ error: "缺少 word" }, { status: 400 });
  }

  const dict = lookupWord(wordText);
  if (!dict) {
    return NextResponse.json({ error: "词典中未找到该单词" }, { status: 404 });
  }

  const existing = await prisma.word.findUnique({ where: { text: wordText } });

  // 生成标签：词性 + 意思 + 考试范围
  const tagIds: string[] = [];
  const posTags = new Set<string>();
  const meaningTags = new Set<string>();

  for (const m of dict.meanings) {
    if (m.pos) posTags.add(m.pos);
    for (const meaning of m.meanings) {
      const clean = meaning.replace(/^[a-zA-Z]+\s*[.:]\s*/, "").trim();
      if (clean) meaningTags.add(clean);
    }
  }

  for (const p of posTags) {
    const tag = await upsertTag(p, "GRAMMAR");
    tagIds.push(tag.id);
  }
  for (const meaning of meaningTags) {
    const tag = await upsertTag(`意思:${meaning}`, "MEANING");
    tagIds.push(tag.id);
  }

  const firstPos = dict.meanings[0];
  const meaning = firstPos
    ? `${firstPos.pos ? firstPos.pos + " " : ""}${firstPos.meanings.slice(0, 2).join("；")}`
    : dict.translation?.split("\n")[0] ?? "";

  let word: WordModel;
  if (existing) {
    word = await prisma.word.update({
      where: { id: existing.id },
      data: {
        meaning: existing.meaning || meaning,
        pronunciation: existing.pronunciation ?? dict.phonetic,
        exampleSentence: existing.exampleSentence ?? dict.example,
      },
    });
    const existingTagIds = new Set(
      (await prisma.wordTag.findMany({ where: { wordId: word.id } })).map((wt) => wt.tagId)
    );
    await prisma.wordTag.createMany({
      data: tagIds.filter((id) => !existingTagIds.has(id)).map((tagId) => ({ wordId: word.id, tagId })),
    });
  } else {
    word = await prisma.word.create({
      data: {
        text: wordText,
        meaning,
        pronunciation: dict.phonetic,
        exampleSentence: dict.example,
        source: "MANUAL",
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
    });
  }

  await getOrCreateReview(word.id);

  let aiTags: { name: string; type: string; description?: string }[] = [];
  if (aiEnrich) {
    try {
      const { analyzeWords } = await import("@/lib/ai");
      const analysis = await analyzeWords({ words: [wordText], existingWords: [] });
      const item = analysis.words[0];
      aiTags = item.tags ?? [];
      for (const t of aiTags) {
        const tag = await upsertTag(t.name, t.type as TagType, t.description);
        const has = await prisma.wordTag.findFirst({
          where: { wordId: word.id, tagId: tag.id },
        });
        if (!has) await prisma.wordTag.create({ data: { wordId: word.id, tagId: tag.id } });
      }
    } catch {
      /* AI 增强失败不影响导入 */
    }
  }

  return NextResponse.json({
    word: {
      id: word.id,
      text: word.text,
      meaning: word.meaning,
      tags: tagIds,
      aiTags,
      imported: !existing,
    },
  });
}
