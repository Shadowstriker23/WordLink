import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "node:path";
import { AFFIX_DESCRIPTIONS } from "../src/lib/affix-desc";

const adapter = new PrismaBetterSqlite3({
  url: path.resolve(process.cwd(), "dev.db"),
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const tags = await prisma.tag.findMany({
    where: { type: { in: ["ROOT", "AFFIX"] } },
  });

  let updated = 0;
  for (const tag of tags) {
    const desc = AFFIX_DESCRIPTIONS[tag.name];
    if (desc && tag.description !== desc) {
      await prisma.tag.update({ where: { id: tag.id }, data: { description: desc } });
      updated++;
    }
  }

  const missing = tags.filter((t) => !AFFIX_DESCRIPTIONS[t.name]).length;
  console.log(`已回填 ${updated} 个词根/词缀的本意解释`);
  console.log(`共 ${tags.length} 个词根/词缀标签，${missing} 个暂无对照（将由 AI 生成）`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
