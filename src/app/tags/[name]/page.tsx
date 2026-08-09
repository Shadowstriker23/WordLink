import Link from "next/link";
import { prisma } from "@/lib/db";
import { searchByTranslation } from "@/lib/dict";
import { getAffixDescription } from "@/lib/affix-desc";
import { Card } from "@/components/ui/card";
import { TagBadge, Badge } from "@/components/ui/badge";
import { SetPanel } from "@/components/set-panel";
import { formatDate } from "@/lib/utils";
import { Hash, Info } from "lucide-react";
import type { DictSuggestion } from "@/lib/dict";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  ROOT: "词根",
  AFFIX: "词缀",
  MEANING: "意思",
  GRAMMAR: "语法",
  CUSTOM: "自定义",
};

export default async function TagPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const decoded = decodeURIComponent(name);

  const tags = await prisma.tag.findMany({
    where: { name: decoded },
    orderBy: { type: "asc" },
    include: {
      words: {
        orderBy: { word: { createdAt: "desc" } },
        take: 200,
        include: {
          word: {
            include: { tags: { include: { tag: true } }, review: true },
          },
        },
      },
    },
  });

  // 词义标签的词典兜底：搜翻译里含该意思的词（同义词）
  const isMeaningTag = decoded.startsWith("意思:");
  const meaningText = isMeaningTag ? decoded.slice("意思:".length) : "";
  let dictWords: DictSuggestion[] = [];
  if (isMeaningTag && meaningText) {
    dictWords = await searchByTranslation(meaningText, 40);
  }

  const words = tags
    .flatMap((t) => t.words.map((w) => ({ ...w, tagType: t.type })))
    .filter((w, i, arr) => arr.findIndex((x) => x.wordId === w.wordId) === i);

  const wordSet = new Set(words.map((w) => w.word.text.toLowerCase()));
  const dictWordsFiltered = dictWords.filter(
    (d) => !wordSet.has(d.word.toLowerCase())
  );

  // 词根/词缀的本意解释（优先库里存的，否则查对照表）
  const description =
    tags.find((t) => t.description)?.description ??
    getAffixDescription(decoded) ??
    null;

  return (
    <div className="space-y-5">
      <SetPanel target={{ kind: "tag", name: decoded }} />

      <div>
        <div className="flex items-center gap-2">
          <Hash className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold break-all">{decoded}</h1>
        </div>
        {description && (
          <p className="mt-2 flex items-start gap-2 rounded-lg border border-accent/20 bg-accent/5 px-3 py-2 text-base text-accent">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            {description}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          {tags.map((t) => (
            <Badge key={t.id} variant="accent">
              {TYPE_LABEL[t.type] ?? t.type}
            </Badge>
          ))}
          <span className="text-muted">
            词库 {words.length} 个词
            {isMeaningTag && (
              <span className="ml-1"> · 词典 {dictWordsFiltered.length} 个候选</span>
            )}
          </span>
        </div>
      </div>

      {tags.length === 0 && words.length === 0 && (
        <Card className="p-5 text-sm text-muted">
          该标签尚未收录于词库。
          {isMeaningTag
            ? "下面是从词典中找到的释义含「" +
              meaningText +
              "」的单词，点击可查看并收录。"
            : "点击右侧标签面板中的词根/词缀/意思标签，或去标签检索页搜索。"}
        </Card>
      )}

      {words.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted">词库中的词</h3>
          {words.map((w) => (
            <Link
              key={w.wordId}
              href={`/words/${w.word.id}`}
            >
              <Card className="flex items-center justify-between gap-4 p-4 transition-shadow hover:shadow-md">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-primary">
                      {w.word.text}
                    </span>
                    <span className="truncate text-sm text-muted">
                      {w.word.meaning}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {w.word.tags.slice(0, 6).map(({ tag }) => (
                      <TagBadge key={tag.id} type={tag.type} className="text-[11px]">
                        {tag.name}
                      </TagBadge>
                    ))}
                  </div>
                </div>
                <div className="shrink-0 text-right text-xs text-muted">
                  <span className="block">
                    {w.word.review && w.word.review.state > 0
                      ? "学习中"
                      : "待学习"}
                  </span>
                  <span>{formatDate(w.word.createdAt)} 收录</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {dictWordsFiltered.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted">
            词典中的相关词（{dictWordsFiltered.length}）
          </h3>
          <div className="flex flex-wrap gap-2">
            {dictWordsFiltered.map((d) => (
              <Link
                key={d.word}
                href={`/explore?word=${encodeURIComponent(d.word)}`}
              >
                <Card className="flex items-center gap-2 px-3 py-2 transition-shadow hover:shadow-md">
                  <span className="font-medium text-primary">{d.word}</span>
                  <span className="max-w-[180px] truncate text-xs text-muted">
                    {d.translation?.split("\n")[0]}
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
