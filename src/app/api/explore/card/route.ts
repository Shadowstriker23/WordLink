import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { lookupWord } from "@/lib/dict";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const word = searchParams.get("word")?.trim();
  if (!word) {
    return NextResponse.json({ error: "缺少 word 参数" }, { status: 400 });
  }

  const dict = lookupWord(word);

  const appWord = await prisma.word.findUnique({
    where: { text: word.toLowerCase().trim() },
    include: {
      tags: { include: { tag: true } },
      relationships: {
        include: { targetWord: { select: { id: true, text: true } } },
      },
      relatedTo: {
        include: { sourceWord: { select: { id: true, text: true } } },
      },
      review: true,
    },
  });

  if (!appWord && !dict) {
    return NextResponse.json(
      { error: "未找到该单词（词典和词库中都没有）" },
      { status: 404 }
    );
  }

  const relationships = appWord
    ? [
        ...appWord.relationships.map((r) => ({
          type: r.type,
          description: r.description,
          word: r.targetWord.text,
          wordId: r.targetWord.id,
        })),
        ...appWord.relatedTo.map((r) => ({
          type: r.type,
          description: r.description,
          word: r.sourceWord.text,
          wordId: r.sourceWord.id,
        })),
      ]
    : [];

  // 共享意思标签的词（同义词来源）
  let sharedMeaningWords: { id: string; text: string }[] = [];
  if (appWord) {
    const meaningTagIds = appWord.tags
      .filter((wt) => wt.tag.type === "MEANING")
      .map((wt) => wt.tag.id);
    if (meaningTagIds.length) {
      const others = await prisma.wordTag.findMany({
        where: {
          tagId: { in: meaningTagIds },
          wordId: { not: appWord.id },
        },
        distinct: ["wordId"],
        select: { wordId: true },
        take: 30,
      });
      if (others.length) {
        const ids = others.map((o) => o.wordId);
        const words = await prisma.word.findMany({
          where: { id: { in: ids } },
          select: { id: true, text: true },
        });
        sharedMeaningWords = words;
      }
    }
  }

  return NextResponse.json({
    dict,
    sharedMeaningWords,
    app: appWord
      ? {
          id: appWord.id,
          text: appWord.text,
          meaning: appWord.meaning,
          createdAt: appWord.createdAt,
          tags: appWord.tags.map((wt) => ({
            id: wt.tag.id,
            name: wt.tag.name,
            type: wt.tag.type,
          })),
          relationships,
          review: appWord.review
            ? {
                due: appWord.review.due,
                state: appWord.review.state,
                scheduledDays: appWord.review.scheduledDays,
              }
            : null,
        }
      : null,
  });
}
