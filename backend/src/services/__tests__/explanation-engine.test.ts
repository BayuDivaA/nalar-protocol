import { describe, expect, test } from "bun:test";
import { buildDeterministicExplanation } from "../explanation-engine";

describe("Deterministic Explanation Engine (Antislop & Human-Readable)", () => {
  test("NDEMO honeypot — describes 98% sell tax conditionally without claiming guaranteed loss", () => {
    const explanation = buildDeterministicExplanation({
      intent: "Swap 0.001 tBNB to NDEMO",
      decision: "BLOCK",
      riskLevel: "CRITICAL",
      riskScore: 95,
      intentMatch: true,
      actualAction: "SWAP",
      actualFunction: "execute",
      actualValueNative: "0.001 BNB",
      reasons: ["Current sell tax is excessive."],
      effects: {},
      comparison: { matches: true, mismatches: [] },
      policy: { allowed: true, requiresReview: false, reasons: [] },
      normalizedIntent: {
        action: "SWAP",
        quantity: 0.001,
        tokenIn: "tBNB",
        tokenOut: "NDEMO",
        description: "Swap 0.001 tBNB to NDEMO",
      },
      scamAnalyses: [
        {
          token: "0xe56E18ff683AbF6E1aA01804FaCaeB3694FDdd35",
          riskScore: 95,
          riskLevel: "CRITICAL",
          findings: [
            { code: "EXCESSIVE_SELL_TAX", severity: "CRITICAL", title: "Current sell tax is excessive" },
            { code: "OWNER_CONTROLLED_EXCESSIVE_SELL_TAX", severity: "CRITICAL", title: "Owner controlled sell tax" },
          ],
          contractPrivileges: {
            state: [{ code: "CURRENT_SELL_TAX", label: "Sell tax", value: 9800, unit: "PERCENT" }],
          },
        },
      ],
    });

    // 1. Core backward compatibility
    expect(explanation.title).toBe("Transaction Blocked");
    expect(explanation.recommendedAction).toBe("CANCEL");

    // 2. Headline & Why Stopped
    expect(explanation.headline).toContain("98%");
    expect(explanation.whyStopped?.title).toBe("Why Nalar stopped this transaction");
    expect(explanation.whyStopped?.primaryReason).toContain("98% sell tax");

    // 3. Conditionality verification: MUST NOT claim guaranteed loss
    const impact = explanation.whyStopped?.userImpact ?? "";
    expect(impact.toLowerCase()).toContain("if enforced");
    expect(impact.toLowerCase()).not.toContain("you will definitely lose");
    expect(impact.toLowerCase()).not.toContain("guaranteed loss");

    // 4. Intent match preserves MATCH status while blocking
    expect(explanation.userIntent?.status).toBe("MATCH");
    expect(explanation.comparison?.status).toBe("MATCH");
    expect(explanation.comparison?.summary).toContain("matches your request, but Nalar blocked it");

    // 5. Evidence includes on-chain sell tax
    const sellTaxEvidence = explanation.evidence?.find((e) => e.label === "Sell tax");
    expect(sellTaxEvidence).toBeDefined();
    expect(sellTaxEvidence?.value).toBe("98%");
    expect(sellTaxEvidence?.source).toBe("ON-CHAIN");
  });

  test("Intent MISMATCH — describes exact entity difference without inventing amount difference", () => {
    const explanation = buildDeterministicExplanation({
      intent: "Swap 0.001 tBNB to DHON",
      decision: "BLOCK",
      riskLevel: "CRITICAL",
      riskScore: 100,
      intentMatch: false,
      actualAction: "SWAP",
      actualFunction: "execute",
      actualValueNative: "0.001 BNB",
      reasons: ["User intended to receive DHON. Transaction actually receives NDEMO."],
      effects: {},
      comparison: {
        matches: false,
        mismatches: ["User intended to receive DHON. Transaction actually receives NDEMO."],
      },
      policy: { allowed: true, requiresReview: false, reasons: [] },
      normalizedIntent: {
        action: "SWAP",
        quantity: 0.001,
        tokenIn: "tBNB",
        tokenOut: "DHON",
        description: "Swap 0.001 tBNB to DHON",
      },
    });

    expect(explanation.headline).toBe("Intent mismatch detected");
    expect(explanation.userIntent?.status).toBe("MISMATCH");
    expect(explanation.comparison?.status).toBe("MISMATCH");
    expect(explanation.whyStopped?.primaryReason).toContain("DHON");
    expect(explanation.whyStopped?.primaryReason).toContain("NDEMO");
    // Should NOT invent amount mismatch when only token differs
    expect(explanation.whyStopped?.primaryReason.toLowerCase()).not.toContain("amount mismatch");
  });

  test("Unlimited ERC20 approval — explains unrestricted spending permission clearly", () => {
    const explanation = buildDeterministicExplanation({
      intent: "Approve token",
      decision: "BLOCK",
      riskLevel: "HIGH",
      riskScore: 65,
      intentMatch: false,
      actualAction: "TOKEN_APPROVAL",
      actualFunction: "approve",
      actualValueNative: "0 BNB",
      reasons: ["Action TOKEN_APPROVAL is forbidden by policy."],
      effects: {},
      comparison: { matches: false, mismatches: ["Unintended approval request."] },
      policy: { allowed: false, requiresReview: false, reasons: ["Action TOKEN_APPROVAL is forbidden by policy."] },
      transactionThreats: [{ code: "UNLIMITED_ALLOWANCE", severity: "HIGH", title: "Unlimited token spending permission" }],
    });

    expect(explanation.headline).toBe("Unrestricted token spending permission");
    expect(explanation.whyStopped?.primaryReason).toContain("without a fixed limit");
    expect(explanation.whatThisMeans).toContain("permission to spend your tokens without a small spending limit");
  });

  test("Safe transaction — outputs PROCEED and verified state", () => {
    const explanation = buildDeterministicExplanation({
      intent: "Transfer 0.01 tBNB",
      decision: "ALLOW",
      riskLevel: "LOW",
      riskScore: 0,
      intentMatch: true,
      actualAction: "TRANSFER",
      actualFunction: null,
      actualValueNative: "0.01 BNB",
      reasons: [],
      effects: {},
      comparison: { matches: true, mismatches: [] },
      policy: { allowed: true, requiresReview: false, reasons: [] },
      simulation: { success: true, gasEstimate: "21000", error: null },
      normalizedIntent: { action: "TRANSFER", description: "Transfer 0.01 tBNB" },
    });

    expect(explanation.title).toBe("Transaction Verified");
    expect(explanation.headline).toBe("Transaction cleared for signing");
    expect(explanation.recommendedAction).toBe("PROCEED");
    expect(explanation.whyStopped?.title).toBe("Transaction verified");
    expect(explanation.userIntent?.status).toBe("MATCH");
    expect(explanation.meta?.generator).toBe("DETERMINISTIC");
  });

  test("generateSecurityExplanation — falls back gracefully to DETERMINISTIC generator on invalid API key or error", async () => {
    const { generateSecurityExplanation } = await import("../explanation-engine");

    const sampleInput = {
      intent: "beli DHON terus dengan bayar pake 0.002 tBNB",
      decision: "REVIEW" as const,
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
        overall: "MISMATCH" as const,
        summary: "You asked to receive DHON, but this transaction is configured to receive BUSD instead.",
        mismatches: ["Receive token: Expected DHON, Actual BUSD"],
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

    const explanation = await generateSecurityExplanation(sampleInput);

    // Decision must NOT be changed by AI or fallback
    expect(explanation.recommendedAction).toBe("REVIEW");
    expect(explanation.whyStopped).toBeDefined();
    expect(explanation.whatThisMeans).toBeDefined();
    expect(explanation.userIntent?.status).toBe("MISMATCH");
    expect(explanation.comparison?.status).toBe("MISMATCH");
    expect(["AI", "DETERMINISTIC"]).toContain(explanation.meta?.generator ?? "");
  }, 20000);
});
