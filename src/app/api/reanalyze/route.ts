import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { analyzeWords } from "@/lib/ai";
import { lookupWord, parseTranslation, lookupLemma } from "@/lib/dict";

// 每批最多发给 AI 的单词数
const AI_BATCH = 10;

async function upsertTag(
  name: string,
  type: "ROOT" | "AFFIX" | "MEANING" | "GRAMMAR" | "CUSTOM",
  description?: string
) {
  const existing = await prisma.tag.findUnique({
    where: { name_type: { name, type } },
  });
  if (existing) {
    if (description && !existing.description) {
      await prisma.tag.update({ where: { id: existing.id }, data: { description } });
    }
    return existing;
  }
  return prisma.tag.create({ data: { name, type, description: description || undefined } });
}

// ── 步骤 1：清理脏标签 ──────────────────────────────
async function cleanTags() {
  let removed = 0;

  // 1a. 去掉不带"意思:"前缀的裸 MEANING 标签
  const bareMeaningTags = await prisma.tag.findMany({
    where: { type: "MEANING", name: { not: { startsWith: "意思:" } } },
  });
  for (const tag of bareMeaningTags) {
    await prisma.wordTag.deleteMany({ where: { tagId: tag.id } });
    await prisma.tag.deleteMany({ where: { id: tag.id } });
    removed++;
  }

  // 1b. 去掉考试相关 CUSTOM 标签
  const examNames = ["中考","高考","四级","六级","考研","托福","雅思","GRE","SAT"];
  const examTags = await prisma.tag.findMany({
    where: { type: "CUSTOM", name: { in: examNames } },
  });
  for (const tag of examTags) {
    await prisma.wordTag.deleteMany({ where: { tagId: tag.id } });
    await prisma.tag.deleteMany({ where: { id: tag.id } });
    removed++;
  }

  return removed;
}

// ── 步骤 2：AI + 词典补全 ──────────────────────────
async function enrich(words: { id: string; text: string }[]) {
  let enriched = 0;
  let dictEnriched = 0;

  // 词形还原 → AI 分析
  const lemmaMap = new Map<string, string>();
  const resolved: string[] = [];
  for (const w of words) {
    const lemma = await lookupLemma(w.text);
    if (lemma) {
      lemmaMap.set(w.text, lemma.base);
      resolved.push(lemma.base);
    } else {
      resolved.push(w.text);
    }
  }

  const unique = [...new Set(resolved)];

  // 批量 AI 分析
  const allExisting = await prisma.word.findMany({ select: { text: true } });
  const existingSet = new Set(allExisting.map((w) => w.text.toLowerCase()));

  for (let i = 0; i < unique.length; i += AI_BATCH) {
    const batch = unique.slice(i, i + AI_BATCH);
    let analysis;
    try {
      analysis = await analyzeWords({ words: batch, existingWords: [...existingSet] });
    } catch {
      continue; // AI 失败跳过这批
    }

    for (const item of analysis.words) {
      const matchWord = words.find(
        (w) => w.text.toLowerCase() === item.word.toLowerCase() ||
               (lemmaMap.has(w.text) && lemmaMap.get(w.text) === item.word.toLowerCase())
      );
      if (!matchWord) continue;

      const existingTagIds = new Set(
        (await prisma.wordTag.findMany({ where: { wordId: matchWord.id } })).map((wt) => wt.tagId)
      );

      for (const tag of item.tags ?? []) {
        let name = tag.name;
        if (tag.type === "MEANING" && !name.startsWith("意思:")) {
          name = `意思:${name}`;
        }
        const saved = await upsertTag(name, tag.type as Parameters<typeof upsertTag>[1], tag.description);
        if (!existingTagIds.has(saved.id)) {
          await prisma.wordTag.create({ data: { wordId: matchWord.id, tagId: saved.id } });
          enriched++;
        }
      }

      // 词典补充 POS + 意思标签
      const dict = await lookupWord(item.word.toLowerCase());
      if (dict) {
        for (const m of parseTranslation(dict.translation)) {
          if (m.pos) {
            const tag = await upsertTag(m.pos, "GRAMMAR");
            if (!existingTagIds.has(tag.id)) {
              await prisma.wordTag.create({ data: { wordId: matchWord.id, tagId: tag.id } });
              dictEnriched++;
            }
          }
          for (const meaning of m.meanings) {
            if (meaning.length > 60) continue;
            const name = `意思:${meaning}`;
            const tag = await upsertTag(name, "MEANING");
            if (!existingTagIds.has(tag.id)) {
              await prisma.wordTag.create({ data: { wordId: matchWord.id, tagId: tag.id } });
              dictEnriched++;
            }
          }
        }
      }
    }
  }

  return { enriched, dictEnriched };
}

export async function POST(req: NextRequest) {
  const words = await prisma.word.findMany({ select: { id: true, text: true } });
  if (!words.length) return NextResponse.json({ error: "词库为空" }, { status: 400 });

  // 1. 清理
  const cleaned = await cleanTags();

  // 2. AI 分析 + 词典补全
  const { enriched, dictEnriched } = await enrich(words);

  return NextResponse.json({
    words: words.length,
    cleaned,
    aiEnriched: enriched,
    dictEnriched,
  });
}
