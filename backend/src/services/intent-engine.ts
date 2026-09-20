import { ai } from "../lib/ai-config";
import { env } from "../config/env";

import { userIntentSchema, type UserIntent } from "../types/intent";

import { parseAIJson } from "../lib/parse-ai-json";

export function parseIntentHeuristically(input: string): UserIntent {
  const text = input.trim();
  const lower = text.toLowerCase();

  // Pattern 1: Buy tokenOut with/using/pake amount tokenIn
  // e.g. "beli DHON terus dengan bayar pake 0.002 tBNB", "buy DHON with 0.002 tBNB", "beli DHON pake 0.002 tBNB"
  const buyMatch = text.match(/(?:buy|beli)\s+([a-zA-Z0-9]+).*?(?:with|using|pake|pakai|bayar\s+pake|dengan\s+bayar\s+pake|dengan)\s+([0-9.]+)?\s*([a-zA-Z0-9]+)/i);
  if (buyMatch) {
    const rawTokenOut = buyMatch[1] ?? "";
    const rawQty = buyMatch[2] ? parseFloat(buyMatch[2]) : null;
    const rawTokenIn = buyMatch[3] ?? "";
    const qty = rawQty !== null && !Number.isNaN(rawQty) ? rawQty : null;

    const tokenIn = rawTokenIn.toUpperCase() === "BNB" || rawTokenIn.toUpperCase() === "TBNB" ? "tBNB" : rawTokenIn.toUpperCase();
    const tokenOut = rawTokenOut.toUpperCase() === "BNB" || rawTokenOut.toUpperCase() === "TBNB" ? "tBNB" : rawTokenOut.toUpperCase();
    const isNativeIn = tokenIn.toUpperCase() === "BNB" || tokenIn.toUpperCase() === "TBNB";

    return {
      action: "SWAP",
      quantity: qty,
      tokenIn,
      tokenOut,
      inputAsset: tokenIn,
      outputAsset: tokenOut,
      maxValueNative: isNativeIn && qty ? String(qty) : null,
      nativeCurrency: isNativeIn ? "BNB" : null,
      allowApproval: false,
      targetAddress: null,
      description: text,
    };
  }

  // Pattern 2: Swap/Trade/Tukar/Jual amount tokenIn to/for/ke tokenOut
  // e.g. "swap 0.002 tBNB to DHON", "tukar 0.002 tBNB ke DHON", "jual 0.002 tBNB untuk DHON"
  const swapMatch = text.match(/(?:swap|trade|tukar|jual)\s+([0-9.]+)?\s*([a-zA-Z0-9]+)?\s+(?:to|for|into|ke|menjadi|jadi|untuk)\s+([a-zA-Z0-9]+)/i);
  if (swapMatch) {
    const rawQty = swapMatch[1] ? parseFloat(swapMatch[1]) : null;
    const rawTokenIn = swapMatch[2] ?? "";
    const rawTokenOut = swapMatch[3] ?? "";
    const qty = rawQty !== null && !Number.isNaN(rawQty) ? rawQty : null;

    const tokenIn = rawTokenIn.toUpperCase() === "BNB" || rawTokenIn.toUpperCase() === "TBNB" ? "tBNB" : rawTokenIn ? rawTokenIn.toUpperCase() : null;
    const tokenOut = rawTokenOut.toUpperCase() === "BNB" || rawTokenOut.toUpperCase() === "TBNB" ? "tBNB" : rawTokenOut ? rawTokenOut.toUpperCase() : null;
    const isNativeIn = tokenIn?.toUpperCase() === "BNB" || tokenIn?.toUpperCase() === "TBNB";

    return {
      action: "SWAP",
      quantity: qty,
      tokenIn,
      tokenOut,
      inputAsset: tokenIn,
      outputAsset: tokenOut,
      maxValueNative: isNativeIn && qty ? String(qty) : null,
      nativeCurrency: isNativeIn ? "BNB" : null,
      allowApproval: false,
      targetAddress: null,
      description: text,
    };
  }

  // Pattern 3: Transfer/Send/Kirim amount tokenIn to/ke recipient
  // e.g. "transfer 10 USDT to Alice", "send 5 BNB to 0x123..."
  const transferMatch = text.match(/(?:transfer|send|kirim)\s+([0-9.]+)?\s*([a-zA-Z0-9]+)?\s+(?:to|ke|unto)\s+([a-zA-Z0-9_.-]+)/i);
  if (transferMatch) {
    const rawQty = transferMatch[1] ? parseFloat(transferMatch[1]) : null;
    const rawToken = transferMatch[2] ?? "";
    const recipient = transferMatch[3] ?? null;
    const qty = rawQty !== null && !Number.isNaN(rawQty) ? rawQty : null;

    const tokenIn = rawToken.toUpperCase() === "BNB" || rawToken.toUpperCase() === "TBNB" ? "tBNB" : rawToken ? rawToken.toUpperCase() : null;
    const isNativeIn = tokenIn?.toUpperCase() === "BNB" || tokenIn?.toUpperCase() === "TBNB";

    return {
      action: "TRANSFER",
      quantity: qty,
      tokenIn,
      tokenOut: null,
      recipient,
      inputAsset: tokenIn,
      outputAsset: null,
      maxValueNative: isNativeIn && qty ? String(qty) : null,
      nativeCurrency: isNativeIn ? "BNB" : null,
      allowApproval: false,
      targetAddress: recipient && /^0x[a-fA-F0-9]{40}$/.test(recipient) ? recipient : null,
      description: text,
    };
  }

  if (lower.includes("swap") || lower.includes("tukar") || lower.includes("beli") || lower.includes("buy")) {
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

  if (lower.includes("approve") || lower.includes("izinkan") || lower.includes("setujui")) {
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

  if (lower.includes("transfer") || lower.includes("send") || lower.includes("kirim")) {
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
  console.log("[AI] Intent parsing started");

  if (env.AI_PROVIDER === "heuristics") {
    console.log("[AI] Intent parsing fallback\nreason=HEURISTICS_PROVIDER");
    return parseIntentHeuristically(userInput);
  }

  if (!env.AI_API_KEY || env.AI_API_KEY === "YOUR_AI_API_KEY") {
    console.log("[AI] Intent parsing fallback\nreason=MISSING_API_KEY");
    return parseIntentHeuristically(userInput);
  }

  try {
    console.log(`[AI] provider=${env.AI_PROVIDER}`);
    console.log(`[AI] model=${env.AI_MODEL}`);
    console.log("[AI] request started");

    const response = await ai.chat.completions.create({
      model: env.AI_MODEL,

      temperature: 0,

      messages: [
        {
          role: "system",

          content: `
You are a Web3 transaction intent parser.

Your ONLY job is to understand what the human intends to do from natural language input (English, Indonesian, slang, abbreviations, etc.).

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

  "recipient": string | null,

  "maxValueNative": string | null,

  "nativeCurrency": "BNB" | null,

  "allowApproval": boolean,

  "targetAddress": string | null,

  "description": string
}

Rules:
1. Identify the high-level user action.
2. Support multilingual phrasing, especially Indonesian (e.g. "beli DHON terus dengan bayar pake 0.002 tBNB" -> action: "SWAP", tokenIn: "tBNB", tokenOut: "DHON", quantity: 0.002).
3. If the user mentions spending BNB or tBNB, set nativeCurrency = "BNB", tokenIn = "tBNB".
4. If the user mentions an amount of BNB, set maxValueNative to that number as a string.
5. If the user is approving a token, set allowApproval = true.
6. If the user is transferring, minting, or swapping without mentioning approval, set allowApproval = false.
7. For token swaps:
   - action = SWAP.
   - tokenIn = token being spent/sold/paid.
   - tokenOut = token being received/bought.
   - quantity = amount of tokenIn when explicitly stated.
8. For token transfers:
   - action = TRANSFER.
   - tokenIn = token being sent.
   - quantity = amount sent.
   - recipient = address or name of recipient.
`,
        },
        {
          role: "user",
          content: userInput,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content;

    if (!raw) {
      throw new Error("AI returned empty output.");
    }

    const json = parseAIJson(raw);

    const parsed = userIntentSchema.safeParse(json);

    if (!parsed.success) {
      const issueSummary = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
      throw new Error(`AI returned an invalid intent schema: ${issueSummary}`);
    }

    console.log("[AI] Intent parsing succeeded");

    return parsed.data;
  } catch (error) {
    const safeReason = error instanceof Error ? error.message : "AI intent request failed";
    console.log(`[AI] Intent parsing fallback\nreason=${safeReason}`);
    return parseIntentHeuristically(userInput);
  }
}
