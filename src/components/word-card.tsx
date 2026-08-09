"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WordAudio } from "@/components/word-audio";
import { Loader2, Sparkles, BookOpen, ExternalLink } from "lucide-react";

interface PosMeaning {
  pos: string;
  meanings: string[];
}

interface DictWordCard {
  word: string;
  phonetic: string;
  meanings: PosMeaning[];
  tags: string[];
  example: string | null;
  freq: number;
}

interface AppRelationship {
  type: string;
  description?: string;
  word: string;
  wordId: string;
}

interface AppWord {
  id: string;
  text: string;
  meaning: string;
  createdAt: string;
  relationships: AppRelationship[];
  review: { due: string; state: number; scheduledDays: number } | null;
}

const REL_LABEL: Record<string, string> = {
  SYNONYM: "同义",
  ANTONYM: "反义",
  SAME_ROOT: "同词根",
  SAME_AFFIX: "同词缀",
  SAME_GRAMMAR: "同语法",
  CUSTOM: "关联",
};

export function WordCard({ word }: { word: string }) {
  const [dict, setDict] = useState<DictWordCard | null>(null);
  const [app, setApp] = useState<AppWord | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [aiEnrich, setAiEnrich] = useState(false);
  const [imported, setImported] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/explore/card?word=${encodeURIComponent(word)}`);
      const data = await res.json();
      setDict(data.dict ?? null);
      setApp(data.app ?? null);
    } finally {
      setLoading(false);
    }
  }, [word]);

  useEffect(() => {
    load();
  }, [load]);

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await fetch("/api/explore/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word, aiEnrich }),
      });
      if (res.ok) {
        setImported(true);
        load();
      }
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <Card className="flex min-h-[400px] items-center justify-center text-muted">
        <Loader2 className="h-6 w-6 animate-spin" />
      </Card>
    );
  }

  const meanings = dict?.meanings.length ? dict.meanings : null;
  const example = dict?.example ?? null;

  return (
    <Card className="overflow-hidden">
      {/* 顶部：大字单词 + 音标 + 发音 */}
      <div className="border-b border-border bg-surface-2/40 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-baseline gap-3 text-4xl font-bold text-primary">
              {dict?.word ?? app?.text ?? word}
              {dict?.phonetic && (
                <span className="text-lg font-normal text-muted">
                  {dict.phonetic}
                </span>
              )}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <WordAudio word={dict?.word ?? app?.text ?? word} />
            {!app && dict && (
              <Button size="sm" onClick={handleImport} disabled={importing || imported}>
                {importing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <BookOpen className="h-4 w-4" />
                )}
                {imported ? "已收录" : "收录"}
              </Button>
            )}
            {app && (
              <Link href={`/words/${app.id}`}>
                <Button variant="secondary" size="sm">
                  <ExternalLink className="h-4 w-4" />
                  详情
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      <CardContent className="space-y-8 p-6">
        {/* 词性分段的释义大板块 */}
        {meanings ? (
          <div className="space-y-6">
            {meanings.map((m, i) => (
              <div key={i} className="border-l-4 border-primary/40 pl-5">
                <h3 className="mb-2 text-xl font-bold text-warning">{m.pos}</h3>
                <ul className="space-y-1.5">
                  {m.meanings.map((meaning, j) => (
                    <li
                      key={j}
                      className="flex items-baseline gap-3 text-xl text-text"
                    >
                      <span className="text-sm text-muted">{j + 1}.</span>
                      <span>{meaning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : app ? (
          <p className="text-2xl text-text">{app.meaning}</p>
        ) : (
          <p className="text-muted">词典中暂无释义</p>
        )}

        {/* 例句 */}
        {example && (
          <div>
            <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">
              例句
            </h3>
            <p className="rounded-lg border border-border bg-surface-2/40 p-4 text-lg italic leading-relaxed text-text">
              {example}
            </p>
          </div>
        )}

        {/* 关联词 */}
        {app && app.relationships.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
              关联词
            </h3>
            <div className="flex flex-wrap gap-2">
              {app.relationships.map((r, i) => (
                <Link
                  key={i}
                  href={`/words/${r.wordId}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2/60 px-2.5 py-1 text-sm text-text hover:border-primary/50"
                >
                  {r.word}
                  <span className="text-xs text-muted">
                    ·{REL_LABEL[r.type] ?? r.type}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 未收录时的操作 */}
        {!app && dict && (
          <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-text">该单词尚未收录进你的词库</p>
              <label className="flex items-center gap-1.5 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={aiEnrich}
                  onChange={(e) => setAiEnrich(e.target.checked)}
                />
                AI 增强（词根词缀）
              </label>
            </div>
            <Button
              className="mt-3 w-full"
              onClick={handleImport}
              disabled={importing || imported}
            >
              {importing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {imported
                ? "已收录"
                : aiEnrich
                  ? "收录并 AI 分析词根词缀"
                  : "收录到词库"}
            </Button>
          </div>
        )}

        {/* 复习按钮：已收录的单词 */}
        {app && (
          <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2/40 p-3">
            <div className="text-sm text-muted">
              {app.review && app.review.state > 0 ? (
                <>
                  下次复习：{" "}
                  <span className="font-medium text-text">
                    {new Date(app.review.due).toLocaleDateString("zh-CN")}
                  </span>
                  {app.review.scheduledDays > 0 &&
                    `（${app.review.scheduledDays} 天后）`}
                </>
              ) : (
                "尚未开始学习"
              )}
            </div>
            <Link href="/review">
              <Button size="sm" variant="secondary">
                去复习
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
