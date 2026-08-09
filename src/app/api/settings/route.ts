import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { testAiConnection } from "@/lib/ai";

const SETTINGS_FILE = path.join(process.cwd(), "data", "settings.json");

interface Settings {
  deepseekApiKey?: string;
  aiModel?: string;
  aiBaseUrl?: string;
  ocrLanguage?: string;
}

export async function getSettings(): Promise<Settings> {
  try {
    const raw = await readFile(SETTINGS_FILE, "utf-8");
    return JSON.parse(raw) as Settings;
  } catch {
    return {};
  }
}

async function saveSettings(s: Settings) {
  await mkdir(path.dirname(SETTINGS_FILE), { recursive: true });
  await writeFile(SETTINGS_FILE, JSON.stringify(s, null, 2), "utf-8");
}

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json({
    settings: {
      aiModel: settings.aiModel ?? "deepseek-chat",
      aiBaseUrl: settings.aiBaseUrl ?? "https://api.deepseek.com",
      ocrLanguage: settings.ocrLanguage ?? "eng+chi_sim",
      hasApiKey: Boolean(
        settings.deepseekApiKey || process.env.DEEPSEEK_API_KEY
      ),
    },
  });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const current = await getSettings();

  const next: Settings = {
    ...current,
    deepseekApiKey: body.deepseekApiKey ?? current.deepseekApiKey,
    aiModel: body.aiModel ?? current.aiModel ?? "deepseek-chat",
    aiBaseUrl: body.aiBaseUrl ?? current.aiBaseUrl ?? "https://api.deepseek.com",
    ocrLanguage: body.ocrLanguage ?? current.ocrLanguage ?? "eng+chi_sim",
  };

  if (body.deepseekApiKey === "") delete next.deepseekApiKey;
  await saveSettings(next);
  return NextResponse.json({ ok: true });
}

export async function POST() {
  const settings = await getSettings();
  const key = settings.deepseekApiKey || process.env.DEEPSEEK_API_KEY;
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "未配置 API Key" },
      { status: 400 }
    );
  }
  try {
    await testAiConnection();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "连接失败",
      },
      { status: 500 }
    );
  }
}
