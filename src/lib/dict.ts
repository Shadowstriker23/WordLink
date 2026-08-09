import Database from "better-sqlite3";
import path from "node:path";
import { existsSync } from "node:fs";

const DICT_PATH = path.join(process.cwd(), "data", "ecdict.db");

export interface DictEntry {
  word: string;
  phonetic: string;
  definition: string;
  translation: string;
  pos: string;
  tag: string;
  bnc: number;
  frq: number;
  exchange: string;
  detail: string;
}

export interface PosMeaning {
  pos: string;
  meanings: string[];
}

export interface DictWordCard {
  word: string;
  phonetic: string;
  translation: string;
  meanings: PosMeaning[];
  tags: string[]; // gk zk cet4 cet6 ky ...
  example: string | null;
  freq: number;
}

interface RawEntry {
  word: string;
  phonetic: string;
  definition: string;
  translation: string;
  pos: string;
  pos_list?: string;
  tag: string;
  bnc: number;
  frq: number;
  exchange: string;
  detail: string;
}

let db: Database.Database | null = null;

function getDb(): Database.Database | null {
  if (!existsSync(DICT_PATH)) return null;
  if (!db) {
    db = new Database(DICT_PATH, { readonly: true });
  }
  return db;
}

/** 把 "n. 景象；奇观\nvt. 使…" 解析成 [{pos:'n.', meanings:['景象','奇观']}, ...] */
const POS_DISPLAY: Record<string, string> = {
  a: "adj",
  ad: "adv",
  vt: "v",
  vi: "v",
};

export function parseTranslation(translation: string): PosMeaning[] {
  if (!translation) return [];
  const result: PosMeaning[] = [];
  // ECDICT 的翻译按 \n 分隔多个词性，每个以 "词性. " 开头
  const groups = translation.split("\n");
  for (const group of groups) {
    const m = group.match(/^(\[[^\]]+\]\s*)?([a-z]+\.)\s*(.+)$/i);
    if (m) {
      const posRaw = m[2].toLowerCase();
      const pos = (POS_DISPLAY[posRaw.replace(".", "")] ?? posRaw) + ".";
      const meanings = m[3]
        .split(/[;,；，]/)
        .map((s) => s.trim())
        .filter(Boolean);
      result.push({ pos, meanings });
    }
  }
  if (result.length === 0 && groups[0]) {
    result.push({ pos: "", meanings: groups.map((g) => g.trim()).filter(Boolean) });
  }
  return result;
}

/** 从 detail JSON 中提取例句 */
function extractExample(detail: string): string | null {
  if (!detail) return null;
  try {
    const d = JSON.parse(detail);
    const ex = d?.detail ?? d?.sentences;
    if (typeof ex === "string" && ex.trim()) return ex.trim();
    if (Array.isArray(ex)) {
      const s = ex
        .map((x: unknown) => (typeof x === "string" ? x : null))
        .filter(Boolean)
        .join(" ");
      return s || null;
    }
  } catch {
    /* ignore malformed JSON */
  }
  return null;
}

export function lookupWord(word: string): DictWordCard | null {
  const database = getDb();
  if (!database) return null;
  const row = database
    .prepare("SELECT * FROM entries WHERE lower(word) = ?")
    .get(word.toLowerCase()) as RawEntry | undefined;
  if (!row) return null;
  return {
    word: row.word,
    phonetic: row.phonetic,
    translation: row.translation,
    meanings: parseTranslation(row.translation),
    tags: (row.tag ?? "").split(/\s+/).filter(Boolean),
    example: extractExample(row.detail),
    freq: row.frq ?? 0,
  };
}

export interface DictSuggestion {
  word: string;
  freq: number;
  pos?: string;
  translation?: string;
  tags: string[];
}

