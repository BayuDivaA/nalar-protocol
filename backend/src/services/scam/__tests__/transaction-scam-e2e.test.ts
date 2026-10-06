import { describe, expect, test } from "bun:test";
import type { Address } from "viem";

import type { SwapEffect } from "../../effect-analyzer";
import type { BlockchainEvidenceProvider, ContractEvidence } from "../evidence-provider";
import { auditSwapTokens } from "../token-auditor";

const TOKEN_IN = "0x1111111111111111111111111111111111111111" as Address;

const TOKEN_OUT = "0x2222222222222222222222222222222222222222" as Address;

const USER = "0x3333333333333333333333333333333333333333" as Address;

const ROUTER = "0x4444444444444444444444444444444444444444" as Address;

const swap: SwapEffect = {
  type: "SWAP",
  protocol: "PancakeSwap",

  tokenIn: TOKEN_IN,
  tokenOut: TOKEN_OUT,

  amountIn: 1n,
  amountOutMin: 1n,

  recipient: USER,
  payerIsUser: true,

  path: "0x",

  hopTokens: [TOKEN_IN, TOKEN_OUT],

  fees: [],
};

function buildBaseEvidence(token: Address): ContractEvidence {
  return {
    verified: true,
    proxy: false,
    implementation: null,
    owner: USER,
    codeAvailable: true,

    capabilities: [],

    accessControl: [],

    state: [],
  };
}

/**
 * Provider used by the first test.
 *
 * No scam behavior is simulated.
 * The purpose is only to verify that both swap tokens
 * are audited.
 */
function createCleanProvider(): BlockchainEvidenceProvider {
  return {
    async inspectContract({ address }): Promise<ContractEvidence> {
      return buildBaseEvidence(address);
    },

    async simulateSell() {
      return {
        attempted: false,
        success: null,
        error: "Nested-state sell simulation intentionally unavailable in test.",
      };
    },
  };
}

/**
 * Provider used by the second test.
 *
 * TOKEN_OUT is intentionally configured as a honeypot-like
 * token whose sell simulation fails.
 *
 * This is deterministic and does not depend on tax-unit
 * interpretation or contract ABI heuristics.
 */
function createCriticalSellProvider(): BlockchainEvidenceProvider {
  return {
    async inspectContract({ address }): Promise<ContractEvidence> {
      return buildBaseEvidence(address);
    },

    async simulateSell({ token }) {
      if (token.toLowerCase() === TOKEN_OUT.toLowerCase()) {
        return {
          attempted: true,
          success: false,
          error: "TRANSFER_FROM_FAILED: token sell reverted.",
        };
      }

      return {
        attempted: false,
        success: null,
        error: "Sell simulation not required for input token.",
      };
    },
  };
}

describe("Transaction scam E2E", () => {
  test("audits approval addresses and intermediate tokens once, without inventing a sell context", async () => {
    const inspected: string[] = [];
    const simulated: string[] = [];
    const progress: string[] = [];
    const provider = createCleanProvider();
    provider.inspectContract = async ({ chainId, address }) => {
      expect(chainId).toBe(56);
      inspected.push(address.toLowerCase());
      const evidence = buildBaseEvidence(address);
      if (address === ROUTER) evidence.state = [{ code: "CURRENT_SELL_TAX", label: "sellTax", value: "9800", unit: "BPS", status: "KNOWN", evidenceSource: "ONCHAIN" }];
      return evidence;
    };
    provider.simulateSell = async ({ token }) => {
      simulated.push(token);
      return { attempted: false, success: null, error: null };
    };
    const analyses = await auditSwapTokens({
      chainId: 56, owner: USER, router: ROUTER,
      swaps: [{ ...swap, hopTokens: [TOKEN_IN, USER, TOKEN_OUT] }],
      addresses: [ROUTER, TOKEN_IN, ROUTER], provider,
      onProgress: async (address, status) => { progress.push(`${address}:${status}`); },
    });
    expect(new Set(inspected).size).toBe(4);
    expect(inspected).toHaveLength(4);
    expect(simulated.sort()).toEqual([TOKEN_IN, TOKEN_OUT].sort());
    expect(progress).toHaveLength(8);
    expect(analyses.find((analysis) => analysis.token === ROUTER)).toMatchObject({ riskLevel: "CRITICAL", honeypot: false, sellSimulation: { attempted: false } });
    expect(analyses.find((analysis) => analysis.token === USER)?.findings).toHaveLength(0);
    const approvalOnly = await auditSwapTokens({ chainId: 56, owner: USER, router: ROUTER, swaps: [], addresses: [ROUTER], provider });
    expect(approvalOnly).toHaveLength(1);
    expect(approvalOnly[0]?.riskLevel).toBe("CRITICAL");
  });

  test("audits both tokenIn and tokenOut", async () => {
    const analyses = await auditSwapTokens({
      chainId: 97,

      owner: USER,

      router: ROUTER,

      swaps: [swap],

      provider: createCleanProvider(),
    });

    expect(analyses).toHaveLength(2);

    const tokens = new Set(analyses.map((analysis) => analysis.token.toLowerCase()));

    expect(tokens.has(TOKEN_IN.toLowerCase())).toBe(true);

    expect(tokens.has(TOKEN_OUT.toLowerCase())).toBe(true);
  });

  test("critical sell failure on tokenOut produces critical scam analysis", async () => {
    const analyses = await auditSwapTokens({
      chainId: 97,

      owner: USER,

      router: ROUTER,

      swaps: [swap],

      provider: createCriticalSellProvider(),
    });

    expect(analyses).toHaveLength(2);

    const outputAnalysis = analyses.find((analysis) => analysis.token.toLowerCase() === TOKEN_OUT.toLowerCase());

    expect(outputAnalysis).toBeDefined();

    expect(outputAnalysis?.honeypot).toBe(true);

    expect(outputAnalysis?.sellSimulation.attempted).toBe(true);

    expect(outputAnalysis?.sellSimulation.success).toBe(false);

    expect(outputAnalysis?.riskLevel).toBe("CRITICAL");

    expect(outputAnalysis?.riskScore).toBeGreaterThanOrEqual(80);

    expect(outputAnalysis?.findings.some((finding) => finding.code === "SELL_SIMULATION_FAILED")).toBe(true);

    expect(outputAnalysis?.findings.some((finding) => finding.severity === "CRITICAL")).toBe(true);
  });
});
