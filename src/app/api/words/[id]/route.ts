import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateReview } from "@/lib/fsrs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const word = await prisma.word.findUnique({
    where: { id },
    include: {
      tags: { include: { tag: true } },
      relationships: {
        where: { targetWordId: id },
        include: { targetWord: { select: { id: true, text: true, meaning: true } } },
      },
      relatedTo: {
        where: { sourceWordId: id },
        include: { sourceWord: { select: { id: true, text: true, meaning: true } } },
      },
      review: true,
    },
  });

  if (!word) {
    return NextResponse.json({ error: "单词不存在" }, { status: 404 });
  }

  return NextResponse.json({ word });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { text, meaning, pronunciation, exampleSentence } = body;

  const word = await prisma.word.update({
    where: { id },
    data: { text, meaning, pronunciation, exampleSentence },
  });

  return NextResponse.json({ word });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.word.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await getOrCreateReview(id);
  return NextResponse.json({ ok: true });
}
