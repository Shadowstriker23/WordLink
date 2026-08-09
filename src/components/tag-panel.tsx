"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTagPanel } from "@/lib/tag-panel-context";
import { Badge } from "@/components/ui/badge";
import { WordAudio } from "@/components/word-audio";
import { Loader2, X, Tag as TagIcon } from "lucide-react";

interface DictMeaning {
  pos: string;
  meanings: string[];
}

interface PanelCardData {
  dict: {
    word: string;
    phonetic: string;
    meanings: DictMeaning[];
  } | null;
  app: {
    id: string;
    text: string;
    tags: { id: string; name: string; type: string }[];
    relationships: {
      type: string;
      word: string;
      wordId: string;
      description?: string;
    }[];
  } | null;
  sharedMeaningWords: { id: string; text: string }[];
}

interface TagInfo {
  tag: { name: string; type: string; count: number; description?: string }[] | null;
  words: { id: string; text: string; meaning: string }[];
  relatedTags: { name: string; type: string; count: number }[];
}

interface AllTags {
  tags: { name: string; type: string; count: number }[];
}

const TYPE_GROUP: Record<string, string> = {
  ROOT: "词根",
  AFFIX: "词缀",
  MEANING: "意思",
  GRAMMAR: "语法",
  CUSTOM: "自定义",
};

const TYPE_STYLE: Record<string, string> = {
  ROOT: "border-accent/40 bg-accent/10 text-accent",
  AFFIX: "border-purple-400/40 bg-purple-400/10 text-purple-400",
  MEANING: "border-success/40 bg-success/10 text-success",
  GRAMMAR: "border-warning/40 bg-warning/10 text-warning",
  CUSTOM: "border-border bg-surface-2 text-text",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </h4>
      {children}
    </div>
  );
}

