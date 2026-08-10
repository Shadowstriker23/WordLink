"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TagBadge } from "@/components/ui/badge";
import { daysSince } from "@/lib/utils";
import { Search, Loader2, RefreshCw } from "lucide-react";

interface Tag {
  id: string;
  name: string;
  type: string;
}

interface Review {
  due: string;
  state: number;
  nextReview?: string;
}

interface Word {
  id: string;
  text: string;
  meaning: string;
  pronunciation?: string;
  createdAt: string;
  tags: { tag: Tag }[];
  review: Review | null;
}

export default function WordsPage() {
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("");
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [reanalyzeMsg, setReanalyzeMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (type) params.set("type", type);
    const res = await fetch(`/api/words?${params.toString()}`);
    const data = await res.json();
    setWords(data.words);
    setLoading(false);
  }, [q, type]);

  const reanalyze = useCallback(async () => {
    setReanalyzing(true);
    setReanalyzeMsg("");
    try {
      const res = await fetch("/api/reanalyze", { method: "POST" });
      const data = await res.json();
      setReanalyzeMsg(`完成: 清${data.cleaned} AI+${data.aiEnriched} 典+${data.dictEnriched}`);
      load();
    } catch {
      setReanalyzeMsg("失败");
    } finally {
      setReanalyzing(false);
    }
  }, [load]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">单词库</h1>
        <p className="text-sm text-muted">
          按单词 / 释义 / 词根词缀 / 语法检索
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索单词或释义..."
            className="pl-9"
          />
        </div>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text focus-visible:outline-none"
        >
          <option value="">全部类型</option>
          <option value="ROOT">词根</option>
          <option value="AFFIX">词缀</option>
          <option value="MEANING">意思</option>
          <option value="GRAMMAR">语法</option>
        </select>
        <Button
          variant="secondary"
          size="sm"
          onClick={reanalyze}
          disabled={reanalyzing}
        >
          {reanalyzing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          重新分析
        </Button>
        {reanalyzeMsg && (
          <span className="text-sm text-success">{reanalyzeMsg}</span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : words.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted">
          没有找到单词。去导入页添加吧！
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {words.map((w) => (
            <Link key={w.id} href={`/words/${w.id}`}>
              <Card className="h-full p-4 transition-shadow hover:shadow-md">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-lg font-semibold text-primary">
                    {w.text}
                  </span>
                  {w.review && w.review.state > 0 && (
                    <span className="text-xs text-muted">
                      已记 {daysSince(w.createdAt)} 天
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-text">{w.meaning}</p>
                {w.pronunciation && (
                  <p className="text-xs text-muted">{w.pronunciation}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-1">
                  {w.tags.slice(0, 4).map(({ tag }) => (
                    <TagBadge key={tag.id} type={tag.type} className="text-[11px]">
                      {tag.name}
                    </TagBadge>
                  ))}
                  {w.tags.length > 4 && (
                    <span className="text-xs text-muted">
                      +{w.tags.length - 4}
                    </span>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
