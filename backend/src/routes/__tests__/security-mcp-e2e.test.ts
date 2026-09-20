import { describe, expect, test, mock } from "bun:test";
import { encodeAbiParameters, encodeFunctionData, type Address } from "viem";
import { pancakeswapUniversalRouterAbi } from "../../lib/protocols/pancakeswap";

process.env.BNB_INVESTIGATOR_ENABLED = "true";
process.env.BNB_MCP_REAL_TEST = "true";

const ROUTER = "0x87FD5305E6a40F378da124864B2D479c2028BD86" as Address;

const USER = "0x53E993819F2Bc45A029615e8634BDdEEab4F7817" as Address;

const TOKEN_IN = "0xae13d989dac2f0debff460ac112a837c89baa7cd" as Address;

const TOKEN_OUT = "0xb4923f24777f58dcb7866c104025d5247875fd63" as Address;

const PATH = `0x${TOKEN_IN.slice(2)}0001f4${TOKEN_OUT.slice(2)}` as `0x${string}`;

const innerInput = encodeAbiParameters([{ type: "address" }, { type: "uint256" }, { type: "uint256" }, { type: "bytes" }, { type: "bool" }], [USER, 200_000_000_000_000_000n, 0n, PATH, true]);

const data = encodeFunctionData({
  abi: pancakeswapUniversalRouterAbi,
  functionName: "execute",
  args: ["0x00", [innerInput]],
});

mock.module("../../services/intent-engine", () => ({
  parseUserIntent: async () => ({
    action: "SWAP",
    quantity: 0.2,
    maxValueNative: null,
    nativeCurrency: "BNB",
    allowApproval: false,
    targetAddress: null,
    description: "Swap 0.2 tBNB to USDT",
    tokenIn: "tBNB",
    tokenOut: "USDT",
  }),
}));

mock.module("../../services/explanation-engine", () => ({
  generateSecurityExplanation: async () => ({
    title: "Test",
    summary: "Test",
    details: [],
    recommendedAction: "REVIEW",
    meta: {
      generator: "DETERMINISTIC",
      provider: "gemini",
      model: "gemini-3.5-flash-lite",
    },
  }),
}));

mock.module("../../services/simulator", () => ({
  simulateTransaction: async () => ({
    success: true,
    gasEstimate: "500000",
    error: null,
  }),
}));

const { default: app } = await import("../../index");

describe("real MCP investigator through security-check", () => {
  test("security-check attaches real MCP investigator evidence", async () => {
    const response = await app.fetch(
      new Request("http://localhost/api/transactions/security-check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intent: "Swap 0.2 tBNB to USDT",
          transaction: {
            chainId: 97,
            from: USER,
            to: ROUTER,
            value: "200000000000000000",
            data,
          },
        }),
      }),
    );

    const responseText = await response.text();

    console.log("SECURITY CHECK STATUS:", response.status);
    console.log("SECURITY CHECK BODY:", responseText);

    expect(response.status).toBe(200);

    const body = JSON.parse(responseText);

    expect(body.ok).toBe(true);

    expect(body.scamAnalyses.length).toBeGreaterThan(0);

    for (const analysis of body.scamAnalyses) {
      expect(analysis.agentAnalysis.available).toBe(true);
      expect(analysis.agentAnalysis.summary).toContain("BNB investigation completed.");
    }

    expect(["ALLOW", "REVIEW", "BLOCK"]).toContain(body.decision);
  }, 60_000);
});