function PanelTag({
  name,
  type,
  onClick,
  count,
}: {
  name: string;
  type: string;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-lg font-medium leading-tight transition-transform hover:scale-105 ${TYPE_STYLE[type] ?? TYPE_STYLE.CUSTOM}`}
    >
      {name}
      {count != null && (
        <span className="text-sm font-normal opacity-60">({count})</span>
      )}
    </button>
  );
}

export function TagPanel() {
  const { target, setTarget, setOpen } = useTagPanel();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [card, setCard] = useState<PanelCardData | null>(null);
  const [tagInfo, setTagInfo] = useState<TagInfo | null>(null);
  const [allTags, setAllTags] = useState<AllTags | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setCard(null);
    setTagInfo(null);

    async function load() {
      if (!target) {
        try {
          const res = await fetch("/api/tags");
          const data = await res.json();
          if (!cancelled) setAllTags(data);
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

      try {
        if (target.kind === "word") {
          const res = await fetch(
            `/api/explore/card?word=${encodeURIComponent(target.word)}`
          );
          const data = await res.json();
          if (!cancelled) setCard(data);
        } else {
          const res = await fetch(
            `/api/tags/info?name=${encodeURIComponent(target.name)}`
          );
          const data = await res.json();
          if (!cancelled) setTagInfo(data);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [target]);

  const gotoWord = useCallback(
    (w: string, id?: string) => {
      setTarget({ kind: "word", word: w });
      if (id) {
        router.push(`/words/${id}`);
      } else {
        router.push(`/explore?word=${encodeURIComponent(w)}`);
      }
    },
    [router, setTarget]
  );

  const gotoTag = useCallback(
    (name: string, type?: string) => {
      setTarget({ kind: "tag", name, type });
      router.push(`/tags/${encodeURIComponent(name)}`);
    },
    [router, setTarget]
  );

  const hideMeanings = target?.kind === "word" && target.hideMeanings === true;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <TagIcon className="h-4 w-4 text-primary" />
          标签面板
        </span>
        <button
          onClick={() => setOpen(false)}
          className="text-muted hover:text-text"
          title="收起标签面板"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {loading && (
          <div className="flex items-center justify-center py-16 text-muted">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}

        {/* 单词上下文 */}
        {!loading && target?.kind === "word" && card && (
          <>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-primary">
                {card.dict?.word ?? card.app?.text ?? target.word}
              </h3>
              <WordAudio
                word={card.dict?.word ?? card.app?.text ?? target.word}
              />
            </div>
            {card.dict?.phonetic && (
              <p className="-mt-2 text-sm text-muted">{card.dict.phonetic}</p>
            )}

            {(() => {
              const roots = card.app?.tags.filter(
                (t) => t.type === "ROOT" || t.type === "AFFIX"
              ) ?? [];
              if (roots.length)
                return (
                  <Section title="词根词缀">
                    <div className="flex flex-wrap gap-2">
                      {roots.map((t) => (
                        <PanelTag
                          key={t.id}
                          name={t.name}
                          type={t.type}
                          onClick={() => gotoTag(t.name, t.type)}
                        />
                      ))}
                    </div>
                  </Section>
                );
              return null;
            })()}

            {!hideMeanings && (
              <Section title="意思">
                <div className="flex flex-wrap gap-2">
                  {card.app?.tags
                    .filter((t) => t.type === "MEANING")
                    .map((t) => (
                      <PanelTag
                        key={t.id}
                        name={t.name}
                        type={t.type}
                        onClick={() => gotoTag(t.name, t.type)}
                      />
                    ))}
                  {card.dict?.meanings.map((m, i) =>
                    m.meanings.map((meaning, j) => (
                      <PanelTag
                        key={`${i}-${j}`}
                        name={meaning}
                        type="MEANING"
                        onClick={() => gotoTag(`意思:${meaning}`)}
                      />
                    ))
                  )}
                </div>
              </Section>
            )}

            <Section title="词性">
              <div className="flex flex-wrap gap-2">
                {card.app?.tags
                  .filter((t) => t.type === "GRAMMAR")
                  .map((t) => (
                    <PanelTag
                      key={t.id}
                      name={t.name}
                      type={t.type}
                      onClick={() => gotoTag(t.name, t.type)}
                    />
                  ))}
                {card.dict?.meanings.map((m, i) =>
                  m.pos ? (
                    <PanelTag
                      key={`pos-${i}`}
                      name={m.pos}
                      type="GRAMMAR"
                      onClick={() => gotoTag(m.pos, "GRAMMAR")}
                    />
                  ) : null
                )}
              </div>
            </Section>

            {!hideMeanings &&
              (() => {
                const syn = new Map<string, { text: string; id?: string }>();
                card.sharedMeaningWords.forEach((w) =>
                  syn.set(w.text, { text: w.text, id: w.id })
                );
                card.app?.relationships
                  .filter((r) => r.type === "SYNONYM")
                  .forEach((r) =>
                    syn.set(r.word, { text: r.word, id: r.wordId })
                  );
                if (!syn.size) return null;
                return (
                  <Section title="同义词">
                    <div className="flex flex-wrap gap-2">
                      {[...syn.values()].map((w) => (
                        <PanelTag
                          key={w.text}
                          name={w.text}
                          type="MEANING"
                          onClick={() => gotoWord(w.text, w.id)}
                        />
                      ))}
                    </div>
                  </Section>
                );
              })()}

            {!hideMeanings &&
              (() => {
                const ant = card.app?.relationships.filter(
                  (r) => r.type === "ANTONYM"
                );
                if (!ant?.length) return null;
                return (
                  <Section title="反义词">
                    <div className="flex flex-wrap gap-2">
                      {ant.map((r, i) => (
                        <PanelTag
                          key={i}
                          name={r.word}
                          type="CUSTOM"
                          onClick={() => gotoWord(r.word, r.wordId)}
                        />
                      ))}
                    </div>
                  </Section>
                );
              })()}
          </>
        )}

        {/* tag 上下文 */}
        {!loading && target?.kind === "tag" && tagInfo && (
          <>
            <h3 className="text-lg font-bold break-all text-primary">
              {target.name}
            </h3>
            {tagInfo.tag?.find((t) => t.description)?.description && (
              <p className="rounded-lg border border-accent/20 bg-accent/5 px-3 py-2 text-sm text-accent">
                {tagInfo.tag.find((t) => t.description)!.description}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {tagInfo.tag?.map((t) => (
                <Badge key={t.type} variant="accent">
                  {TYPE_GROUP[t.type] ?? t.type}
                  {t.count > 0 ? ` · ${t.count}词` : ""}
                </Badge>
              ))}
            </div>

            {tagInfo.words.length > 0 && (
              <Section title="该标签下词语">
                <div className="flex flex-wrap gap-2">
                  {tagInfo.words.map((w) => (
                    <PanelTag
                      key={w.id}
                      name={w.text}
                      type="CUSTOM"
                      onClick={() => gotoWord(w.text, w.id)}
                    />
                  ))}
                </div>
              </Section>
            )}

            {tagInfo.relatedTags.length > 0 && (
              <Section title="相关标签">
                <div className="flex flex-wrap gap-2">
                  {tagInfo.relatedTags.map((t) => (
                    <PanelTag
                      key={t.name + t.type}
                      name={t.name}
                      type={t.type}
                      count={t.count}
                      onClick={() => gotoTag(t.name, t.type)}
                    />
                  ))}
                </div>
              </Section>
            )}
          </>
        )}

        {/* 默认：全部标签浏览器 */}
        {!loading && !target && allTags && (
          <>
            {(["ROOT", "AFFIX", "MEANING", "GRAMMAR", "CUSTOM"] as const)
              .map((type) => {
                const list = allTags.tags.filter((t) => t.type === type);
                if (!list.length) return null;
                return (
                  <Section key={type} title={TYPE_GROUP[type]}>
                    <div className="flex flex-wrap gap-2">
                      {list.slice(0, 20).map((t) => (
                        <PanelTag
                          key={t.name + t.type}
                          name={t.name}
                          type={t.type}
                          count={t.count}
                          onClick={() => gotoTag(t.name, t.type)}
                        />
                      ))}
                    </div>
                  </Section>
                );
              })
              .filter(Boolean)}
          </>
        )}
      </div>
    </div>
  );
}
