import { describe, expect, test, mock } from "bun:test";

process.env.BNB_INVESTIGATOR_ENABLED = "true";
process.env.BNB_MCP_REAL_TEST = "true";

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
            from: "0x53E993819F2Bc45A029615e8634BDdEEab4F7817",
            to: "0x87FD5305E6a40F378da124864B2D479c2028BD86",
            value: "200000000000000000",
            data: "0x3593564c000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000000020b080000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000011c37937e08000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000053e993819f2bc45a029615e8634bddeeab4f78170000000000000000000000000000000000000000000000000011c37937e080000000000000000000000000000000000000000000000000197f759f64373464fd00000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000ae13d989dac2f0debff460ac112a837c89baa7cd000000000000000000000000b4923f24777f58dcb7866c104025d5247875fd63",
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
