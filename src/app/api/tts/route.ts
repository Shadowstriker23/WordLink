import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const PROVIDERS = [
  {
    name: "youdao",
    build: (word: string, type: string) =>
      `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${type === "uk" ? 1 : 2}`,
  },
  {
    name: "baidu",
    build: (word: string) =>
      `https://fanyi.baidu.com/gettts?lan=en&text=${encodeURIComponent(word)}&spd=3&source=web`,
  },
  {
    name: "google",
    build: (word: string) =>
      `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&q=${encodeURIComponent(word)}&tl=en`,
  },
];

export async function GET(req: NextRequest) {
  const word = req.nextUrl.searchParams.get("word")?.trim();
  const type = req.nextUrl.searchParams.get("type") ?? "us"; // us / uk

  if (!word) {
    return new Response("missing word", { status: 400 });
  }

  for (const provider of PROVIDERS) {
    try {
      const res = await fetch(provider.build(word, type), {
        cache: "no-store",
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const contentType = res.headers.get("content-type") ?? "audio/mpeg";
      const buffer = await res.arrayBuffer();
      // 部分接口返回的音频过小可能无效
      if (buffer.byteLength < 1024) continue;
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400",
        },
      });
    } catch {
      /* try next provider */
    }
  }

  return new Response("tts unavailable", { status: 502 });
}
