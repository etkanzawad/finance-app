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

export const MODEL = "kimi-k2.5:cloud";
export const MODEL_FAST = "kimi-k2.5:cloud";
