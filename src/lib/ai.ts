import OpenAI from "openai";
import { AiProcessBatchSchema } from "./types";
import { getSettings } from "@/app/api/settings/route";

const defaultModel = process.env.AI_MODEL ?? "deepseek-chat";
const defaultBaseUrl = process.env.AI_BASE_URL ?? "https://api.deepseek.com";

async function getClient() {
  const settings = await getSettings();
  const apiKey =
    settings.deepseekApiKey ?? process.env.DEEPSEEK_API_KEY ?? "";
  return new OpenAI({
    baseURL: settings.aiBaseUrl ?? defaultBaseUrl,
    apiKey,
  });
}

const SYSTEM_PROMPT = `你是英语学习助手。请分析用户提供的英语单词/短语/语法点，输出结构化 JSON。

输出必须是一个 JSON 对象，唯一顶层字段是 "words"，其值为数组，数组每一项对应一个输入的词条：
{
  "words": [
    {
      "word": "obvious",
      "meaning": "明显的",
      "pronunciation": "/ˈɒbviəs/",
      "exampleSentence": "It is obvious that he is lying.",
      "tags": [
        { "name": "词根:vid", "type": "ROOT", "description": "vid = 看，看见" },
        { "name": "词缀:-ous", "type": "AFFIX", "description": "-ous = 形容词后缀，表示“充满…的”" },
        { "name": "形容词", "type": "GRAMMAR" },
        { "name": "意思:明显", "type": "MEANING" }
      ],
      "relationships": [],
      "sameMeaningWords": ["clear", "evident", "apparent"]
    }
  ]
}

对每个词条，你需要：
1. word: 原词（保持小写）
2. meaning: 中文释义
3. pronunciation: 音标
4. exampleSentence: 一个简单例句
5. tags: 标签数组，每项 { name, type, description? }
   - type 取 ROOT(词根) / AFFIX(词缀) / MEANING(意思分组，如"意思:看") / GRAMMAR(语法，如"虚拟语气") / CUSTOM
   - 词根/词缀可能有多个，分别列出
   - 重要：当 type 为 ROOT 或 AFFIX 时，必须给出 description，用一两句话解释该词根/词缀的本意及来源含义（如 "spect = 看，注视" 或 "-tion = 名词后缀，表行为、状态或结果"）
   - 其余 type 的 tag 不需要 description
6. relationships: 与词库中已存在单词的关系数组，每项 { word, type, description }
   - type 取 SYNONYM(同义) / ANTONYM(反义) / SAME_ROOT(同词根) / SAME_AFFIX(同词缀) / SAME_GRAMMAR(同语法)
   - 只关联真实存在的单词，不要编造
7. sameMeaningWords: 同义词/近义词列表

只返回 JSON，不要任何额外文字。`;

const WRAPPER_KEYS = new Set(["words", "result", "data", "results"]);

/** 容错解析 AI 返回，兼容多种结构 */
function parseAiResponse(content: string) {
  const parsed = JSON.parse(content);

  if (Array.isArray(parsed)) {
    return AiProcessBatchSchema.parse({ words: parsed });
  }

  if (Array.isArray(parsed.words)) {
    return AiProcessBatchSchema.parse({ words: parsed.words });
  }

  if (Array.isArray(parsed.result)) {
    return AiProcessBatchSchema.parse({ words: parsed.result });
  }

  // 兜底：对象直接以单词为键 { "obvious": {...}, "Apparent": {...} }
  const words = Object.entries(parsed)
    .filter(([k]) => !WRAPPER_KEYS.has(k.toLowerCase()) && typeof k === "string")
    .map(([k, v]) => {
      const item = typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
      return { word: k, ...item };
    });

  if (words.length) {
    return AiProcessBatchSchema.parse({ words });
  }

  throw new Error("无法识别的 JSON 结构");
}

export interface AnalyzeOptions {
  words: string[];
  existingWords: string[];
}

export async function analyzeWords({
  words,
  existingWords,
}: AnalyzeOptions) {
  const client = await getClient();
  if (!client.apiKey) {
    throw new Error(
      "未配置 DeepSeek API Key，请到设置页配置或设置 DEEPSEEK_API_KEY 环境变量"
    );
  }

  const existing = existingWords.length
    ? `\n\n【词库中已有单词】\n${existingWords.join(", ")}\n请尽可能将 relationships 关联到这些词。`
    : "";

  const userContent = `请分析以下单词/短语（按行分隔）：\n${words.join("\n")}${existing}`;

  const settings = await getSettings();
  const response = await client.chat.completions.create({
    model: settings.aiModel ?? defaultModel,
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("AI 返回为空");

  try {
    return parseAiResponse(content);
  } catch (e) {
    throw new Error(
      `AI 返回格式无法解析: ${e instanceof Error ? e.message : e}\n原始返回: ${content.slice(0, 300)}`
    );
  }
}

export function testAiConnection() {
  return getClient().then((client) => client.models.list());
}

export async function generateWordRelationships(word: string) {
  const result = await analyzeWords({ words: [word], existingWords: [] });
  return result.words[0];
}

/** 中文 → 英文翻译：返回最常见译法 */
export async function translateChinese(chineseWords: string[]): Promise<Map<string, string>> {
  const client = await getClient();
  if (!client.apiKey) throw new Error("未配置 AI API Key");

  const prompt = `请将以下中文词汇翻译成最常见的英文单词。

输入：
${chineseWords.join("\n")}

输出 JSON 格式：{"result": [{"zh": "中文", "en": "english"}, ...]}

只返回 JSON，不要任何额外文字。`;

  const response = await client.chat.completions.create({
    model: (await getSettings()).aiModel ?? defaultModel,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("翻译返回为空");

  const parsed = JSON.parse(content);
  const result = new Map<string, string>();
  const items = parsed.result ?? parsed.translations ?? [];
  for (const item of items) {
    if (item.zh && item.en) result.set(item.zh, item.en.toLowerCase());
  }
  return result;
}

/** 检测是否含中文 */
export function isChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}
