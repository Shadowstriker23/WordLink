import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  isPosToken,
  searchContains,
  searchByPos,
  searchPrefix,
  type DictSuggestion,
} from "@/lib/dict";

export interface QueryToken {
  isTag: boolean;
  raw: string;
  normalized: string;
}

export function parseQuery(q: string): QueryToken[] {
  return q
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) =>
      t.startsWith("#")
        ? { isTag: true, raw: t, normalized: t.slice(1).toLowerCase() }
        : { isTag: false, raw: t, normalized: t.toLowerCase() }
    );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const tokens = parseQuery(q);

  if (!tokens.length) {
    return NextResponse.json({
      tokens: [],
      tagMatches: [],
      results: [],
      suggestions: [],
      posSuggestions: [],
    });
  }

  const tagTokens = tokens.filter((t) => t.isTag);
  const wordTokens = tokens.filter((t) => !t.isTag);

  // 1. 解析 tag 检索：在 app 库中找匹配的 tag
  const tagMatches: { token: string; tagId: string; name: string; type: string; count: number }[] = [];
  const posDictTokens: string[] = [];

  for (const token of tagTokens) {
    const matched = await prisma.tag.findMany({
      where: {
        name: { contains: token.normalized },
      },
      include: { _count: { select: { words: true } } },
      take: 5,
    });

    if (matched.length) {
      // 取第一个最相关的匹配作为该 token 的 tag
      const best = matched.sort(
        (a, b) => b._count.words - a._count.words
      )[0];
      tagMatches.push({
        token: token.normalized,
        tagId: best.id,
        name: best.name,
        type: best.type,
        count: best._count.words,
      });
    }
    if (isPosToken(token.normalized)) {
      posDictTokens.push(token.normalized);
    }
  }

type WordWithTags = {
  id: string;
  text: string;
  meaning: string;
  pronunciation: string | null;
  createdAt: Date;
  tags: { tag: { name: string; type: string } }[];
  review: { due: Date; state: number } | null;
};

  // 2. 按所有 tag token 做 AND 检索
  let results: WordWithTags[] = [];
  if (tagMatches.length) {
    const andWhere = tagMatches.map((m) => ({
      tags: { some: { tagId: m.tagId } },
    }));
    results = await prisma.word.findMany({
      where: { AND: andWhere },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        tags: { include: { tag: true } },
        review: true,
      },
    }) as unknown as WordWithTags[];
  }

  // 3. 单词 token 检索
  const appWordMatches = wordTokens.length
    ? await prisma.word.findMany({
        where: {
          OR: wordTokens.map((t) => ({
            OR: [
              { text: { contains: t.raw } },
              { meaning: { contains: t.raw } },
            ],
          })),
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { tags: { include: { tag: true } }, review: true },
      })
    : ([] as WordWithTags[]);

  // 合并去重（app 库结果优先）
  const seen = new Set<string>();
  const combined = [];
  for (const w of [...results, ...appWordMatches]) {
    if (seen.has(w.id)) continue;
    seen.add(w.id);
    combined.push(w);
  }
  results = combined.slice(0, 40);

  // 4. 词典建议（不在 app 库中的相似词）
  const dictSet = new Set(results.map((w) => w.text.toLowerCase()));
  const wordTokensOnly = wordTokens.map((t) => t.raw.toLowerCase());
  const primary = wordTokensOnly[0] ?? tagTokens[0]?.normalized;

  let suggestions: DictSuggestion[] = [];
  if (wordTokens.length) {
    const fromPrefix = searchPrefix(primary, 12);
    suggestions = fromPrefix.filter(
      (s) => !dictSet.has(s.word.toLowerCase()) && s.word.toLowerCase() !== primary
    );
  } else if (primary) {
    const fromContains = searchContains(primary, 12);
    suggestions = fromContains.filter((s) => !dictSet.has(s.word.toLowerCase()));
  }

  // 5. 词性检索（#adj. 等）
  let posSuggestions: DictSuggestion[] = [];
  if (posDictTokens.length) {
    for (const p of posDictTokens) {
      const hits = searchByPos(p, 20);
      posSuggestions = [...posSuggestions, ...hits.filter((h) => !dictSet.has(h.word.toLowerCase()))];
    }
    posSuggestions = posSuggestions.slice(0, 30);
  }

  return NextResponse.json({
    tokens,
    tagMatches,
    results: results.map((w) => ({
      id: w.id,
      text: w.text,
      meaning: w.meaning,
      pronunciation: w.pronunciation,
      createdAt: w.createdAt,
      tags: w.tags.map((wt) => ({ name: wt.tag.name, type: wt.tag.type })),
      due: w.review?.due ?? null,
      state: w.review?.state ?? 0,
    })),
    suggestions,
    posSuggestions,
  });
}
