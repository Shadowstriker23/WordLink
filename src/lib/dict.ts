import { createClient, type Client } from "@libsql/client";
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
  tags: string[];
  example: string | null;
  freq: number;
}

export interface DictSuggestion {
  word: string;
  freq: number;
  translation?: string;
  tags: string[];
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

let client: Client | null = null;

function getClient(): Client | null {
  if (!existsSync(DICT_PATH)) return null;
  if (!client) {
    client = createClient({ url: `file:${DICT_PATH}` });
  }
  return client;
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
    result.push({
      pos: "",
      meanings: groups.map((g) => g.trim()).filter(Boolean),
    });
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
      return ex
        .map((x: unknown) => (typeof x === "string" ? x : null))
        .filter(Boolean)
        .join(" ") || null;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function lookupWord(word: string): Promise<DictWordCard | null> {
  const db = getClient();
  if (!db) return null;
  const res = await db.execute({
    sql: "SELECT * FROM entries WHERE LOWER(word) = ?",
    args: [word.toLowerCase()],
  });
  const row = res.rows[0] as unknown as RawEntry | undefined;
  if (!row) return null;
  return {
    word: row.word as string,
    phonetic: row.phonetic as string,
    translation: (row.translation as string) ?? "",
    meanings: parseTranslation((row.translation as string) ?? ""),
    tags: ((row.tag as string) ?? "").split(/\s+/).filter(Boolean),
    example: extractExample((row.detail as string) ?? ""),
    freq: (row.frq as number) ?? 0,
  };
}

async function querySuggestions(
  sql: string,
  args: (string | number)[],
  limit: number
): Promise<DictSuggestion[]> {
  const db = getClient();
  if (!db) return [];
  const res = await db.execute({ sql: `${sql} LIMIT ${limit}`, args });
  return (res.rows as unknown as RawEntry[]).map((r) => ({
    word: r.word as string,
    freq: (r.frq as number) ?? 0,
    translation: r.translation as string,
    tags: ((r.tag as string) ?? "").split(/\s+/).filter(Boolean),
  }));
}

export async function searchPrefix(
  prefix: string,
  limit = 20
): Promise<DictSuggestion[]> {
  if (!prefix.trim()) return [];
  const p = prefix.toLowerCase().replace(/[^a-z'\-]/g, "");
  if (!p) return [];
  return querySuggestions(
    "SELECT word, translation, tag, frq FROM entries WHERE LOWER(word) LIKE ? ORDER BY (frq = 0) ASC, frq ASC, (bnc = 0) ASC, bnc ASC",
    [`${p}%`],
    limit
  );
}

export async function searchContains(
  term: string,
  limit = 20
): Promise<DictSuggestion[]> {
  if (!term.trim()) return [];
  const t = term.toLowerCase().replace(/[^a-z'\-]/g, "");
  if (!t) return [];
  return querySuggestions(
    "SELECT word, translation, tag, frq FROM entries WHERE LOWER(word) LIKE ? ORDER BY (frq = 0) ASC, frq ASC, (bnc = 0) ASC, bnc ASC",
    [`%${t}%`],
    limit
  );
}

export async function searchByPos(
  pos: string,
  limit = 30
): Promise<DictSuggestion[]> {
  if (!pos.trim()) return [];
  let p = pos.toLowerCase().replace(/\./g, "").replace(/[^a-z]/g, "");
  const normalize: Record<string, string> = {
    a: "adj",
    ad: "adv",
    vt: "v",
    vi: "v",
  };
  p = normalize[p] ?? p;
  if (!p) return [];
  return querySuggestions(
    "SELECT word, translation, tag, frq FROM entries WHERE pos_list = ? OR pos_list LIKE ? OR pos_list LIKE ? OR pos_list LIKE ? ORDER BY (frq = 0) ASC, frq ASC, (bnc = 0) ASC, bnc ASC",
    [p, `%,${p}`, `${p},%`, `%,${p},%`],
    limit
  );
}

export async function searchByTranslation(
  term: string,
  limit = 30
): Promise<DictSuggestion[]> {
  if (!term.trim()) return [];
  return querySuggestions(
    "SELECT word, translation, tag, frq FROM entries WHERE translation LIKE ? ORDER BY (frq = 0) ASC, frq ASC, (bnc = 0) ASC, bnc ASC",
    [`%${term}%`],
    limit
  );
}

const POS_SET = new Set([
  "n", "v", "vt", "vi", "adj", "adv", "prep", "conj", "pron",
  "num", "art", "int", "abbr", "aux", "modal", "a", "ad", "suf", "pref",
]);

export function isPosToken(token: string): boolean {
  const t = token.toLowerCase().replace(".", "");
  return POS_SET.has(t);
}
