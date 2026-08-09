"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TagBadge, Badge } from "@/components/ui/badge";
import { WordAudio } from "@/components/word-audio";
import { useTagPanel } from "@/lib/tag-panel-context";
import { Loader2, RotateCw, Brain } from "lucide-react";

interface DictMeaning {
  pos: string;
  meanings: string[];
}

interface ReviewItem {
  wordId: string;
  word: string;
  meaning: string;
  pronunciation?: string;
  exampleSentence?: string;
  tags: { name: string; type: string }[];
  dictMeanings: DictMeaning[];
  state: number;
  scheduledDays: number;
  stability: number;
  due: string;
}

const RATINGS = [
  { value: 1, label: "忘记", color: "text-danger", desc: "完全没记住" },
  { value: 2, label: "困难", color: "text-warning", desc: "想很久才想起" },
  { value: 3, label: "记得", color: "text-accent", desc: "正常答对" },
  { value: 4, label: "简单", color: "text-success", desc: "秒答" },
];

export default function ReviewPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const startRef = useRef<number>(Date.now());
  const { setTarget } = useTagPanel();

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/review/next");
    const data = await res.json();
    setItems(data.reviews);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const current = items[index];

  // 当前复习词同步到右栏标签面板（复习时隐藏意思，避免剧透）
  useEffect(() => {
    if (current) {
      setTarget({ kind: "word", word: current.word, hideMeanings: true });
    }
  }, [current, setTarget]);

  const grade = async (rating: number) => {
    if (!current || submitting) return;
    setSubmitting(true);
    const durationMs = Date.now() - startRef.current;
    try {
      await fetch("/api/review/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wordId: current.wordId,
          rating,
          durationMs,
        }),
      });
    } finally {
      setSubmitting(false);
      setRevealed(false);
      setIndex((i) => i + 1);
      startRef.current = Date.now();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (items.length === 0 || !current) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">每日复习</h1>
        <Card className="p-16 text-center">
          <h2 className="text-xl font-semibold text-success">全部复习完成！</h2>
          <p className="mt-2 text-sm text-muted">
            今天没有到期的单词。保持节奏，明天再来。
          </p>
          <Button className="mt-6" variant="secondary" onClick={load}>
            <RotateCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
        </Card>
      </div>
    );
  }

  const roots = current.tags.filter(
    (t) => t.type === "ROOT" || t.type === "AFFIX"
  );
  const meanings = current.tags.filter((t) => t.type === "MEANING");
  const grammar = current.tags.filter((t) => t.type === "GRAMMAR");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">每日复习</h1>
        <span className="text-sm text-muted">
          {index + 1} / {items.length}
        </span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full bg-primary transition-all"
          style={{
            width: `${((index + (revealed ? 0.5 : 0)) / items.length) * 100}%`,
          }}
        />
      </div>

      <Card className="p-6">
        <div className="space-y-5">
          {/* 单词头部 */}
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-3">
              <h2 className="text-4xl font-bold text-primary">{current.word}</h2>
              {current.pronunciation && (
                <span className="text-lg text-muted">{current.pronunciation}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <WordAudio word={current.word} />
              <Badge variant={current.state === 0 ? "accent" : "default"}>
                {current.state === 0
                  ? "新单词"
                  : current.state === 3
                    ? "遗忘重学"
                    : "复习"}
              </Badge>
            </div>
          </div>

          {/* 复习信息 */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
            <span className="flex items-center gap-1">
              <Brain className="h-3.5 w-3.5" />
              稳定性 {(current.stability ?? 0).toFixed(1)} 天
            </span>
            {current.scheduledDays > 0 && (
              <span>预计 {current.scheduledDays} 天后再复习</span>
            )}
            <span>
              到期 {new Date(current.due).toLocaleDateString("zh-CN")}
            </span>
          </div>

          {/* 释义（未揭晓时隐藏） */}
          {revealed ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-surface-2/40 p-4">
                <p className="text-xl font-medium text-text">{current.meaning}</p>

                {/* 分词性释义 */}
                {current.dictMeanings.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {current.dictMeanings.map((m, i) => (
                      <div key={i} className="flex flex-wrap items-start gap-2">
                        {m.pos && <Badge variant="warning">{m.pos}</Badge>}
                        <div className="flex flex-wrap gap-1.5">
                          {m.meanings.map((meaning, j) => (
                            <span
                              key={j}
                              className="rounded-md bg-success/10 border border-success/20 px-2 py-0.5 text-sm text-success"
                            >
                              {meaning}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 词根词缀 */}
              {roots.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted">词根词缀</span>
                  {roots.map((t, i) => (
                    <TagBadge key={i} type={t.type}>{t.name}</TagBadge>
                  ))}
                </div>
              )}

              {/* 意思/语法标签 */}
              {(meanings.length > 0 || grammar.length > 0) && (
                <div className="flex flex-wrap gap-1.5">
                  {[...meanings, ...grammar].map((t, i) => (
                    <TagBadge key={i} type={t.type}>{t.name}</TagBadge>
                  ))}
                </div>
              )}

              {current.exampleSentence && (
                <p className="rounded-lg border border-border bg-surface-2/40 p-3 text-sm italic text-muted">
                  {current.exampleSentence}
                </p>
              )}

              <div className="grid grid-cols-4 gap-2 pt-2">
                {RATINGS.map((r) => (
                  <Button
                    key={r.value}
                    variant="secondary"
                    disabled={submitting}
                    onClick={() => grade(r.value)}
                    className="flex flex-col items-center gap-1 py-3"
                  >
                    <span className={`font-semibold ${r.color}`}>{r.label}</span>
                    <span className="text-[10px] text-muted">{r.desc}</span>
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <Button size="lg" onClick={() => setRevealed(true)} className="w-full">
              显示释义
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
