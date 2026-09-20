import { describe, expect, test, mock, setDefaultTimeout } from "bun:test";

import { encodeAbiParameters, encodeFunctionData, type Address } from "viem";

import { pancakeswapUniversalRouterAbi } from "../../lib/protocols/pancakeswap";

setDefaultTimeout(60_000);

process.env.BNB_INVESTIGATOR_ENABLED = "true";
process.env.BNB_MCP_REAL_TEST = "true";

const ROUTER = "0x87FD5305E6a40F378da124864B2D479c2028BD86" as Address;

const USER = "0x53E993819F2Bc45A029615e8634BDdEEab4F7817" as Address;

const WBNB = "0xae13d989dac2f0debff460ac112a837c89baa7cd" as Address;

const SCAM_TOKEN = "0xe56E18ff683AbF6E1aA01804FaCaeB3694FDdd35" as Address;

const PATH = `0x${WBNB.slice(2)}0001f4${SCAM_TOKEN.slice(2)}` as `0x${string}`;

/**
 * The actual PancakeSwap V3 Universal Router execute payload.
 */
const innerInput = encodeAbiParameters([{ type: "address" }, { type: "uint256" }, { type: "uint256" }, { type: "bytes" }, { type: "bool" }], [USER, 1_000_000_000_000_000n, 0n, PATH, true]);

const data = encodeFunctionData({
  abi: pancakeswapUniversalRouterAbi,
  functionName: "execute",
  args: ["0x00", [innerInput]],
});

/**
 * Keep transaction intent deterministic for this E2E test.
 */
mock.module("../../services/intent-engine", () => ({
  parseUserIntent: async () => ({
    action: "SWAP",
    quantity: 0.001,
    maxValueNative: null,
    nativeCurrency: "BNB",
    allowApproval: false,
    targetAddress: null,
    description: "Swap 0.001 tBNB to NDEMO",
    tokenIn: "tBNB",
    tokenOut: "NDEMO",
  }),
}));

/**
 * Explanation is not the thing under test here.
 */
mock.module("../../services/explanation-engine", () => ({
  buildDeterministicExplanation: () => ({
    title: "Transaction blocked",
    summary: "Nalar detected critical security evidence.",
    details: [],
    recommendedAction: "BLOCK",
    headline: "Critical risk detected",
    whyStopped: { title: "Why stopped", primaryReason: "Sell tax", userImpact: "Impact" },
    userIntent: { summary: "Swap", action: "SWAP", status: "MATCH" },
    actualTransaction: { summary: "Swap", action: "SWAP" },
    comparison: { status: "MATCH", summary: "Matches" },
    evidence: [],
    meta: {
      generator: "DETERMINISTIC",
      provider: "gemini",
      model: "gemini-3.5-flash-lite",
    },
  }),
  generateSecurityExplanation: async () => ({
    title: "Transaction blocked",
    summary: "Nalar detected critical security evidence.",
    details: [],
    recommendedAction: "BLOCK",
    headline: "Critical risk detected",
    whyStopped: { title: "Why stopped", primaryReason: "Sell tax", userImpact: "Impact" },
    userIntent: { summary: "Swap", action: "SWAP", status: "MATCH" },
    actualTransaction: { summary: "Swap", action: "SWAP" },
    comparison: { status: "MATCH", summary: "Matches" },
    evidence: [],
    meta: {
      generator: "DETERMINISTIC",
      provider: "gemini",
      model: "gemini-3.5-flash-lite",
    },
  }),
}));

/**
 * Keep transaction simulation successful so that BLOCK
 * is caused specifically by scam intelligence.
 */
mock.module("../../services/simulator", () => ({
  simulateTransaction: async () => ({
    success: true,
    gasEstimate: "500000",
    error: null,
  }),
}));

const { default: app } = await import("../../index");

describe("REAL ScamToken through security-check", () => {
  test("real MCP sell tax produces BLOCK", async () => {
    const response = await app.fetch(
      new Request("http://localhost/api/transactions/security-check", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          intent: "Swap 0.001 tBNB to NDEMO",

          transaction: {
            chainId: 97,
            from: USER,
            to: ROUTER,
            value: "1000000000000000",
            data,
          },
        }),
      }),
    );

    const responseText = await response.text();

    console.log("\n========== SECURITY CHECK ==========");

    console.log("STATUS:", response.status);

    console.log(responseText);

    console.log("====================================\n");

    expect(response.status).toBe(200);

    const body = JSON.parse(responseText);

    expect(body.ok).toBe(true);

    // ------------------------------------------------------
    // Final decision
    // ------------------------------------------------------

    expect(body.decision).toBe("BLOCK");

    // ------------------------------------------------------
    // Transaction scam context
    // ------------------------------------------------------

    expect(body.transactionScamContext).toBeDefined();

    expect(body.transactionScamContext.critical).toBe(true);

    // ------------------------------------------------------
    // Token analysis
    // ------------------------------------------------------

    expect(body.scamAnalyses.length).toBeGreaterThan(0);

    const scamAnalysis = body.scamAnalyses.find((analysis: { token: string }) => analysis.token.toLowerCase() === SCAM_TOKEN.toLowerCase());

    expect(scamAnalysis).toBeDefined();

    expect(scamAnalysis.riskLevel).toBe("CRITICAL");

    expect(scamAnalysis.agentAnalysis.available).toBe(true);

    // ------------------------------------------------------
    // MCP state reached HTTP response
    // ------------------------------------------------------

    expect(scamAnalysis.contractPrivileges.state.some((state: { code: string; value: unknown }) => state.code === "CURRENT_SELL_TAX" && state.value === "9800")).toBe(true);

    // ------------------------------------------------------
    // Critical finding
    // ------------------------------------------------------

    expect(scamAnalysis.findings.some((finding: { code: string; severity: string }) => finding.code === "EXCESSIVE_SELL_TAX" && finding.severity === "CRITICAL")).toBe(true);

    // ------------------------------------------------------
    // Block reason
    // ------------------------------------------------------

    expect(body.reasons.some((reason: string) => reason.toLowerCase().includes("sell tax"))).toBe(true);
  });
});
