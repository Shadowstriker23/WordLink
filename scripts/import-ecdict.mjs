// 词典导入 - 最小化依赖，避免任何可能的 native/流式崩溃
// node --max-old-space-size=1024 scripts/import-ecdict.mjs
import { readFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = process.env.ECDICT_CSV ?? path.resolve(__dirname, "..", "ecdict.csv");
const DB_PATH = path.resolve(__dirname, "..", "data", "ecdict.db");

if (!existsSync(CSV_PATH)) {
  console.error("找不到 CSV:", CSV_PATH);
  process.exit(1);
}

// ── 轻量 CSV 解析（处理引号内的逗号和换行）────────────
function parseCSVLine(line) {
  const fields = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && !inQuotes) {
      inQuotes = true;
    } else if (c === '"' && inQuotes) {
      if (line[i + 1] === '"') { field += '"'; i++; }
      else { inQuotes = false; }
    } else if (c === "," && !inQuotes) {
      fields.push(field.trimStart());
      field = "";
    } else {
      field += c;
    }
  }
  fields.push(field.trimStart());
  return fields;
}

function parseAllRows(text) {
  const lines = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' && !inQuotes) { inQuotes = true; }
    else if (c === '"' && inQuotes) { inQuotes = false; }
    else if ((c === "\n" || c === "\r") && !inQuotes) {
      if (current.trim()) lines.push(current);
      current = "";
      // 跳过 \r\n 中的 \n
      if (c === "\r" && text[i + 1] === "\n") i++;
    } else {
      current += c;
    }
  }
  if (current.trim()) lines.push(current);
  return lines;
}

// ── POS 解析 ───────────────────────────────────────────
const POS_PATTERN = /^(?:\[[^\]]+\]\s*)?([a-z]+)\.\s*/i;
const POS_NORMALIZE = { a: "adj", ad: "adv", vt: "v", vi: "v" };

function extractPos(translation) {
  if (!translation) return "";
  const set = new Set();
  for (const line of translation.split("\n")) {
    const m = line.match(POS_PATTERN);
    if (m) set.add(POS_NORMALIZE[m[1].toLowerCase()] ?? m[1].toLowerCase());
  }
  return [...set].join(",");
}

// ── 主流程 ─────────────────────────────────────────────
function main() {
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);

  db.exec(`
    PRAGMA journal_mode = OFF;
    PRAGMA synchronous = OFF;
    DROP TABLE IF EXISTS entries;
    CREATE TABLE entries (
      word TEXT PRIMARY KEY, phonetic TEXT, definition TEXT,
      translation TEXT, pos TEXT, pos_list TEXT DEFAULT '',
      tag TEXT, bnc INTEGER, frq INTEGER, exchange TEXT, detail TEXT
    );
  `);

  const insert = db.prepare(`
    INSERT INTO entries (word, phonetic, definition, translation, pos, pos_list, tag, bnc, frq, exchange, detail)
    VALUES (@word, @phonetic, @definition, @translation, @pos, @pos_list, @tag, @bnc, @frq, @exchange, @detail)
  `);

  console.log("读取 CSV...");
  const raw = readFileSync(CSV_PATH, "utf-8");
  console.log("解析行数...");
  const lines = parseAllRows(raw);
  console.log(`共 ${lines.length} 行`);
  const header = parseCSVLine(lines[0]);
  const colMap = {};
  header.forEach((h, i) => { colMap[h] = i; });

  console.log("开始导入...");
  const BATCH = 3000;
  let count = 0, skipped = 0;

  const flush = db.transaction((rows) => {
    for (const row of rows) {
      if (!row.word || !row.translation) { skipped++; continue; }
      insert.run({
        word: row.word, phonetic: row.phonetic, definition: row.definition,
        translation: row.translation, pos: row.pos,
        pos_list: extractPos(row.translation),
        tag: row.tag, bnc: row.bnc, frq: row.frq,
        exchange: row.exchange, detail: row.detail,
      });
      count++;
    }
  });

  let batch = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    batch.push({
      word: (fields[colMap["word"]] ?? "").trim(),
      phonetic: fields[colMap["phonetic"]] ?? "",
      definition: fields[colMap["definition"]] ?? "",
      translation: fields[colMap["translation"]] ?? "",
      pos: fields[colMap["pos"]] ?? "",
      tag: fields[colMap["tag"]] ?? "",
      bnc: Number(fields[colMap["bnc"]] ?? 0) || 0,
      frq: Number(fields[colMap["frq"]] ?? 0) || 0,
      exchange: fields[colMap["exchange"]] ?? "",
      detail: fields[colMap["detail"]] ?? "",
    });
    if (batch.length >= BATCH) { flush(batch); batch = []; }
    if (count % 100000 < BATCH) {
      process.stdout.write(`\r  已导入 ${count} 条...`);
    }
  }
  if (batch.length) flush(batch);

  console.log(`\r  已导入 ${count} 条...`);
  console.log("创建索引...");
  db.exec("CREATE INDEX IF NOT EXISTS idx_entries_lower ON entries(lower(word))");
  db.exec("PRAGMA journal_mode = WAL");

  const size = (statSync(DB_PATH).size / 1048576).toFixed(1);
  console.log(`\n导入完成: ${count} 条 (跳过 ${skipped} 条)`);
  console.log(`数据库: ${DB_PATH} (${size} MB)`);
  db.close();
}

try {
  main();
} catch (e) {
  console.error("导入失败:", e.message);
  process.exit(1);
}
