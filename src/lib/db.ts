import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "node:path";

const dbFile =
  process.env.DATABASE_URL?.replace("file:", "") ?? "prisma/dev.db";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  const adapter = new PrismaBetterSqlite3({
    url: path.resolve(process.cwd(), dbFile),
  });
  return new PrismaClient({ adapter });
}

export const prisma =
  globalForPrisma.prisma ?? (globalForPrisma.prisma = createClient());
