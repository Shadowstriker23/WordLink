import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "node:path";

const adapter = new PrismaBetterSqlite3({
  url: path.resolve(process.cwd(), "dev.db"),
});
const prisma = new PrismaClient({ adapter });

const words = [
  {
    text: "spectacle",
    meaning: "景象；壮观的场面",
    pronunciation: "/ˈspektəkl/",
    exampleSentence: "The fireworks display was a magnificent spectacle.",
    tags: [
      { name: "词根:spect", type: "ROOT" },
      { name: "词缀:-acle", type: "AFFIX" },
      { name: "意思:看", type: "MEANING" },
      { name: "名词", type: "GRAMMAR" },
    ],
    rels: [
      { text: "inspect", type: "SAME_ROOT", description: "共同词根 spect=看" },
    ],
    meaningWords: ["scene", "view", "sight"],
  },
  {
    text: "inspect",
    meaning: "检查；审视",
    pronunciation: "/ɪnˈspekt/",
    exampleSentence: "The teacher inspected the students' homework.",
    tags: [
      { name: "词根:spect", type: "ROOT" },
      { name: "词缀:in-", type: "AFFIX" },
      { name: "动词", type: "GRAMMAR" },
    ],
    rels: [
      { text: "spectacle", type: "SAME_ROOT", description: "共同词根 spect=看" },
      { text: "expect", type: "SAME_AFFIX", description: "共同前缀 ex-" },
    ],
    meaningWords: ["examine", "check"],
  },
  {
    text: "expect",
    meaning: "期待；预料",
    pronunciation: "/ɪkˈspekt/",
    exampleSentence: "I expect you to arrive on time.",
    tags: [
      { name: "词根:spect", type: "ROOT" },
      { name: "词缀:ex-", type: "AFFIX" },
      { name: "动词", type: "GRAMMAR" },
    ],
    rels: [
      { text: "inspect", type: "SAME_AFFIX", description: "共同前缀 ex-" },
    ],
    meaningWords: ["anticipate", "await"],
  },
  {
    text: "perceive",
    meaning: "感知；察觉",
    pronunciation: "/pəˈsiːv/",
    exampleSentence: "We perceive the world through our senses.",
    tags: [
      { name: "词根:ceive", type: "ROOT" },
      { name: "词缀:per-", type: "AFFIX" },
      { name: "意思:看", type: "MEANING" },
      { name: "动词", type: "GRAMMAR" },
    ],
    rels: [{ text: "spectacle", type: "SYNONYM", description: "近义：看" }],
    meaningWords: ["sense", "notice"],
  },
  {
    text: "receive",
    meaning: "收到；接收",
    pronunciation: "/rɪˈsiːv/",
    exampleSentence: "I received your email this morning.",
    tags: [
      { name: "词根:ceive", type: "ROOT" },
      { name: "词缀:re-", type: "AFFIX" },
      { name: "动词", type: "GRAMMAR" },
    ],
    rels: [{ text: "perceive", type: "SAME_ROOT", description: "共同词根 ceive=拿" }],
    meaningWords: ["get", "obtain"],
  },
  {
    text: "obstacle",
    meaning: "障碍；阻碍",
    pronunciation: "/ˈɒbstəkl/",
    exampleSentence: "Lack of money is the main obstacle to success.",
    tags: [
      { name: "词根:sta", type: "ROOT" },
      { name: "词缀:ob-", type: "AFFIX" },
      { name: "名词", type: "GRAMMAR" },
    ],
    rels: [],
    meaningWords: ["barrier", "hindrance"],
  },
];

async function main() {
  for (const w of words) {
    const existing = await prisma.word.findUnique({ where: { text: w.text } });
    if (existing) {
      console.log(`跳过已存在: ${w.text}`);
      continue;
    }

    const tags = [];
    for (const t of w.tags) {
      const tag = await prisma.tag.upsert({
        where: { name_type: { name: t.name, type: t.type as never } },
        update: {},
        create: { name: t.name, type: t.type as never },
      });
      tags.push(tag);
    }

    const word = await prisma.word.create({
      data: {
        text: w.text,
        meaning: w.meaning,
        pronunciation: w.pronunciation,
        exampleSentence: w.exampleSentence,
        tags: { create: tags.map((t) => ({ tagId: t.id })) },
      },
    });

    await prisma.review.create({
      data: {
        wordId: word.id,
        due: new Date(Date.now() + Math.floor(Math.random() * 3) * 86400000),
      },
    });

    console.log(`已导入: ${w.text}`);
  }

  for (const w of words) {
    const word = await prisma.word.findUnique({ where: { text: w.text } });
    if (!word) continue;
    for (const rel of w.rels) {
      const target = await prisma.word.findUnique({
        where: { text: rel.text },
      });
      if (!target) continue;
      const exists = await prisma.relationship.findFirst({
        where: {
          sourceWordId: word.id,
          targetWordId: target.id,
          type: rel.type as never,
        },
      });
      if (!exists) {
        await prisma.relationship.create({
          data: {
            sourceWordId: word.id,
            targetWordId: target.id,
            type: rel.type as never,
            description: rel.description,
          },
        });
      }
    }
  }

  console.log("种子数据导入完成");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