/** 前缀匹配，按频率排序（词频越高越常见） */
export function searchPrefix(prefix: string, limit = 20): DictSuggestion[] {
  const database = getDb();
  if (!database || !prefix.trim()) return [];
  const p = prefix.toLowerCase().replace(/[^a-z'\-]/g, "");
  if (!p) return [];
  const rows = database
    .prepare(
      "SELECT word, translation, tag, frq FROM entries WHERE lower(word) LIKE ? ORDER BY (frq = 0) ASC, frq ASC, (bnc = 0) ASC, bnc ASC LIMIT ?"
    )
    .all(`${p}%`, limit) as Pick<RawEntry, "word" | "translation" | "tag" | "frq">[];
  return rows.map((r) => ({
    word: r.word,
    freq: r.frq ?? 0,
    translation: r.translation,
    tags: (r.tag ?? "").split(/\s+/).filter(Boolean),
  }));
}

/** 模糊/包含匹配 */
export function searchContains(term: string, limit = 20): DictSuggestion[] {
  const database = getDb();
  if (!database || !term.trim()) return [];
  const t = term.toLowerCase().replace(/[^a-z'\-]/g, "");
  if (!t) return [];
  const rows = database
    .prepare(
      "SELECT word, translation, tag, frq FROM entries WHERE lower(word) LIKE ? ORDER BY (frq = 0) ASC, frq ASC, (bnc = 0) ASC, bnc ASC LIMIT ?"
    )
    .all(`%${t}%`, limit) as Pick<RawEntry, "word" | "translation" | "tag" | "frq">[];
  return rows.map((r) => ({
    word: r.word,
    freq: r.frq ?? 0,
    translation: r.translation,
    tags: (r.tag ?? "").split(/\s+/).filter(Boolean),
  }));
}

/** 按词性检索词典（如 #adj. 返回形容词） */
export function searchByPos(pos: string, limit = 30): DictSuggestion[] {
  const database = getDb();
  if (!database || !pos.trim()) return [];
  let p = pos.toLowerCase().replace(/\./g, "").replace(/[^a-z]/g, "");
  const normalize: Record<string, string> = {
    a: "adj",
    ad: "adv",
    vt: "v",
    vi: "v",
  };
  p = normalize[p] ?? p;
  if (!p) return [];
  const rows = database
    .prepare(
      "SELECT word, translation, tag, frq FROM entries WHERE pos_list = ? OR pos_list LIKE ? OR pos_list LIKE ? OR pos_list LIKE ? ORDER BY (frq = 0) ASC, frq ASC, (bnc = 0) ASC, bnc ASC LIMIT ?"
    )
    .all(p, `%,${p}`, `${p},%`, `%,${p},%`, limit) as Pick<
    RawEntry,
    "word" | "translation" | "tag" | "frq"
  >[];
  return rows.map((r) => ({
    word: r.word,
    freq: r.frq ?? 0,
    translation: r.translation,
    tags: (r.tag ?? "").split(/\s+/).filter(Boolean),
  }));
}

/** 按词义检索词典（如 "意思:场面" → 翻译里含"场面"的词） */
export function searchByTranslation(term: string, limit = 30): DictSuggestion[] {
  const database = getDb();
  if (!database || !term.trim()) return [];
  const rows = database
    .prepare(
      "SELECT word, translation, tag, frq FROM entries WHERE translation LIKE ? ORDER BY (frq = 0) ASC, frq ASC, (bnc = 0) ASC, bnc ASC LIMIT ?"
    )
    .all(`%${term}%`, limit) as Pick<
    RawEntry,
    "word" | "translation" | "tag" | "frq"
  >[];
  return rows.map((r) => ({
    word: r.word,
    freq: r.frq ?? 0,
    translation: r.translation,
    tags: (r.tag ?? "").split(/\s+/).filter(Boolean),
  }));
}

/** 检测输入是否为词性（adj./n./v./vt./adv. 等） */
const POS_SET = new Set([
  "n", "v", "vt", "vi", "adj", "adv", "prep", "conj", "pron", "num",
  "art", "int", "abbr", "aux", "modal", "a", "ad", "suf", "pref",
]);

export function isPosToken(token: string): boolean {
  const t = token.toLowerCase().replace(".", "");
  return POS_SET.has(t);
}
