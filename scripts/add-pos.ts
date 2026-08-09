import Database from "better-sqlite3";
import path from "node:path";

const DB_PATH = path.resolve("data", "ecdict.db");
const db = new Database(DB_PATH);

const POS_PATTERN = /^(?:\[[^\]]+\]\s*)?([a-z]+)\.\s*/i;

const POS_NORMALIZE: Record<string, string> = {
  a: "adj",
  ad: "adv",
  vt: "v",
  vi: "v",
};

function extractPos(translation: string): string[] {
  if (!translation) return [];
  const pos = new Set<string>();
  for (const line of translation.split("\n")) {
    const m = line.match(POS_PATTERN);
    if (m) {
      const raw = m[1].toLowerCase();
      pos.add(POS_NORMALIZE[raw] ?? raw);
    }
  }
  return [...pos];
}

const hasCol = db
  .prepare("SELECT COUNT(*) c FROM pragma_table_info('entries') WHERE name='pos_list'")
  .get() as { c: number };
if (!hasCol.c) {
  db.exec("ALTER TABLE entries ADD COLUMN pos_list TEXT DEFAULT ''");
} else {
  db.exec("UPDATE entries SET pos_list = ''");
}

const rows = db.prepare("SELECT word, translation FROM entries").all() as {
  word: string;
  translation: string;
}[];

const update = db.prepare("UPDATE entries SET pos_list = ? WHERE word = ?");
const tx = db.transaction((items: { word: string; posList: string }[]) => {
  for (const it of items) update.run(it.posList, it.word);
});

let buffer: { word: string; posList: string }[] = [];
for (const r of rows) {
  const posList = extractPos(r.translation).join(",");
  if (posList) buffer.push({ word: r.word, posList });
  if (buffer.length >= 20000) {
    tx(buffer);
    buffer = [];
  }
}
if (buffer.length) tx(buffer);

db.exec("CREATE INDEX IF NOT EXISTS idx_entries_poslist ON entries(pos_list)");

const count = db.prepare("SELECT COUNT(*) c FROM entries WHERE pos_list != ''").get() as { c: number };
console.log(`已完成，${count.c} 个词条有词性标注`);

const sample = db
  .prepare("SELECT word, pos_list, translation FROM entries WHERE pos_list != '' LIMIT 5")
  .all() as { word: string; pos_list: string; translation: string }[];
sample.forEach((s) => console.log(`  ${s.word}: [${s.pos_list}] ${s.translation.split("\n")[0].slice(0, 40)}`));

db.close();
