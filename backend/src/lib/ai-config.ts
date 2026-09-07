import OpenAI from "openai";

import { env } from "../config/env";

const baseUrls = {
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai/",

  openrouter: "https://openrouter.ai/api/v1",

  openai: "https://api.openai.com/v1",
} as const;

export const ai = new OpenAI({
  apiKey: env.AI_API_KEY,

  baseURL: baseUrls[env.AI_PROVIDER],

  timeout: 15_000,

  maxRetries: 0,
});
