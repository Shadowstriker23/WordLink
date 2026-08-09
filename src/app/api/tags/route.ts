import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const tags = await prisma.tag.findMany({
    orderBy: [{ type: "asc" }, { name: "asc" }],
    include: { _count: { select: { words: true } } },
  });
  return NextResponse.json({ tags });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, type, color } = body;
  if (!name || !type) {
    return NextResponse.json({ error: "name 和 type 为必填项" }, { status: 400 });
  }

  const tag = await prisma.tag.upsert({
    where: { name_type: { name, type } },
    update: { color: color ?? undefined },
    create: { name, type, color },
  });

  return NextResponse.json({ tag }, { status: 201 });
}
