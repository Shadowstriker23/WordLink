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

mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
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
  CREATE INDEX IF NOT EXISTS idx_entries_lower ON entries(lower(word));
`);

const insert = db.prepare(`
  INSERT INTO entries (word, phonetic, definition, translation, pos, pos_list, tag, bnc, frq, exchange, detail)
  VALUES (@word, @phonetic, @definition, @translation, @pos, @pos_list, @tag, @bnc, @frq, @exchange, @detail)
`);

const POS_PATTERN = /^(?:\[[^\]]+\]\s*)?([a-z]+)\.\s*/i;

const POS_NORMALIZE: Record<string, string> = {
  a: "adj",
  ad: "adv",
  vt: "v",
  vi: "v",
};

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

const parser = parse({ columns: true, relax_quotes: true, bom: true });

async function main() {
  let count = 0;
  let skipped = 0;
  let batch = 0;
  const runBatch = db.transaction((rows: Record<string, string>[]) => {
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

  let buffer: Record<string, string>[] = [];
  const BATCH = 20000;

  await new Promise<void>((resolve, reject) => {
    createReadStream(CSV_PATH)
      .pipe(parser)
      .on("data", (row: Record<string, string>) => {
        buffer.push(row);
        if (buffer.length >= BATCH) {
          runBatch(buffer);
          batch++;
          buffer = [];
          if (batch % 10 === 0) {
            console.log(`已导入 ${count} 条...`);
          }
        }
      })
      .on("end", () => {
        if (buffer.length) runBatch(buffer);
        resolve();
      })
      .on("error", reject);
  });

  const size = (statSync(DB_PATH).size / 1048576).toFixed(1);
  console.log(`\n导入完成: ${count} 条 (跳过 ${skipped} 条无释义记录)`);
  console.log(`数据库: ${DB_PATH} (${size} MB)`);

  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
