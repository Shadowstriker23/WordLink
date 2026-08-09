"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { TagBadge } from "@/components/ui/badge";
import { WordCard } from "@/components/word-card";
import { useTagPanel } from "@/lib/tag-panel-context";
import { Loader2, Search, Hash, X } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface ExploreTagMatch {
  token: string;
  tagId: string;
  name: string;
  type: string;
  count: number;
}

interface ExploreWord {
  id: string;
  text: string;
  meaning: string;
  pronunciation?: string;
  createdAt: string;
  tags: { name: string; type: string }[];
  due: string | null;
  state: number;
}

interface DictSuggestion {
  word: string;
  freq: number;
  translation?: string;
  tags: string[];
}

export default function ExploreClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setTarget } = useTagPanel();
  const [input, setInput] = useState(searchParams.get("q") ?? "");
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [word, setWord] = useState(searchParams.get("word") ?? "");
  const [tagMatches, setTagMatches] = useState<ExploreTagMatch[]>([]);
  const [results, setResults] = useState<ExploreWord[]>([]);
  const [suggestions, setSuggestions] = useState<DictSuggestion[]>([]);
  const [posSuggestions, setPosSuggestions] = useState<DictSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        setSuggestions([]);
        setPosSuggestions([]);
        setTagMatches([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const res = await fetch(`/api/explore?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setTagMatches(data.tagMatches ?? []);
      setResults(data.results ?? []);
      setSuggestions(data.suggestions ?? []);
      setPosSuggestions(data.posSuggestions ?? []);
      setLoading(false);
      if (!word && data.results?.[0]) {
        setWord(data.results[0].text);
      }
    },
    [word]
  );

  // 从 URL 初始加载选中词时同步右栏
  useEffect(() => {
    if (word) setTarget({ kind: "word", word });
  }, [word, setTarget]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQuery(input);
      router.replace(`/explore?q=${encodeURIComponent(input)}${word ? `&word=${encodeURIComponent(word)}` : ""}`, { scroll: false });
      doSearch(input);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [input, doSearch, router, word]);

  const tokens = query
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => ({ text: t, isTag: t.startsWith("#") }));

  const selectWord = (w: string) => {
    setWord(w);
    setTarget({ kind: "word", word: w });
  };

  const removeToken = (token: string) => {
    const remaining = tokens
      .filter((t) => t.text !== token)
      .map((t) => t.text)
      .join(" ");
    setInput(remaining);
  };

  const quickTag = (tag: string) => {
    setInput((prev) => (prev.trim() ? `${prev.trim()} #${tag}` : `#${tag}`));
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">标签检索</h1>
        <p className="text-sm text-muted">
          多标签检索用 <span className="font-mono text-accent">#tag</span>{" "}
          分隔；直接输入单词则匹配词库；词性如
          <button className="mx-1 font-mono text-primary hover:underline" onClick={() => quickTag("adj.")}>
            #adj.
          </button>
          可检索词典
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={'输入检索词，如 "#-tion #ac- spectacle" 或 "#adj."'}
          className="h-12 w-full rounded-xl border border-border bg-surface pl-10 pr-4 text-base text-text placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        />
      </div>

      {tokens.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tokens.map((t) => (
            <span
              key={t.text}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-sm font-medium ${
                t.isTag
                  ? "border-accent/30 bg-accent/10 text-accent"
                  : "border-border bg-surface-2 text-text"
              }`}
            >
              {t.isTag && <Hash className="h-3.5 w-3.5" />}
              {t.text}
              <button
                onClick={() => removeToken(t.text)}
                className="text-muted hover:text-danger"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {tagMatches.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">匹配标签：</span>
          {tagMatches.map((m) => (
            <a
              key={m.tagId}
              href={`/tags/${encodeURIComponent(m.name)}`}
              className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-primary hover:bg-primary/10"
            >
              <Hash className="h-3 w-3" />
              {m.name}
              <span className="text-xs text-muted">({m.count})</span>
            </a>
          ))}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          {loading ? (
            <Card className="flex items-center justify-center p-10 text-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
            </Card>
          ) : (
            <>
              {results.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-muted">
                    词库匹配 ({results.length})
                  </h3>
                  <div className="space-y-2">
                    {results.map((w) => (
                      <button
                        key={w.id}
                        onClick={() => selectWord(w.text)}
                        className={`block w-full rounded-lg border p-3 text-left transition-colors ${
                          word === w.text
                            ? "border-primary bg-primary/5"
                            : "border-border bg-surface hover:border-primary/40"
                        }`}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-semibold text-primary">{w.text}</span>
                          {w.state > 0 && (
                            <span className="text-xs text-muted">
                              {formatDate(w.createdAt)} 收录
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-sm text-text">{w.meaning}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {w.tags.slice(0, 4).map((t, i) => (
                            <TagBadge key={i} type={t.type} className="text-[11px]">
                              {t.name}
                            </TagBadge>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {posSuggestions.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-muted">
                    词性词典检索 ({posSuggestions.length})
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {posSuggestions.map((s) => (
                      <button
                        key={s.word}
                        onClick={() => selectWord(s.word)}
                        className="rounded-md border border-border bg-surface px-2.5 py-1 text-sm text-text hover:border-accent/50 hover:text-accent"
                      >
                        {s.word}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {suggestions.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-muted">
                    相似词推荐
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((s) => (
                      <button
                        key={s.word}
                        onClick={() => selectWord(s.word)}
                        className="rounded-md border border-border bg-surface px-2.5 py-1 text-sm text-text hover:border-primary/50 hover:text-primary"
                      >
                        {s.word}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!loading && results.length === 0 && posSuggestions.length === 0 && suggestions.length === 0 && query.trim() && (
                <Card className="p-8 text-center text-sm text-muted">
                  没有找到匹配内容，试试其它标签或单词
                </Card>
              )}

              {!query.trim() && (
                <Card className="p-8 text-center text-sm text-muted">
                  输入标签或单词开始检索
                </Card>
              )}
            </>
          )}
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          {word ? (
            <WordCard word={word} />
          ) : (
            <Card className="flex min-h-[400px] items-center justify-center border-dashed text-sm text-muted">
              在左侧选择一个单词查看详情
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
