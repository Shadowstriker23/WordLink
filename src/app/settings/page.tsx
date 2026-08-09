"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Loader2, CheckCircle2 } from "lucide-react";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("deepseek-chat");
  const [baseUrl, setBaseUrl] = useState("https://api.deepseek.com");
  const [ocrLanguage, setOcrLanguage] = useState("eng+chi_sim");
  const [hasKey, setHasKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [testResult, setTestResult] = useState<"ok" | "fail" | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setModel(data.settings.aiModel);
        setBaseUrl(data.settings.aiBaseUrl);
        setOcrLanguage(data.settings.ocrLanguage);
        setHasKey(data.settings.hasApiKey);
        setLoading(false);
      });
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deepseekApiKey: apiKey,
          aiModel: model,
          aiBaseUrl: baseUrl,
          ocrLanguage,
        }),
      });
      if (res.ok) {
        setHasKey(true);
        setMessage("已保存");
      }
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings", { method: "POST" });
      setTestResult(res.ok ? "ok" : "fail");
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">设置</h1>
        <p className="text-sm text-muted">配置 AI 服务</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI 配置</CardTitle>
          <CardDescription>
            用于自动分析词根词缀、生成标签与单词关系
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>API Key</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                hasKey ? "已配置（输入新值可覆盖）" : "sk-..."
              }
            />
            <p className="text-xs text-muted">
              也可以直接用环境变量 DEEPSEEK_API_KEY 配置
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>模型</Label>
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="deepseek-chat"
              />
            </div>
            <div className="space-y-2">
              <Label>Base URL</Label>
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.deepseek.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>OCR 语言</Label>
            <Input
              value={ocrLanguage}
              onChange={(e) => setOcrLanguage(e.target.value)}
              placeholder="eng+chi_sim"
            />
            <p className="text-xs text-muted">
              英文 eng、中文简体 chi_sim，可组合如 eng+chi_sim
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              保存
            </Button>
            <Button variant="secondary" onClick={test} disabled={testing || !hasKey}>
              {testing && <Loader2 className="h-4 w-4 animate-spin" />}
              测试连接
            </Button>
            {testResult === "ok" && (
              <span className="flex items-center gap-1 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" /> 连接正常
              </span>
            )}
            {testResult === "fail" && (
              <span className="text-sm text-danger">连接失败，请检查 Key</span>
            )}
            {message && <span className="text-sm text-success">{message}</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>关于</CardTitle>
          <CardDescription>WordLink v0.1</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted">
          数据存储在本地 SQLite 数据库 (dev.db)，可随时备份该文件。
        </CardContent>
      </Card>
    </div>
  );
}
