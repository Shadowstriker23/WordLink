import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 100), 500);

  const words = await prisma.word.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      tags: { include: { tag: true } },
      review: true,
    },
  });

  const rels = await prisma.relationship.findMany({
    where: {
      OR: [
        { sourceWordId: { in: words.map((w) => w.id) } },
        { targetWordId: { in: words.map((w) => w.id) } },
      ],
    },
  });

  const idSet = new Set(words.map((w) => w.id));
  const nodes = words.map((w) => ({
    id: w.id,
    label: w.text,
    word: w.text,
    meaning: w.meaning,
    tagCount: w.tags.length,
    primaryTag: w.tags[0]?.tag.name ?? null,
    tagTypes: w.tags.map((t) => t.tag.type),
    due: w.review?.due ?? null,
  }));

  const edges = rels
    .filter((r) => idSet.has(r.sourceWordId) && idSet.has(r.targetWordId))
    .map((r) => ({
      id: r.id,
      source: r.sourceWordId,
      target: r.targetWordId,
      type: r.type,
    }));

  return NextResponse.json({ nodes, edges });
}
