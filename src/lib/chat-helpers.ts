import OpenAI from "openai";

// ── Shared AI client ─────────────────────────────────────────
let _ai: OpenAI | null = null;
export function getAI(): OpenAI {
  if (!_ai) {
    _ai = new OpenAI({
      baseURL: "https://ollama.com/v1/",
      apiKey: process.env.OLLAMA_API_KEY || "",
    });
  }
  return _ai;
}

export const MODEL = "qwen3.5:32b-cloud";
export const MODEL_FAST = "qwen3.5:14b-cloud";
