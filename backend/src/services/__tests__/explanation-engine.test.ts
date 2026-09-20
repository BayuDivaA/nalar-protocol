// Bun provides this module at runtime; the backend TypeScript setup does not include Bun's type declarations.
// @ts-ignore -- keep the Bun test runner import without requiring Bun types in the application typecheck.
import { describe, expect, test } from "bun:test";
import { buildDeterministicExplanation, buildHumanExplanationContext, humanizeFinding, type GenerateExplanationInput } from "../explanation-engine";

describe("Human-Readable Explanation Engine", () => {
  // -------------------------------------------------------------
  // Helpers: humanizeFinding & buildHumanExplanationContext
  // -------------------------------------------------------------
  describe("humanizeFinding & buildHumanExplanationContext", () => {
    test("humanizeFinding maps technical codes to Fact -> Meaning -> Impact", () => {
      const tax = humanizeFinding("EXCESSIVE_SELL_TAX", { sellTaxPercent: 98 });
      expect(tax.headline).toBe("An unusually high sell fee was found (98%)");
      expect(tax.fact).toContain("98% sell tax");
      expect(tax.meaning).toBe("This is an unusually large fee applied to selling.");
      expect(tax.impact).toContain("If enforced during a sale");

      const unverified = humanizeFinding("UNVERIFIED_CONTRACT");
      expect(unverified.headline).toBe("The contract could not be fully verified");
      expect(unverified.fact).toBe("The contract source is not verified.");
      expect(unverified.meaning).toBe("Nalar has less publicly verifiable information available to inspect.");
      expect(unverified.impact).toBe("This makes it harder to independently confirm how the contract behaves.");

      const noSim = humanizeFinding("SELL_SIMULATION_UNAVAILABLE");
      expect(noSim.headline).toBe("Nalar could not verify the sell path");
      expect(noSim.fact).toBe("The sell simulation could not be completed.");
      expect(noSim.meaning).toBe("Nalar could not independently test what would happen during a sale.");
      expect(noSim.impact).toBe("You have less evidence about whether the token can be sold as expected.");

      const unlimited = humanizeFinding("UNLIMITED_ALLOWANCE");
      expect(unlimited.headline).toBe("This transaction gives broad spending permission");
      expect(unlimited.fact).toBe("The approval is not limited to a specific token amount.");
      expect(unlimited.meaning).toBe("The spender may be able to use that permission more broadly than a limited approval.");
      expect(unlimited.impact).toBe("If the spender is unsafe or compromised, this permission could put your tokens at risk.");

      const nft = humanizeFinding("UNEXPECTED_NFT_OPERATOR");
      expect(nft.headline).toBe("This transaction gives control over your NFTs");
      expect(nft.fact).toContain("operator rights");
      expect(nft.impact).toContain("transfer your NFTs");

      const simFail = humanizeFinding("SIMULATION_FAILED", { error: "execution reverted: 0x" });
      expect(simFail.headline).toBe("The transaction simulation failed");
      expect(simFail.fact).toContain("rejected this transaction");
      expect(simFail.impact).toContain("forfeit network gas fees");
    });

    test("buildHumanExplanationContext gathers all signals without inventing data", () => {
      const input: GenerateExplanationInput = {
        intent: "Swap 0.002 tBNB to NDEMO",
        decision: "BLOCK",
        riskLevel: "CRITICAL",
        riskScore: 95,
        intentMatch: true,
        actualAction: "SWAP",
        actualFunction: "execute",
        actualValueNative: "0.002 BNB",
        reasons: ["Excessive sell tax"],
        effects: {},
        comparison: {
          matches: true,
          mismatches: [],
          overall: "MATCH",
          action: { status: "MATCH", expected: "SWAP", actual: "SWAP" },
          inputToken: { status: "MATCH", expected: "tBNB", actual: "tBNB" },
          outputToken: { status: "MATCH", expected: "NDEMO", actual: "NDEMO" },
          amount: { status: "MATCH", expected: "0.002", actual: "0.002" },
          recipient: { status: "UNSPECIFIED" },
          summary: "Matches request",
        },
        policy: { allowed: true, requiresReview: false, reasons: [] },
        scamAnalyses: [
          {
            token: "0xe56E18ff683AbF6E1aA01804FaCaeB3694FDdd35",
            contractPrivileges: {
              state: [{ code: "CURRENT_SELL_TAX", label: "Sell tax", value: 9800, unit: "PERCENT" }],
            },
            findings: [{ code: "EXCESSIVE_SELL_TAX", severity: "CRITICAL" }],
          },
        ],
      };

      const ctx = buildHumanExplanationContext(input);
      expect(ctx.decision).toBe("BLOCK");
      expect(ctx.riskScore).toBe(95);
      expect(ctx.contractState.sellTaxPercent).toBe(98);
      expect(ctx.securityFindings.length).toBeGreaterThan(0);
      expect(ctx.securityFindings[0]?.humanized.headline).toContain("98%");
    });
  });

  // -------------------------------------------------------------
  // 1. Intent Mismatch & Section 12 Acceptance Test
  // -------------------------------------------------------------
  describe("Intent Comparison Explanations", () => {
    test("Acceptance Test: 'beli DHON terus dengan bayar pake 0.002 tBNB' -> actual BUSD", () => {
      const explanation = buildDeterministicExplanation({
        intent: "beli DHON terus dengan bayar pake 0.002 tBNB",
        decision: "BLOCK",
        riskLevel: "CRITICAL",
        riskScore: 100,
        intentMatch: false,
        actualAction: "SWAP",
        actualFunction: "swapExactETHForTokens",
        actualValueNative: "0.002 BNB",
        reasons: ["User intended to receive DHON. Transaction actually receives BUSD."],
        effects: {},
        comparison: {
          matches: false,
          mismatches: ["Receive token: Expected DHON, Actual BUSD"],
          overall: "MISMATCH",
          action: { status: "MATCH", expected: "SWAP", actual: "SWAP" },
          inputToken: { status: "MATCH", expected: "tBNB", actual: "tBNB" },
          outputToken: { status: "MISMATCH", expected: "DHON", actual: "BUSD", reason: "Expected DHON, actual BUSD" },
          amount: { status: "MATCH", expected: "0.002", actual: "0.002" },
          recipient: { status: "UNSPECIFIED" },
          summary: "You asked to use 0.002 tBNB to buy DHON, but the transaction is configured to receive BUSD.",
        },
        policy: { allowed: true, requiresReview: false, reasons: [] },
        normalizedIntent: {
          action: "SWAP",
          quantity: 0.002,
          tokenIn: "tBNB",
          tokenOut: "DHON",
          description: "beli DHON terus dengan bayar pake 0.002 tBNB",
        },
        transactionSummary: {
          title: "Swap 0.002 tBNB for BUSD",
          action: "SWAP",
          summary: "Swap 0.002 tBNB for BUSD through PancakeSwap.",
          output: { symbol: "BUSD" },
          input: { amount: "0.002", symbol: "tBNB" },
        },
      });

      // Section 12 Acceptance Criteria:
      // Expected primary explanation:
      // "This transaction does something different from what you asked for."
      expect(explanation.headline).toBe("This transaction does something different from what you asked for");
      expect(explanation.summary).toBe("This transaction does something different from what you asked for.");

      // Expected detail:
      // "You asked to use 0.002 tBNB to buy DHON, but the transaction is configured to receive BUSD."
      expect(explanation.whyStopped?.primaryReason).toContain("You asked to use 0.002 tBNB to buy DHON, but the transaction is configured to receive BUSD.");
      expect(explanation.comparison?.summary).toContain("You asked to use 0.002 tBNB to buy DHON, but the transaction is configured to receive BUSD.");

      // Expected impact:
      // "Continuing could cause you to complete a different swap from the one you intended."
      expect(explanation.whyStopped?.userImpact).toBe("Continuing could cause you to complete a different swap from the one you intended.");

      // What this means answers "What does this mean for me?" without technical jargon
      expect(explanation.whatThisMeans).toContain("Nalar stopped this because the transaction will deliver BUSD instead of the DHON you asked to purchase.");

      // Token symbols must come from structured comparison, not hardcoded
      expect(explanation.whyStopped?.primaryReason).toContain("DHON");
      expect(explanation.whyStopped?.primaryReason).toContain("BUSD");

      // Must NOT claim amount mismatch when amount matches
      expect(explanation.whyStopped?.primaryReason.toLowerCase()).not.toContain("amount mismatch");
      expect(explanation.userIntent?.status).toBe("MISMATCH");
      expect(explanation.actualTransaction?.summary).toBe("Swap 0.002 tBNB for BUSD through PancakeSwap.");
    });

    test("Exact Intent Match — preserves MATCH and outputs calm summary", () => {
      const explanation = buildDeterministicExplanation({
        intent: "Swap 0.002 tBNB to BUSD",
        decision: "ALLOW",
        riskLevel: "LOW",
        riskScore: 0,
        intentMatch: true,
        actualAction: "SWAP",
        actualFunction: "swapExactETHForTokens",
        actualValueNative: "0.002 BNB",
        reasons: [],
        effects: {},
        comparison: {
          matches: true,
          mismatches: [],
          overall: "MATCH",
          action: { status: "MATCH", expected: "SWAP", actual: "SWAP" },
          inputToken: { status: "MATCH", expected: "tBNB", actual: "tBNB" },
          outputToken: { status: "MATCH", expected: "BUSD", actual: "BUSD" },
          amount: { status: "MATCH", expected: "0.002", actual: "0.002" },
          recipient: { status: "UNSPECIFIED" },
          summary: "Transaction matches your intended action.",
        },
        policy: { allowed: true, requiresReview: false, reasons: [] },
        normalizedIntent: {
          action: "SWAP",
          quantity: 0.002,
          tokenIn: "tBNB",
          tokenOut: "BUSD",
          description: "Swap 0.002 tBNB to BUSD",
        },
        transactionSummary: {
          title: "Swap 0.002 tBNB for BUSD",
          summary: "Swap 0.002 tBNB for BUSD through PancakeSwap.",
        },
      });

      expect(explanation.headline).toBe("The transaction passed Nalar's checks");
      expect(explanation.recommendedAction).toBe("PROCEED");
      expect(explanation.userIntent?.status).toBe("MATCH");
      expect(explanation.comparison?.status).toBe("MATCH");
      expect(explanation.comparison?.summary).toBe("The transaction matches what you asked to do.");
    });
  });

  // -------------------------------------------------------------
  // 2. Security Findings & Risk Cases
  // -------------------------------------------------------------
  describe("Security Findings & Humanized Explanations", () => {
    test("Excessive sell tax (NDEMO 98%) — describes fee fact and conditional impact", () => {
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
        comparison: {
          matches: true,
          mismatches: [],
          overall: "MATCH",
          action: { status: "MATCH", expected: "SWAP", actual: "SWAP" },
          inputToken: { status: "MATCH", expected: "tBNB", actual: "tBNB" },
          outputToken: { status: "MATCH", expected: "NDEMO", actual: "NDEMO" },
          amount: { status: "MATCH", expected: "0.001", actual: "0.001" },
          recipient: { status: "UNSPECIFIED" },
          summary: "Matches request",
        },
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
            findings: [{ code: "EXCESSIVE_SELL_TAX", severity: "CRITICAL", title: "Current sell tax is excessive" }],
            contractPrivileges: {
              state: [{ code: "CURRENT_SELL_TAX", label: "Sell tax", value: 9800, unit: "PERCENT" }],
            },
          },
        ],
      });

      expect(explanation.title).toBe("Transaction Blocked");
      expect(explanation.recommendedAction).toBe("CANCEL");
      expect(explanation.headline).toContain("98%");
      expect(explanation.whyStopped?.primaryReason).toContain("98% sell tax");

      // Conditionality: no guaranteed loss claim
      const impact = explanation.whyStopped?.userImpact ?? "";
      expect(impact.toLowerCase()).toContain("if enforced");
      expect(impact.toLowerCase()).not.toContain("you will definitely lose");
      expect(impact.toLowerCase()).not.toContain("guaranteed loss");

      expect(explanation.userIntent?.status).toBe("MATCH");
      expect(explanation.comparison?.status).toBe("MATCH");
      expect(explanation.comparison?.summary).toContain("matches your request, but Nalar blocked it");
    });

    test("Owner-controlled tax — warns that owner can alter fees later", () => {
      const explanation = buildDeterministicExplanation({
        intent: "Swap 0.001 tBNB to TOKEN",
        decision: "REVIEW",
        riskLevel: "MEDIUM",
        riskScore: 50,
        intentMatch: true,
        actualAction: "SWAP",
        actualFunction: "execute",
        actualValueNative: "0.001 BNB",
        reasons: ["Owner modifiable tax"],
        effects: {},
        comparison: {
          matches: true,
          mismatches: [],
          overall: "MATCH",
          action: { status: "MATCH", expected: "SWAP", actual: "SWAP" },
          inputToken: { status: "MATCH", expected: "tBNB", actual: "tBNB" },
          outputToken: { status: "MATCH", expected: "TOKEN", actual: "TOKEN" },
          amount: { status: "MATCH", expected: "0.001", actual: "0.001" },
          recipient: { status: "UNSPECIFIED" },
          summary: "Matches request",
        },
        policy: { allowed: true, requiresReview: true, reasons: [] },
        scamAnalyses: [
          {
            findings: [{ code: "OWNER_CONTROLLED_TAX", severity: "MEDIUM" }],
            contractPrivileges: {
              state: [{ code: "CURRENT_SELL_TAX", label: "Sell tax", value: 500, unit: "PERCENT" }],
            },
          },
        ],
      });

      expect(explanation.headline).toBe("The contract owner can control the sell fee");
      expect(explanation.whyStopped?.primaryReason).toContain("administrator to adjust transfer or sell fees");
      expect(explanation.whyStopped?.userImpact).toContain("owner changes the fee later");
    });

    test("Unverified smart contract — explains lack of public source code", () => {
      const explanation = buildDeterministicExplanation({
        intent: "Swap 0.01 tBNB to UNVERIFIED",
        decision: "REVIEW",
        riskLevel: "MEDIUM",
        riskScore: 40,
        intentMatch: true,
        actualAction: "SWAP",
        actualFunction: "execute",
        actualValueNative: "0.01 BNB",
        reasons: ["Contract source is unverified."],
        effects: {},
        comparison: {
          matches: true,
          mismatches: [],
          overall: "MATCH",
          action: { status: "MATCH", expected: "SWAP", actual: "SWAP" },
          inputToken: { status: "MATCH", expected: "tBNB", actual: "tBNB" },
          outputToken: { status: "MATCH", expected: "UNVERIFIED", actual: "UNVERIFIED" },
          amount: { status: "MATCH", expected: "0.01", actual: "0.01" },
          recipient: { status: "UNSPECIFIED" },
          summary: "Matches request",
        },
        policy: { allowed: true, requiresReview: true, reasons: [] },
        scamAnalyses: [
          {
            findings: [{ code: "UNVERIFIED_CONTRACT", severity: "MEDIUM" }],
          },
        ],
      });

      expect(explanation.headline).toBe("The contract could not be fully verified");
      expect(explanation.whyStopped?.primaryReason).toBe("The contract source is not verified on the block explorer.");
      expect(explanation.whyStopped?.userImpact).toBe("This makes it harder to independently confirm how the contract behaves.");
      expect(explanation.whatThisMeans).toContain("Nalar could not independently verify the contract's published source code");
    });

    test("Sell simulation unavailable — warns that selling has not been proven on-chain", () => {
      const explanation = buildDeterministicExplanation({
        intent: "Buy 100 TOKEN",
        decision: "REVIEW",
        riskLevel: "MEDIUM",
        riskScore: 45,
        intentMatch: true,
        actualAction: "SWAP",
        actualFunction: "execute",
        actualValueNative: "0.01 BNB",
        reasons: ["Sell simulation unavailable"],
        effects: {},
        comparison: {
          matches: true,
          mismatches: [],
          overall: "MATCH",
          action: { status: "MATCH", expected: "SWAP", actual: "SWAP" },
          inputToken: { status: "MATCH", expected: "BNB", actual: "BNB" },
          outputToken: { status: "MATCH", expected: "TOKEN", actual: "TOKEN" },
          amount: { status: "MATCH", expected: "100", actual: "100" },
          recipient: { status: "UNSPECIFIED" },
          summary: "Matches request",
        },
        policy: { allowed: true, requiresReview: true, reasons: [] },
        scamAnalyses: [
          {
            findings: [{ code: "SELL_SIMULATION_UNAVAILABLE", severity: "MEDIUM" }],
          },
        ],
      });

      expect(explanation.headline).toBe("Nalar could not verify the sell path");
      expect(explanation.whyStopped?.primaryReason).toBe("The sell simulation could not be completed on-chain.");
      expect(explanation.whyStopped?.userImpact).toBe("You have less evidence about whether the token can be sold as expected.");
      expect(explanation.whatThisMeans).toContain("ability to sell has not been proven by on-chain simulation");
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
        comparison: {
          matches: false,
          mismatches: ["Unintended approval request."],
          overall: "MISMATCH",
          action: { status: "MISMATCH", expected: "TRANSFER", actual: "TOKEN_APPROVAL" },
          inputToken: { status: "UNSPECIFIED" },
          outputToken: { status: "UNSPECIFIED" },
          amount: { status: "UNSPECIFIED" },
          recipient: { status: "UNSPECIFIED" },
          summary: "Unintended approval request.",
        },
        policy: { allowed: false, requiresReview: false, reasons: ["Action TOKEN_APPROVAL is forbidden by policy."] },
        transactionThreats: [{ code: "UNLIMITED_ALLOWANCE", severity: "HIGH", title: "Unlimited token spending permission" }],
        transactionSummary: {
          action: "TOKEN_APPROVAL",
          input: { symbol: "USDT" },
        },
      });

      expect(explanation.headline).toBe("This transaction gives broad spending permission");
      expect(explanation.whyStopped?.primaryReason).toContain("without a fixed limit");
      expect(explanation.whatThisMeans).toContain("permission to spend your tokens without a small spending limit");
      expect(explanation.actualTransaction?.summary).toBe("Allow this contract to spend your USDT without a fixed spending limit.");
    });

    test("NFT operator approval — explains collection-wide management permission", () => {
      const explanation = buildDeterministicExplanation({
        intent: "Approve NFT",
        decision: "BLOCK",
        riskLevel: "HIGH",
        riskScore: 70,
        intentMatch: false,
        actualAction: "NFT_APPROVAL",
        actualFunction: "setApprovalForAll",
        actualValueNative: "0 BNB",
        reasons: ["Unexpected NFT operator"],
        effects: {},
        comparison: {
          matches: false,
          mismatches: ["NFT operator not intended"],
          overall: "MISMATCH",
          action: { status: "MISMATCH", expected: "MINT", actual: "NFT_APPROVAL" },
          inputToken: { status: "UNSPECIFIED" },
          outputToken: { status: "UNSPECIFIED" },
          amount: { status: "UNSPECIFIED" },
          recipient: { status: "UNSPECIFIED" },
          summary: "NFT operator not intended",
        },
        policy: { allowed: false, requiresReview: false, reasons: ["Unexpected NFT operator"] },
        transactionThreats: [{ code: "UNEXPECTED_NFT_OPERATOR", severity: "HIGH" }],
      });

      expect(explanation.headline).toBe("This transaction gives control over your NFTs");
      expect(explanation.whyStopped?.primaryReason).toContain("operator rights over your NFT collection");
      expect(explanation.whyStopped?.userImpact).toContain("transfer your NFTs without further approval");
    });

    test("Simulation failure — explains on-chain revert without technical jargon", () => {
      const explanation = buildDeterministicExplanation({
        intent: "Transfer 1 BNB",
        decision: "BLOCK",
        riskLevel: "CRITICAL",
        riskScore: 100,
        intentMatch: true,
        actualAction: "TRANSFER",
        actualFunction: null,
        actualValueNative: "1 BNB",
        reasons: ["Transaction simulation failed."],
        effects: {},
        comparison: {
          matches: false,
          mismatches: ["Transaction simulation failed."],
          overall: "MISMATCH",
          action: { status: "MATCH", expected: "TRANSFER", actual: "TRANSFER" },
          inputToken: { status: "MATCH", expected: "BNB", actual: "BNB" },
          outputToken: { status: "UNSPECIFIED" },
          amount: { status: "MATCH", expected: "1", actual: "1" },
          recipient: { status: "UNSPECIFIED" },
          summary: "Transaction simulation failed.",
        },
        policy: { allowed: false, requiresReview: false, reasons: ["Transaction simulation failed."] },
        simulation: { success: false, gasEstimate: null, error: "execution reverted: 0x" },
      });

      expect(explanation.headline).toBe("The transaction simulation failed");
      expect(explanation.whyStopped?.primaryReason).toContain("rejected this transaction during test execution");
      expect(explanation.whyStopped?.userImpact).toContain("forfeit network gas fees");
      expect(explanation.whatThisMeans).toContain("cannot succeed in its current state");
    });
  });

  // -------------------------------------------------------------
  // 3. Decision Enums: ALLOW, REVIEW, BLOCK
  // -------------------------------------------------------------
  describe("Decision Enum Humanization", () => {
    test("ALLOW outputs 'The transaction passed Nalar's checks'", () => {
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
        comparison: {
          matches: true,
          mismatches: [],
          overall: "MATCH",
          action: { status: "MATCH", expected: "TRANSFER", actual: "TRANSFER" },
          inputToken: { status: "MATCH", expected: "tBNB", actual: "tBNB" },
          outputToken: { status: "UNSPECIFIED" },
          amount: { status: "MATCH", expected: "0.01", actual: "0.01" },
          recipient: { status: "UNSPECIFIED" },
          summary: "Transaction matches your intended action.",
        },
        policy: { allowed: true, requiresReview: false, reasons: [] },
        simulation: { success: true, gasEstimate: "21000", error: null },
      });

      expect(explanation.title).toBe("Transaction Verified");
      expect(explanation.headline).toBe("The transaction passed Nalar's checks");
      expect(explanation.recommendedAction).toBe("PROCEED");
      expect(explanation.whyStopped?.title).toBe("Transaction verified");
    });

    test("REVIEW outputs 'This transaction needs your attention'", () => {
      const explanation = buildDeterministicExplanation({
        intent: "Interact with contract",
        decision: "REVIEW",
        riskLevel: "MEDIUM",
        riskScore: 35,
        intentMatch: true,
        actualAction: "UNKNOWN",
        actualFunction: "unknown",
        actualValueNative: "0 BNB",
        reasons: ["Action requires review"],
        effects: {},
        comparison: {
          matches: true,
          mismatches: [],
          overall: "MATCH",
          action: { status: "UNSPECIFIED" },
          inputToken: { status: "UNSPECIFIED" },
          outputToken: { status: "UNSPECIFIED" },
          amount: { status: "UNSPECIFIED" },
          recipient: { status: "UNSPECIFIED" },
          summary: "Action requires review",
        },
        policy: { allowed: true, requiresReview: true, reasons: ["Action requires review"] },
      });

      expect(explanation.title).toBe("Review Required");
      expect(explanation.headline).toBe("This transaction needs your attention");
      expect(explanation.recommendedAction).toBe("REVIEW");
      expect(explanation.whyStopped?.title).toBe("Why Nalar recommends review");
    });

    test("BLOCK outputs 'The transaction was stopped'", () => {
      const explanation = buildDeterministicExplanation({
        intent: "Transfer 10 BNB",
        decision: "BLOCK",
        riskLevel: "HIGH",
        riskScore: 80,
        intentMatch: true,
        actualAction: "TRANSFER",
        actualFunction: null,
        actualValueNative: "10 BNB",
        reasons: ["Exceeds max spend limit"],
        effects: {},
        comparison: {
          matches: true,
          mismatches: [],
          overall: "MATCH",
          action: { status: "MATCH", expected: "TRANSFER", actual: "TRANSFER" },
          inputToken: { status: "MATCH", expected: "BNB", actual: "BNB" },
          outputToken: { status: "UNSPECIFIED" },
          amount: { status: "MATCH", expected: "10", actual: "10" },
          recipient: { status: "UNSPECIFIED" },
          summary: "Matches request",
        },
        policy: { allowed: false, requiresReview: false, reasons: ["Exceeds max spend limit"] },
      });

      expect(explanation.title).toBe("Transaction Blocked");
      expect(explanation.headline).toBe("The transaction was stopped");
      expect(explanation.recommendedAction).toBe("CANCEL");
      expect(explanation.whyStopped?.title).toBe("Why Nalar stopped this transaction");
    });
  });

  // -------------------------------------------------------------
  // 4. AI Explanation Generation & Fallback Grace
  // -------------------------------------------------------------
  describe("AI Generation Integration", () => {
    test("generateSecurityExplanation — falls back gracefully to DETERMINISTIC on error or test run", async () => {
      const { generateSecurityExplanation } = await import("../explanation-engine");

      const sampleInput: GenerateExplanationInput = {
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
          overall: "MISMATCH",
          summary: "You asked to use 0.002 tBNB to buy DHON, but the transaction is configured to receive BUSD.",
          mismatches: ["Receive token: Expected DHON, Actual BUSD"],
          action: { status: "MATCH", expected: "SWAP", actual: "SWAP" },
          inputToken: { status: "MATCH", expected: "tBNB", actual: "tBNB" },
          outputToken: { status: "MISMATCH", expected: "DHON", actual: "BUSD", reason: "Expected DHON, actual BUSD" },
          amount: { status: "MATCH", expected: "0.002", actual: "0.002" },
          recipient: { status: "UNSPECIFIED" },
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

      expect(explanation.recommendedAction).toBe("REVIEW");
      expect(explanation.whyStopped).toBeDefined();
      expect(explanation.whatThisMeans).toBeDefined();
      expect(explanation.userIntent?.status).toBe("MISMATCH");
      expect(explanation.comparison?.status).toBe("MISMATCH");
      expect(["AI", "DETERMINISTIC"]).toContain(explanation.meta?.generator ?? "");
    }, 20000);
  });
});
