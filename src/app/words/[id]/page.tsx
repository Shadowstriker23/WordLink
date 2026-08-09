import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { lookupWord } from "@/lib/dict";
import { Card } from "@/components/ui/card";
import { SetPanel } from "@/components/set-panel";
import { WordAudio } from "@/components/word-audio";
import { getRetrievability, reviewToCard } from "@/lib/fsrs";
import { formatDate } from "@/lib/utils";
import { Brain, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

const REL_LABEL: Record<string, string> = {
  SYNONYM: "同义词",
  ANTONYM: "反义词",
  SAME_ROOT: "同词根",
  SAME_AFFIX: "同词缀",
  SAME_GRAMMAR: "同语法",
  CUSTOM: "自定义",
};

export default async function WordDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const word = await prisma.word.findUnique({
    where: { id },
    include: {
      tags: { include: { tag: true } },
      relationships: {
        include: { targetWord: { select: { id: true, text: true } } },
      },
      relatedTo: {
        include: { sourceWord: { select: { id: true, text: true } } },
      },
      review: true,
    },
  });

  if (!word) notFound();

  const dict = await lookupWord(word.text);
  const phonetic = word.pronunciation ?? dict?.phonetic ?? null;
  const meanings = dict?.meanings.length ? dict.meanings : null;
  const example = word.exampleSentence ?? dict?.example ?? null;

  const retrievability = word.review
    ? getRetrievability(reviewToCard(word.review))
    : null;

  const allRelationships = [
    ...word.relationships.map((r) => ({
      type: r.type,
      description: r.description,
      word: r.targetWord,
    })),
    ...word.relatedTo.map((r) => ({
      type: r.type,
      description: r.description,
      word: r.sourceWord,
    })),
  ];

  return (
    <div className="space-y-8">
      <SetPanel target={{ kind: "word", word: word.text }} />
      <Link href="/words" className="text-sm text-muted hover:text-text">
        ← 返回单词库
      </Link>

      {/* 大字单词 + 小号音标 */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-6xl font-bold leading-none text-primary">
            {word.text}
          </h1>
          <div className="mt-3 flex items-center gap-3">
            {phonetic && (
              <span className="text-xl text-muted">{phonetic}</span>
            )}
            <WordAudio word={word.text} autoPlay size="h-6 w-6" />
          </div>
        </div>
        <div className="text-right text-sm text-muted">
          <p>收录于 {formatDate(word.createdAt)}</p>
          {word.review && retrievability !== null && (
            <p className="mt-1 flex items-center justify-end gap-1">
              <Brain className="h-4 w-4 text-accent" />
              记忆强度
              <span className="font-semibold text-accent">
                {(retrievability * 100).toFixed(0)}%
              </span>
            </p>
          )}
        </div>
      </div>

      {/* 词性分段的释义大板块 */}
      <section className="space-y-6">
        {meanings ? (
          meanings.map((m, i) => (
            <div key={i} className="border-l-4 border-primary/40 pl-6">
              <h2 className="mb-3 text-2xl font-bold text-warning">{m.pos}</h2>
              <ul className="space-y-2">
                {m.meanings.map((meaning, j) => (
                  <li key={j} className="flex items-baseline gap-3 text-2xl text-text">
                    <span className="text-base text-muted">
                      {j + 1}.
                    </span>
                    <span>{meaning}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <p className="text-2xl text-text">{word.meaning}</p>
        )}
      </section>

      {/* 例句 */}
      {example && (
        <Card className="p-6">
          <p className="text-lg italic leading-relaxed text-text">{example}</p>
        </Card>
      )}

      {/* 关联词 */}
      <Card className="p-6">
        <h2 className="mb-4 text-xl font-semibold">关联词</h2>
        {allRelationships.length === 0 ? (
          <p className="text-muted">
            暂无关联。点右侧标签面板里的词根/词缀/意思标签，可以找到相关词汇。
          </p>
        ) : (
          <ul className="space-y-3">
            {allRelationships.map((r, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div>
                  <Link
                    href={`/words/${r.word.id}`}
                    className="text-lg font-medium text-primary hover:underline"
                  >
                    {r.word.text}
                  </Link>
                  <span className="ml-4 text-muted">{REL_LABEL[r.type]}</span>
                  {r.description && (
                    <span className="ml-4 text-muted">{r.description}</span>
                  )}
                </div>
                <Link href={`/words/${r.word.id}`}>
                  <ExternalLink className="h-4 w-4 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
