import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "node:path";

const dbFile =
  process.env.DATABASE_URL?.replace("file:", "") ?? path.resolve("dev.db");

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClientFn() {
  const adapter = new PrismaLibSql({ url: `file:${path.resolve(dbFile)}` });
  return new PrismaClient({ adapter });
}

export const prisma =
  globalForPrisma.prisma ?? (globalForPrisma.prisma = createClientFn());
