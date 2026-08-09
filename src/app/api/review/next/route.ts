import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { lookupWord } from "@/lib/dict";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 100);

  const dueReviews = await prisma.review.findMany({
    where: {
      OR: [{ state: 0 }, { due: { lte: new Date() } }],
    },
    orderBy: [{ state: "asc" }, { due: "asc" }],
    take: limit,
    include: {
      word: { include: { tags: { include: { tag: true } } } },
    },
  });

  const items = await Promise.all(
    dueReviews.map(async (r) => {
      const dict = await lookupWord(r.word.text);
      return {
      wordId: r.wordId,
      word: r.word.text,
      meaning: r.word.meaning,
      pronunciation: dict?.phonetic ?? r.word.pronunciation,
      exampleSentence: r.word.exampleSentence ?? dict?.example,
      tags: r.word.tags.map((wt) => ({
        name: wt.tag.name,
        type: wt.tag.type,
      })),
      dictMeanings: dict?.meanings ?? [],
      state: r.state,
      scheduledDays: r.scheduledDays,
      stability: r.stability,
      due: r.due,
    };
  }));


  return NextResponse.json({ reviews: items });
}
