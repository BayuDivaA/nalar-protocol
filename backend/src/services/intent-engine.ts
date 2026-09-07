import { ai } from "../lib/ai-config";
import { env } from "../config/env";

import { userIntentSchema, type UserIntent } from "../types/intent";
import { parseAIJson } from "../lib/parse-ai-json";

export async function parseUserIntent(userInput: string): Promise<UserIntent> {
  console.log("[AI] Starting intent parsing...");
  console.log("[AI] Input:", userInput);

  try {
    console.log("[AI] Sending request...");

    const response = await ai.chat.completions.create({
      model: env.AI_MODEL,

      temperature: 0,

      messages: [
        {
          role: "system",

          content: `
You are a Web3 transaction intent parser.

Your ONLY job is to understand what
the human intends to do.

You are NOT a security decision maker.

Return ONLY valid JSON.

Required structure:

{
  "action":
    "MINT" |
    "TRANSFER" |
    "SWAP" |
    "APPROVE" |
    "STAKE" |
    "DEPOSIT" |
    "WITHDRAW" |
    "UNKNOWN",

  "quantity": number | null,

  "maxValueNative": string | null,

  "nativeCurrency": "BNB" | null,

  "allowApproval": boolean,

  "targetAddress": string | null,

  "description": string
}

Rules:

1. Never invent an amount.
2. Never invent an address.
3. If the user does not specify a maximum spend,
   use null.
4. If the user wants to mint or buy an NFT and
   did not explicitly request approval,
   allowApproval must be false.
5. If the intent is ambiguous,
   use UNKNOWN.
6. Return JSON only.
`,
        },

        {
          role: "user",
          content: userInput,
        },
      ],
    });

    console.log("[AI] Response received.");

    const raw = response.choices[0]?.message?.content;

    if (!raw) {
      throw new Error("AI returned empty output.");
    }

    console.log("[AI] Raw output:", raw);

    /**
     * Models sometimes wrap JSON in Markdown fences:
     *
     * ```json
     * {...}
     * ```
     *
     * Remove those fences before parsing.
     */
    const cleaned = raw
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    console.log("[AI] Cleaned output:", cleaned);

    const json = parseAIJson(raw);

    const parsed = userIntentSchema.safeParse(json);

    if (!parsed.success) {
      console.error("AI schema error:", parsed.error.flatten());

      throw new Error("AI returned an invalid intent schema.");
    }

    return parsed.data;
  } catch (error) {
    console.error("[AI] Request failed:");
    console.error(error);

    throw error;
  }
}
