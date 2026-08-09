"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { TagBadge } from "@/components/ui/badge";
import {
  Loader2,
  Sparkles,
  Upload,
  Camera,
  Image as ImageIcon,
  ScanLine,
} from "lucide-react";

interface ProcessedWord {
  id: string;
  text: string;
  meaning: string;
  tags: { name: string; type: string }[];
}

const TAG_TYPE_LABEL: Record<string, string> = {
  ROOT: "词根",
  AFFIX: "词缀",
  MEANING: "意思",
  GRAMMAR: "语法",
  CUSTOM: "自定义",
};

export default function ImportPage() {
  const [mode, setMode] = useState<"manual" | "ocr">("manual");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<ProcessedWord[]>([]);
  const [image, setImage] = useState<{ url: string; name: string } | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleProcess = async () => {
    const words = text
      .split("\n")
      .map((w) => w.trim())
      .filter((w) => /^[a-zA-Z][a-zA-Z\s\-']+$/.test(w))
      .map((w) => w.split(/\s+/)[0]);

    if (!words.length) {
      setError("没有识别到有效英文单词，请检查识别结果或手动修改");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/import/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "处理失败");
      setResults(data.words);
    } catch (e) {
      setError(e instanceof Error ? e.message : "处理失败");
    } finally {
      setLoading(false);
    }
  };

  const onFile = async (file: File) => {
    setOcrLoading(true);
    setError("");
    setImage({ url: URL.createObjectURL(file), name: file.name });
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch("/api/import/ocr", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "识别失败");
      setOcrText(data.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "识别失败");
    } finally {
      setOcrLoading(false);
    }
  };

  const useOcrForAnalysis = useCallback(() => {
    setText(ocrText);
    setMode("manual");
  }, [ocrText]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">导入单词</h1>
        <p className="text-sm text-muted">
          AI 自动分析词根词缀、意思分组与语法类型
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          variant={mode === "manual" ? "primary" : "secondary"}
          onClick={() => setMode("manual")}
        >
          <Upload className="h-4 w-4" />
          手动录入
        </Button>
        <Button
          variant={mode === "ocr" ? "primary" : "secondary"}
          onClick={() => setMode("ocr")}
        >
          <Camera className="h-4 w-4" />
          拍照识别
        </Button>
      </div>

      {mode === "manual" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              单词录入
            </CardTitle>
            <CardDescription>每行一个单词/短语，AI 会自动分析</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"spectacle\ninspect\nreceive\nobstacle"}
              className="min-h-[160px] font-mono"
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex items-center gap-3">
              <Button onClick={handleProcess} disabled={loading || !text.trim()}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {loading ? "AI 分析中..." : "AI 分析并导入"}
              </Button>
              {text.trim() && (
                <span className="text-sm text-muted">
                  {text.split("\n").filter((w) => w.trim()).length} 行输入
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScanLine className="h-4 w-4 text-primary" />
              拍照 / 上传图片
            </CardTitle>
            <CardDescription>
              支持印刷体和部分手写体，识别结果可编辑
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-surface-2/50 p-10 text-center transition-colors hover:border-primary/50"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) onFile(f);
              }}
            >
              <ImageIcon className="h-8 w-8 text-muted" />
              <p className="text-sm text-muted">
                拖拽图片到这里，或
                <button
                  onClick={() => fileRef.current?.click()}
                  className="mx-1 text-primary hover:underline"
                >
                  点击选择
                </button>
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                }}
              />
            </div>

            {image && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="overflow-hidden rounded-lg border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.url}
                    alt={image.name}
                    className="max-h-64 w-full object-contain"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {ocrLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        识别中...
                      </>
                    ) : (
                      <span className="text-success">识别完成</span>
                    )}
                  </div>
                  <Textarea
                    value={ocrText}
                    onChange={(e) => setOcrText(e.target.value)}
                    className="min-h-[200px] font-mono text-sm"
                    placeholder="识别结果将显示在这里，可直接编辑修正..."
                  />
                </div>
              </div>
            )}

            {error && <p className="text-sm text-danger">{error}</p>}

            {ocrText.trim() && (
              <Button onClick={useOcrForAnalysis} className="w-full">
                <Sparkles className="h-4 w-4" />
                用识别结果去 AI 分析
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>导入结果</CardTitle>
            <CardDescription>共导入 {results.length} 个词条</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {results.map((w) => (
              <div
                key={w.id}
                className="rounded-lg border border-border bg-surface-2/50 p-3"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-semibold">{w.text}</span>
                  <span className="text-sm text-muted">{w.meaning}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {w.tags.map((t) => (
                    <TagBadge key={t.name} type={t.type}>
                      {TAG_TYPE_LABEL[t.type] ?? t.type}:{t.name}
                    </TagBadge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
