// Bun provides this module at runtime; keep the test portable when Bun types
// are not included in the TypeScript configuration.
// @ts-expect-error Bun's test module types may be unavailable to the checker.
import { describe, expect, test } from "bun:test";
import { generateSecurityExplanation, buildDeterministicExplanation, type GenerateExplanationInput } from "../explanation-engine";
import { parseIntentHeuristically, parseUserIntent } from "../intent-engine";
import { isAiConfigured } from "../../lib/ai-config";
import { securityExplanationSchema } from "../../types/explanation";
import type { IntentComparison } from "../intent-comparator";

describe("AI Activation & Diagnostic Integrity", () => {
  test("Heuristic parser remains active as safe fallback for multilingual swap intent", () => {
    const intent = parseIntentHeuristically("beli DHON terus dengan bayar pake 0.002 tBNB");
    expect(intent.action).toBe("SWAP");
    expect(intent.tokenIn).toBe("tBNB");
    expect(intent.tokenOut).toBe("DHON");
    expect(intent.quantity).toBe(0.002);
  });

  test("AI explanation fallback attaches diagnostic meta with generator: DETERMINISTIC", async () => {
    const input: GenerateExplanationInput = {
      intent: "beli DHON terus dengan bayar pake 0.002 tBNB",
      decision: "REVIEW",
      riskLevel: "MEDIUM",
      riskScore: 50,
      intentMatch: false,
      actualAction: "SWAP",
      actualFunction: "swapExactETHForTokens",
      actualValueNative: "0.002 BNB",
      reasons: ["INTENT_MISMATCH"],
      effects: {},
      comparison: {
        matches: false,
        mismatches: ["Receive token: Expected DHON, Actual BUSD"],
        overall: "MISMATCH",
        action: {
          status: "MATCH",
          expected: "SWAP",
          actual: "SWAP",
        },
        inputToken: {
          status: "MATCH",
          expected: "tBNB",
          actual: "tBNB",
        },
        outputToken: {
          status: "MISMATCH",
          expected: "DHON",
          actual: "BUSD",
          reason: "Expected DHON, actual BUSD",
        },
        amount: {
          status: "MATCH",
          expected: "0.002",
          actual: "0.002",
        },
        recipient: {
          status: "UNSPECIFIED",
        },
        summary: "You asked to receive DHON, but this transaction is configured to receive BUSD instead.",
      },
      policy: { allowed: true, requiresReview: true, reasons: ["INTENT_MISMATCH"] },
      normalizedIntent: {
        action: "SWAP",
        quantity: 0.002,
        tokenIn: "tBNB",
        tokenOut: "DHON",
        description: "beli DHON terus dengan bayar pake 0.002 tBNB",
      },
      transactionSummary: {
        title: "Swap 0.002 tBNB for BUSD",
        summary: "Swap 0.002 tBNB for BUSD through PancakeSwap.",
      },
    };

    const explanation = await generateSecurityExplanation(input);

    // Verify deterministic security decision remains completely authoritative
    expect(explanation.recommendedAction).toBe("REVIEW");
    expect(explanation.meta).toBeDefined();
    expect(["AI", "DETERMINISTIC"]).toContain(explanation.meta?.generator ?? "");

    // Verify structured fields
    expect(explanation.headline).toBeDefined();
    expect(typeof explanation.whyStopped?.primaryReason).toBe("string");
    expect((explanation.whyStopped?.primaryReason ?? "").length).toBeGreaterThan(0);
    expect(explanation.whatThisMeans).toBeDefined();
    expect(explanation.userIntent?.status).toBe("MISMATCH");
    expect(explanation.actualTransaction?.action).toBe("SWAP");
  }, 20000);

  test("Deterministic builder directly attaches generator: DETERMINISTIC", () => {
    const explanation = buildDeterministicExplanation({
      intent: "Transfer 1 BNB",
      decision: "ALLOW",
      riskLevel: "LOW",
      riskScore: 0,
      intentMatch: true,
      actualAction: "TRANSFER",
      actualFunction: null,
      actualValueNative: "1 BNB",
      reasons: [],
      effects: {},
      comparison: {
        matches: true,
        mismatches: [],
        overall: "MATCH",
        action: {
          status: "MATCH",
          expected: "TRANSFER",
          actual: "TRANSFER",
        },
        inputToken: {
          status: "MATCH",
          expected: "BNB",
          actual: "BNB",
        },
        outputToken: {
          status: "UNSPECIFIED",
        },
        amount: {
          status: "MATCH",
          expected: "1",
          actual: "1",
        },
        recipient: {
          status: "UNSPECIFIED",
        },
        summary: "Transaction matches your intended action.",
      },
      policy: { allowed: true, requiresReview: false, reasons: [] },
    });

    expect(explanation.meta?.generator).toBe("DETERMINISTIC");
    expect(explanation.recommendedAction).toBe("PROCEED");
  });

  test("Schema validates explanation with generator: AI metadata", () => {
    const aiExplanation = {
      title: "Review Required",
      headline: "Token Mismatch Detected",
      summary: "You intended to swap for DHON but the transaction outputs BUSD.",
      details: ["Output token differs from intent."],
      recommendedAction: "REVIEW",
      whyStopped: {
        title: "Intent Mismatch",
        primaryReason: "Target token BUSD does not match requested DHON.",
        userImpact: "Signing would execute a swap for BUSD instead.",
      },
      whatThisMeans: "Signing this transaction would perform a different swap than requested.",
      userIntent: {
        summary: "Swap 0.002 tBNB for DHON",
        action: "SWAP",
        input: "0.002 tBNB",
        expectedOutput: "DHON",
        status: "MISMATCH",
      },
      actualTransaction: {
        summary: "Swap 0.002 tBNB for BUSD",
        action: "SWAP",
        input: "0.002 tBNB",
        output: "BUSD",
      },
      comparison: {
        status: "MISMATCH",
        summary: "Token mismatch detected.",
        details: ["Receive token: Expected DHON, Actual BUSD"],
      },
      evidence: [
        {
          label: "Output token",
          value: "BUSD",
          explanation: "Transaction swap recipient receives BUSD.",
          source: "TRANSACTION",
        },
      ],
      meta: {
        generator: "AI",
        provider: "gemini",
        model: "gemini-3.5-flash-lite",
      },
    };

    const parsed = securityExplanationSchema.safeParse(aiExplanation);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.meta?.generator).toBe("AI");
      expect(parsed.data.recommendedAction).toBe("REVIEW");
    }
  });
});
