import { NextRequest, NextResponse } from "next/server";
import { createWorker, type Worker } from "tesseract.js";
import { getSettings } from "../../settings/route";

let workerPromise: Promise<Worker> | null = null;

async function getWorker(lang: string) {
  if (!workerPromise) {
    const langPath =
      process.env.TESSDATA_MIRROR ?? "https://tessdata.projectnaptha.com/4.0.0";
    workerPromise = (async () => {
      const worker = await createWorker(lang, 1, {
        langPath,
        logger: () => undefined,
      });
      return worker;
    })();
  }
  return workerPromise;
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("image") as File | null;
  if (!file) {
    return NextResponse.json({ error: "请上传图片" }, { status: 400 });
  }

  const settings = await getSettings();
  const lang = settings.ocrLanguage ?? "eng+chi_sim";

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const worker = await getWorker(lang);
    const { data } = await worker.recognize(buffer);
    return NextResponse.json({
      text: data.text.trim(),
      confidence: Math.round((data.confidence ?? 0) * 10) / 10,
    });
  } catch (e) {
    const msg =
      e instanceof Error
        ? `OCR 失败（可能需要下载语言包）: ${e.message}`
        : "OCR 失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
