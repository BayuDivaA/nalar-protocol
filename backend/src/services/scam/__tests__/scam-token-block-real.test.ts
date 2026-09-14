import { describe, expect, test, setDefaultTimeout } from "bun:test";

setDefaultTimeout(20_000);
import type { Address } from "viem";

import { BnbAgentInvestigator } from "../bnb-agent-investigator";
import { BnbChainMcpClient } from "../bnb-mcp-client";
import { auditToken } from "../token-auditor";
import { makeSecurityDecision } from "../../security-decision";

setDefaultTimeout(20_000);

const SCAM_TOKEN = "0xe56E18ff683AbF6E1aA01804FaCaeB3694FDdd35" as Address;

const OWNER = "0x53E993819F2Bc45A029615e8634BDdEEab4F7817" as Address;

const WBNB = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd" as Address;

describe("REAL ScamToken → BLOCK", () => {
  test("critical MCP scam evidence produces BLOCK", async () => {
    const mcp = new BnbChainMcpClient();
    const investigator = new BnbAgentInvestigator(mcp);

    try {
      // --------------------------------------------------------
      // 1. Real MCP-backed token analysis
      // --------------------------------------------------------
      const scamAnalysis = await auditToken({
        chainId: 97,
        token: SCAM_TOKEN,
        owner: OWNER,
        router: "0x87FD5305E6a40F378da124864B2D479c2028BD86" as Address,
        investigator,
      });

      console.log("\n========== REAL SCAM ANALYSIS ==========");

      console.log(
        JSON.stringify(
          {
            riskScore: scamAnalysis.riskScore,
            riskLevel: scamAnalysis.riskLevel,
            findings: scamAnalysis.findings,
            contractPrivileges: scamAnalysis.contractPrivileges,
            agentAnalysis: scamAnalysis.agentAnalysis,
          },
          (_key, value) => (typeof value === "bigint" ? value.toString() : value),
          2,
        ),
      );

      console.log("========================================\n");

      // --------------------------------------------------------
      // 2. Verify MCP evidence reached deterministic risk
      // --------------------------------------------------------
      expect(scamAnalysis.riskLevel).toBe("CRITICAL");

      expect(scamAnalysis.findings.some((finding) => finding.code === "EXCESSIVE_SELL_TAX" && finding.severity === "CRITICAL")).toBe(true);

      expect((scamAnalysis.contractPrivileges?.state ?? []).some((state) => state.code === "CURRENT_SELL_TAX" && state.value === "9800" && state.unit === "PERCENT" && state.status === "KNOWN")).toBe(true);

      expect(scamAnalysis.agentAnalysis?.available).toBe(true);

      // --------------------------------------------------------
      // 3. Build a realistic transaction effect
      // --------------------------------------------------------
      const effects = {
        approvals: [],

        swaps: [
          {
            type: "SWAP" as const,
            protocol: "PancakeSwap" as const,

            tokenIn: WBNB,
            tokenOut: SCAM_TOKEN,

            amountIn: 1_000_000_000_000_000n,
            amountOutMin: 0n,

            recipient: OWNER,
            payerIsUser: true,

            path: "0x" as `0x${string}`,

            hopTokens: [WBNB, SCAM_TOKEN],

            fees: [500],
          },
        ],
      };

      // --------------------------------------------------------
      // 4. Convert scam risk into final deterministic decision
      // --------------------------------------------------------
      const decision = makeSecurityDecision({
        simulationSuccess: true,

        risk: {
          score: scamAnalysis.riskScore,
          level: scamAnalysis.riskLevel,
          reasons: scamAnalysis.findings.map((finding) => finding.title),
        },

        comparison: {
          matches: true,
          mismatches: [],
        },

        effects,

        policy: {
          allowed: true,
          requiresReview: false,
          reasons: [],
        },

        scamAnalyses: [scamAnalysis],
      });

      console.log("\n========== FINAL DECISION ==========");

      console.log(JSON.stringify(decision, null, 2));

      console.log("===================================\n");

      // --------------------------------------------------------
      // 5. Final assertions
      // --------------------------------------------------------
      expect(decision.decision).toBe("BLOCK");

      expect(decision.reasons.some((reason) => reason.toLowerCase().includes("sell tax"))).toBe(true);
    } finally {
      // --------------------------------------------------------
      // 6. Always close the MCP process
      // --------------------------------------------------------
      await mcp.close();
    }
  });
});
