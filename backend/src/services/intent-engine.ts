import { ai } from "../lib/ai-config";
import { env } from "../config/env";

import { userIntentSchema, type UserIntent } from "../types/intent";

import { parseAIJson } from "../lib/parse-ai-json";

export function parseIntentHeuristically(input: string): UserIntent {
  const text = input.trim();
  const lower = text.toLowerCase();

  const swapMatch = text.match(/swap\s+([0-9.]+)?\s*([a-zA-Z0-9]+)?\s+(?:to|for)\s+([a-zA-Z0-9]+)/i);
  if (swapMatch) {
    const qty = swapMatch[1] ? parseFloat(swapMatch[1]) : null;
    const tokenIn = swapMatch[2] ? swapMatch[2].toUpperCase() : null;
    const tokenOut = swapMatch[3] ? swapMatch[3].toUpperCase() : null;
    const isNativeIn = tokenIn === "BNB" || tokenIn === "TBNB";
    return {
      action: "SWAP",
      quantity: Number.isNaN(qty) ? null : qty,
      tokenIn,
      tokenOut,
      maxValueNative: isNativeIn && qty ? String(qty) : null,
      nativeCurrency: isNativeIn ? "BNB" : null,
      allowApproval: false,
      targetAddress: null,
      description: text,
    };
  }

  if (lower.includes("swap")) {
    return {
      action: "SWAP",
      quantity: null,
      tokenIn: null,
      tokenOut: null,
      maxValueNative: null,
      nativeCurrency: null,
      allowApproval: false,
      targetAddress: null,
      description: text,
    };
  }

  if (lower.includes("mint")) {
    return {
      action: "MINT",
      quantity: null,
      tokenIn: null,
      tokenOut: null,
      maxValueNative: null,
      nativeCurrency: null,
      allowApproval: false,
      targetAddress: null,
      description: text,
    };
  }

  if (lower.includes("approve")) {
    return {
      action: "APPROVE",
      quantity: null,
      tokenIn: null,
      tokenOut: null,
      maxValueNative: null,
      nativeCurrency: null,
      allowApproval: true,
      targetAddress: null,
      description: text,
    };
  }

  if (lower.includes("transfer") || lower.includes("send")) {
    return {
      action: "TRANSFER",
      quantity: null,
      tokenIn: null,
      tokenOut: null,
      maxValueNative: null,
      nativeCurrency: null,
      allowApproval: false,
      targetAddress: null,
      description: text,
    };
  }

  return {
    action: "UNKNOWN",
    quantity: null,
    tokenIn: null,
    tokenOut: null,
    maxValueNative: null,
    nativeCurrency: null,
    allowApproval: false,
    targetAddress: null,
    description: text,
  };
}

export async function parseUserIntent(userInput: string): Promise<UserIntent> {
  if (env.AI_PROVIDER === "heuristics" || !env.AI_API_KEY) {
    console.log("[Intent] Using heuristic intent parsing (heuristics mode or missing API key)...");
    return parseIntentHeuristically(userInput);
  }

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

  "tokenIn": string | null,

  "tokenOut": string | null,

  "maxValueNative": string | null,

  "nativeCurrency": "BNB" | null,

  "allowApproval": boolean,

  "targetAddress": string | null,

  "description": string
}

Rules:
1. Identify the high-level user action.
2. If the user mentions spending BNB, set nativeCurrency = "BNB".
3. If the user mentions an amount of BNB, set maxValueNative to that number as a string.
4. If the user is approving a token, set allowApproval = true.
5. If the user is transferring, minting, or swapping without mentioning approval, set allowApproval = false.
6. For NFT minting, action = MINT.
7. For token transfer, action = TRANSFER.
8. For token swaps:
   - action = SWAP.
   - tokenIn = token being spent/sold.
   - tokenOut = token being received.
   - quantity = amount of tokenIn when explicitly stated.
9. For non-SWAP actions:
   - tokenIn should normally be null.
   - tokenOut should normally be null.
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

    const json = parseAIJson(raw);

    const parsed = userIntentSchema.safeParse(json);

    if (!parsed.success) {
      console.error("AI schema error:", parsed.error.flatten());

      throw new Error("AI returned an invalid intent schema.");
    }

    console.log("[AI] Parsed intent:", parsed.data);

    return parsed.data;
  } catch (error) {
    console.warn("[AI] AI intent request failed, falling back to heuristic parsing:", error instanceof Error ? error.message : String(error));
    return parseIntentHeuristically(userInput);
  }
}
