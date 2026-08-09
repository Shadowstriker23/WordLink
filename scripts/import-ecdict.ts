import { parse } from "csv-parse";
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import Database from "better-sqlite3";
import path from "node:path";

const CSV_PATH = process.env.ECDICT_CSV ?? path.resolve("ecdict.csv");
const DB_PATH = path.resolve("data", "ecdict.db");

if (!existsSync(CSV_PATH)) {
  console.error(`找不到 CSV 文件: ${CSV_PATH}`);
  console.error("请先下载 ECDICT: https://github.com/skywind3000/ECDICT");
  process.exit(1);
}

const BATCH_SIZE = 5000;
const LOG_INTERVAL = 100000;

const POS_PATTERN = /^(?:\[[^\]]+\]\s*)?([a-z]+)\.\s*/i;
const POS_NORMALIZE: Record<string, string> = { a: "adj", ad: "adv", vt: "v", vi: "v" };

function extractPos(translation: string): string {
  if (!translation) return "";
  const pos = new Set<string>();
  for (const line of translation.split("\n")) {
    const m = line.match(POS_PATTERN);
    if (m) {
      const raw = m[1].toLowerCase();
      pos.add(POS_NORMALIZE[raw] ?? raw);
    }
  }
  return [...pos].join(",");
}

async function main() {
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);

  db.exec(`
    PRAGMA journal_mode = OFF;
    PRAGMA synchronous = OFF;
    DROP TABLE IF EXISTS entries;
    CREATE TABLE entries (
      word        TEXT PRIMARY KEY,
      phonetic    TEXT,
      definition  TEXT,
      translation TEXT,
      pos         TEXT,
      pos_list    TEXT DEFAULT '',
      tag         TEXT,
      bnc         INTEGER,
      frq         INTEGER,
      exchange    TEXT,
      detail      TEXT
    );
  `);

  const insert = db.prepare(`
    INSERT INTO entries (word, phonetic, definition, translation, pos, pos_list, tag, bnc, frq, exchange, detail)
    VALUES (@word, @phonetic, @definition, @translation, @pos, @pos_list, @tag, @bnc, @frq, @exchange, @detail)
  `);

  let count = 0;
  let skipped = 0;
  let buffer: Record<string, string>[] = [];

  const flush = db.transaction((rows: typeof buffer) => {
    for (const r of rows) {
      const word = (r.word ?? "").trim();
      if (!word || !r.translation) {
        skipped++;
        continue;
      }
      insert.run({
        word,
        phonetic: r.phonetic ?? "",
        definition: r.definition ?? "",
        translation: r.translation,
        pos: r.pos ?? "",
        pos_list: extractPos(r.translation),
        tag: r.tag ?? "",
        bnc: Number(r.bnc ?? 0) || 0,
        frq: Number(r.frq ?? 0) || 0,
        exchange: r.exchange ?? "",
        detail: r.detail ?? "",
      });
      count++;
    }
  });

  console.log("开始导入...");

  const parser = createReadStream(CSV_PATH).pipe(
    parse({ columns: true, relax_quotes: true, bom: true })
  );

  for await (const row of parser) {
    buffer.push(row as Record<string, string>);
    if (buffer.length >= BATCH_SIZE) {
      flush(buffer);
      buffer = [];
      if (count % LOG_INTERVAL < BATCH_SIZE) {
        console.log(`  已导入 ${count} 条...`);
      }
    }
  }

  if (buffer.length) flush(buffer);

  console.log("创建索引...");
  db.exec("CREATE INDEX IF NOT EXISTS idx_entries_lower ON entries(lower(word))");
  db.exec("PRAGMA journal_mode = WAL");

  const size = (statSync(DB_PATH).size / 1048576).toFixed(1);
  console.log(`\n导入完成: ${count} 条 (跳过 ${skipped} 条)`);
  console.log(`数据库: ${DB_PATH} (${size} MB)`);

  db.close();
}

main().catch((e) => {
  if (e instanceof Error) {
    console.error("导入失败:", e.message);
    if (e.message.includes("SIGSEGV") || e.message.includes("killed")) {
      console.error("可能内存不足，请确保至少有 500MB 空闲内存");
    }
  } else {
    console.error("导入失败:", e);
  }
  process.exit(1);
});
