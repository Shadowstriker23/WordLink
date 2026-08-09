import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateReview } from "@/lib/fsrs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const tagId = searchParams.get("tag");
  const type = searchParams.get("type");
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);
  const offset = Number(searchParams.get("offset") ?? 0);

  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [
      { text: { contains: q } },
      { meaning: { contains: q } },
    ];
  }
  if (tagId) {
    where.tags = { some: { tagId } };
  }
  if (type) {
    where.tags = {
      ...(where.tags as object),
      some: { tag: { type } },
    };
  }

  const [words, total] = await Promise.all([
    prisma.word.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        tags: { include: { tag: true } },
        review: true,
      },
    }),
    prisma.word.count({ where }),
  ]);

  return NextResponse.json({ words, total });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { text, meaning, pronunciation, exampleSentence, tagIds = [] } = body;

  if (!text || !meaning) {
    return NextResponse.json(
      { error: "text 和 meaning 为必填项" },
      { status: 400 }
    );
  }

  const word = await prisma.word.create({
    data: {
      text,
      meaning,
      pronunciation,
      exampleSentence,
      tags: {
        create: tagIds.map((tagId: string) => ({ tagId })),
      },
    },
  });

  await getOrCreateReview(word.id);

  return NextResponse.json({ word }, { status: 201 });
}
