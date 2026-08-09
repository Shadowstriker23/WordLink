import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name")?.trim();
  if (!name) {
    return NextResponse.json({ error: "缺少 name" }, { status: 400 });
  }

  const tags = await prisma.tag.findMany({
    where: { name },
    include: { _count: { select: { words: true } } },
  });

  if (!tags.length) {
    return NextResponse.json({ tag: null });
  }

  const tagIds = tags.map((t) => t.id);
  const wordTags = await prisma.wordTag.findMany({
    where: { tagId: { in: tagIds } },
    select: { wordId: true },
  });
  const wordIds = [...new Set(wordTags.map((w) => w.wordId))];

  const words = wordIds.length
    ? await prisma.word.findMany({
        where: { id: { in: wordIds } },
        select: { id: true, text: true, meaning: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    : [];

  // 相关标签：与该 tag 共现（同一批词上）的其他 tag
  let relatedTags: { name: string; type: string; count: number }[] = [];
  if (wordIds.length) {
    const relCounts = (await prisma.wordTag.groupBy({
      by: ["tagId"],
      where: {
        wordId: { in: wordIds },
        tagId: { notIn: tagIds },
      },
      _count: { _all: true },
    })) as unknown as { tagId: string; _count: { _all: number } }[];

    const sorted = relCounts.sort((a, b) => b._count._all - a._count._all).slice(0, 12);
    const relTagIds = sorted.map((r) => r.tagId);
    const relTags = relTagIds.length
      ? await prisma.tag.findMany({
          where: { id: { in: relTagIds } },
          select: { id: true, name: true, type: true },
        })
      : [];
    const relTagMap = new Map(relTags.map((t) => [t.id, t]));
    relatedTags = sorted
      .map((r) => {
        const t = relTagMap.get(r.tagId);
        return t
          ? { name: t.name, type: t.type as string, count: r._count._all }
          : null;
      })
      .filter(
        (t): t is { name: string; type: string; count: number } => t !== null
      );
  }

  return NextResponse.json({
    tag: tags.map((t) => ({
      name: t.name,
      type: t.type,
      count: t._count.words,
      description: t.description,
    })),
    words,
    relatedTags,
  });
}
