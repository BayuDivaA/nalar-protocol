import OpenAI from "openai";

import { env } from "../config/env";

const baseUrls: Record<string, string> = {
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai/",
  openrouter: "https://openrouter.ai/api/v1",
  openai: "https://api.openai.com/v1",
};

let _aiClient: OpenAI | null = null;

export function getAiClient(): OpenAI {
  if (!_aiClient) {
    const provider = env.AI_PROVIDER;
    const baseURL = provider && provider in baseUrls ? baseUrls[provider] : undefined;
    _aiClient = new OpenAI({
      apiKey: env.AI_API_KEY || "heuristics-mode",
      baseURL,
      timeout: 15_000,
      maxRetries: 0,
    });
  }
  return _aiClient;
}

export const ai = new Proxy({} as OpenAI, {
  get(_target, prop) {
    const client = getAiClient();
    const val = (client as any)[prop];
    return typeof val === "function" ? val.bind(client) : val;
  },
});
