// 词典导入 - sql.js 纯 WASM 版本（零原生依赖）
// node --max-old-space-size=1024 scripts/import-ecdict.mjs
import { readFileSync, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import initSqlJs from "sql.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = process.env.ECDICT_CSV ?? path.resolve(__dirname, "..", "ecdict.csv");
const DB_PATH = path.resolve(__dirname, "..", "data", "ecdict.db");

if (!existsSync(CSV_PATH)) {
  console.error("找不到 CSV:", CSV_PATH);
  process.exit(1);
}

// ── 轻量 CSV 解析 ─────────────────────────────────────
function parseCSVLine(line) {
  const fields = [];
  let field = "", inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && !inQuotes) { inQuotes = true; }
    else if (c === '"' && inQuotes) {
      if (line[i + 1] === '"') { field += '"'; i++; }
      else { inQuotes = false; }
    } else if (c === "," && !inQuotes) { fields.push(field.trimStart()); field = ""; }
    else { field += c; }
  }
  fields.push(field.trimStart());
  return fields;
}

function parseAllRows(text) {
  const lines = [];
  let current = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' && !inQuotes) { inQuotes = true; }
    else if (c === '"' && inQuotes) { inQuotes = false; }
    else if ((c === "\n" || c === "\r") && !inQuotes) {
      if (current.trim()) lines.push(current);
      current = "";
      if (c === "\r" && text[i + 1] === "\n") i++;
    } else { current += c; }
  }
  if (current.trim()) lines.push(current);
  return lines;
}

const POS_PATTERN = /^(?:\[[^\]]+\]\s*)?([a-z]+)\.\s*/i;
const POS_NORMALIZE = { a: "adj", ad: "adv", vt: "v", vi: "v" };
function extractPos(t) {
  if (!t) return "";
  const s = new Set();
  for (const l of t.split("\n")) { const m = l.match(POS_PATTERN); if (m) s.add(POS_NORMALIZE[m[1].toLowerCase()] ?? m[1].toLowerCase()); }
  return [...s].join(",");
}

// ── 主流程 ─────────────────────────────────────────────
async function main() {
  const SQL = await initSqlJs();
  mkdirSync(path.dirname(DB_PATH), { recursive: true });

  console.log("读取 CSV...");
  const raw = readFileSync(CSV_PATH, "utf-8");
  console.log("解析行...");
  const lines = parseAllRows(raw);
  const header = parseCSVLine(lines[0]);
  const colMap = {};
  header.forEach((h, i) => { colMap[h] = i; });
  console.log(`共 ${lines.length - 1} 条数据`);

  const db = new SQL.Database();

  db.run("CREATE TABLE entries (word TEXT PRIMARY KEY, phonetic TEXT, definition TEXT, translation TEXT, pos TEXT, pos_list TEXT DEFAULT '', tag TEXT, bnc INTEGER, frq INTEGER, exchange TEXT, detail TEXT)");

  const stmt =
    "INSERT OR IGNORE INTO entries (word, phonetic, definition, translation, pos, pos_list, tag, bnc, frq, exchange, detail) VALUES (?,?,?,?,?,?,?,?,?,?,?)";

  console.log("导入中...");
  let count = 0;

  db.run("BEGIN");
  for (let i = 1; i < lines.length; i++) {
    const f = parseCSVLine(lines[i]);
    const word = (f[colMap["word"]] ?? "").trim();
    const translation = f[colMap["translation"]] ?? "";
    if (!word || !translation) continue;

    db.run(stmt, [
      word,
      f[colMap["phonetic"]] ?? "",
      f[colMap["definition"]] ?? "",
      translation,
      f[colMap["pos"]] ?? "",
      extractPos(translation),
      f[colMap["tag"]] ?? "",
      Number(f[colMap["bnc"]] ?? 0) || 0,
      Number(f[colMap["frq"]] ?? 0) || 0,
      f[colMap["exchange"]] ?? "",
      f[colMap["detail"]] ?? "",
    ]);
    count++;

    if (count % 1000 === 0) {
      db.run("COMMIT");
      db.run("BEGIN");
      if (count % 100000 < 1000) console.log(`  已导入 ${count} 条...`);
    }
  }
  db.run("COMMIT");

  // ── 构建词形映射表（变形 → 原型）────────────────────
  console.log("构建词形还原表...");
  db.run("CREATE TABLE lemma_map (form TEXT, base TEXT, type TEXT, PRIMARY KEY (form, base, type))");

  const TYPE_LABEL = { p:"过去式", d:"过去分词", s:"三单", i:"现在分词", ing:"现在分词", r:"比较级", t:"最高级", "0":"原型", "1":"复数" };

  let lcount = 0;
  const lemmaResults = db.exec("SELECT word, exchange FROM entries WHERE exchange != '' AND exchange != '/'");
  if (lemmaResults.length && lemmaResults[0].values) {
    const ins = db.prepare("INSERT OR IGNORE INTO lemma_map (form, base, type) VALUES (?, ?, ?)");
    db.run("BEGIN");
    for (const [word, exchange] of lemmaResults[0].values) {
      const parts = String(exchange).split("/");
      for (const part of parts) {
        const colon = part.indexOf(":");
        if (colon < 1) continue;
        const typ = part.slice(0, colon).trim();
        const vals = part.slice(colon + 1).trim();
        if (!vals) continue;
        const label = TYPE_LABEL[typ] ?? typ;
        for (const form of vals.split(",")) {
          const f = form.trim().toLowerCase();
          if (f && f !== word.toLowerCase() && typ !== "0") {
            ins.run([f, word, label]);
            lcount++;
          }
        }
      }
      if (lcount % 5000 === 0) {
        db.run("COMMIT"); db.run("BEGIN");
      }
    }
    db.run("COMMIT");
  }
  console.log(`  词形映射 ${lcount} 条`);

  console.log("创建索引...");
  db.run("CREATE INDEX IF NOT EXISTS idx_entries_lower ON entries(LOWER(word))");
  db.run("CREATE INDEX IF NOT EXISTS idx_lemma_form ON lemma_map(form)");

  console.log("写入文件...");
  const buffer = db.export();
  writeFileSync(DB_PATH, Buffer.from(buffer));

  const size = (statSync(DB_PATH).size / 1048576).toFixed(1);
  console.log(`\n导入完成: ${count} 条`);
  console.log(`数据库: ${DB_PATH} (${size} MB)`);
  db.close();
}

main().catch((e) => { console.error("失败:", e.message); process.exit(1); });
