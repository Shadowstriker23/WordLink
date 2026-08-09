import { NextRequest, NextResponse } from "next/server";
import { analyzeWords } from "@/lib/ai";
import { prisma } from "@/lib/db";
import { getOrCreateReview } from "@/lib/fsrs";
import { lookupWord, parseTranslation } from "@/lib/dict";

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
  const words: string[] = (body.words ?? [])
    .map((w: unknown) => String(w).trim())
    .filter(Boolean);

  if (!words.length) {
    return NextResponse.json({ error: "请输入要分析的单词" }, { status: 400 });
  }

  try {
    const existingWords = await prisma.word.findMany({
      select: { text: true },
    });
    const existingSet = new Set(
      existingWords.map((w) => w.text.toLowerCase())
    );
    const newWords = words.filter((w) => !existingSet.has(w.toLowerCase()));

    const analysis = await analyzeWords({
      words: newWords,
      existingWords: [...existingSet],
    });

    const results = [];

    for (const item of analysis.words) {
      const text = item.word.toLowerCase().trim();

      let word = await prisma.word.findUnique({ where: { text } });

      const tags = [];
      for (const tag of item.tags ?? []) {
        const saved = await prisma.tag.upsert({
          where: { name_type: { name: tag.name, type: tag.type } },
          update: { description: tag.description || undefined },
          create: {
            name: tag.name,
            type: tag.type,
            description: tag.description || undefined,
          },
        });
        tags.push(saved);
      }

      // 补充词典词性标签（如 n. / adj. / vt.）
      const dict = lookupWord(text);
      if (dict) {
        const posSet = new Set<string>();
        for (const m of parseTranslation(dict.translation)) {
          if (m.pos) posSet.add(m.pos);
        }
        for (const p of posSet) {
          const tag = await upsertTag(p, "GRAMMAR");
          tags.push(tag);
        }
      }

      if (!word) {
        word = await prisma.word.create({
          data: {
            text,
            meaning: item.meaning,
            pronunciation: item.pronunciation,
            exampleSentence: item.exampleSentence,
            tags: { create: tags.map((t) => ({ tagId: t.id })) },
          },
        });
      } else {
        const wordId = word.id;
        const existingTagIds = new Set(
          (await prisma.wordTag.findMany({ where: { wordId } })).map(
            (wt) => wt.tagId
          )
        );
        await prisma.wordTag.createMany({
          data: tags
            .filter((t) => !existingTagIds.has(t.id))
            .map((t) => ({ wordId, tagId: t.id })),
        });
      }

      await getOrCreateReview(word.id);

      for (const rel of item.relationships ?? []) {
        const target = await prisma.word.findUnique({
          where: { text: rel.word.toLowerCase().trim() },
        });
        if (!target || target.id === word.id) continue;

        const exists = await prisma.relationship.findFirst({
          where: {
            sourceWordId: word.id,
            targetWordId: target.id,
            type: rel.type,
          },
        });
        if (!exists) {
          await prisma.relationship.create({
            data: {
              sourceWordId: word.id,
              targetWordId: target.id,
              type: rel.type,
              description: rel.description,
            },
          });
        }
      }

      results.push({
        id: word.id,
        text: word.text,
        meaning: word.meaning,
        tags: tags.map((t) => ({ name: t.name, type: t.type })),
      });
    }

    return NextResponse.json({ words: results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "处理失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
