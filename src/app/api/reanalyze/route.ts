import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { lookupWord, parseTranslation } from "@/lib/dict";

async function upsertTag(
  name: string,
  type: "ROOT" | "AFFIX" | "MEANING" | "GRAMMAR" | "CUSTOM"
) {
  const existing = await prisma.tag.findUnique({
    where: { name_type: { name, type } },
  });
  if (existing) return existing;
  return prisma.tag.create({ data: { name, type } });
}

export async function POST(req: NextRequest) {
  const words = await prisma.word.findMany({
    include: { tags: { include: { tag: true } } },
  });

  let posAdded = 0;
  let meaningAdded = 0;
  let cleaned = 0;

  for (const word of words) {
    const dict = await lookupWord(word.text);
    if (!dict) continue;

    const existingTagIds = new Set(word.tags.map((wt) => wt.tagId));

    // 补充词性标签（如 n. / adj.）
    for (const m of parseTranslation(dict.translation)) {
      if (m.pos) {
        const tag = await upsertTag(m.pos, "GRAMMAR");
        if (!existingTagIds.has(tag.id)) {
          await prisma.wordTag.create({ data: { wordId: word.id, tagId: tag.id } });
          posAdded++;
        }
      }
    }

    // 补充意思标签（仅在字典分词性释义中）
    for (const m of dict.meanings ?? []) {
      for (const meaning of m.meanings) {
        if (meaning.length > 60) continue;
        const name = `意思:${meaning}`;
        const tag = await upsertTag(name, "MEANING");
        if (!existingTagIds.has(tag.id)) {
          await prisma.wordTag.create({ data: { wordId: word.id, tagId: tag.id } });
          meaningAdded++;
        }
      }
    }

    // 清理不带"意思:"前缀的裸 MEANING 标签 + 考试标签
    const staleMeaningIds = word.tags
      .filter(
        (wt) =>
          wt.tag.type === "MEANING" && !wt.tag.name.startsWith("意思:")
      )
      .map((wt) => wt.tagId);
    const examTags = ["中考", "高考", "四级", "六级", "考研", "托福", "雅思", "GRE", "SAT"];
    const staleExamIds = word.tags
      .filter((wt) => wt.tag.type === "CUSTOM" && examTags.includes(wt.tag.name))
      .map((wt) => wt.tagId);

    for (const tid of [...staleMeaningIds, ...staleExamIds]) {
      await prisma.wordTag.deleteMany({ where: { wordId: word.id, tagId: tid } });
      cleaned++;
    }
    for (const tid of staleMeaningIds) {
      const refs = await prisma.wordTag.count({ where: { tagId: tid } });
      if (refs === 0) await prisma.tag.deleteMany({ where: { id: tid } });
    }
  }

  return NextResponse.json({
    words: words.length,
    posAdded,
    meaningAdded,
    cleaned,
  });
}
