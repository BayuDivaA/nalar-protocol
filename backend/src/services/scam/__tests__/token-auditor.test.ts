import { describe, expect, test } from "bun:test";

import type { Address } from "viem";

import type { BlockchainEvidenceProvider } from "../evidence-provider";
import { auditToken } from "../token-auditor";

const TOKEN = "0x1111111111111111111111111111111111111111" as Address;
const USER = "0x2222222222222222222222222222222222222222" as Address;
const ROUTER = "0x3333333333333333333333333333333333333333" as Address;

function provider(overrides: Partial<Awaited<ReturnType<BlockchainEvidenceProvider["inspectContract"]>>> = {}): BlockchainEvidenceProvider {
  return {
    inspectContract: async () => ({
      verified: true,
      proxy: false,
      implementation: null,
      owner: null,
      codeAvailable: true,
      capabilities: [],
      ...overrides,
    }),
  };
}

describe("Token auditor", () => {
  test("returns low risk for verified, capability-free evidence", async () => {
    const analysis = await auditToken({ chainId: 97, token: TOKEN, owner: USER, router: ROUTER, provider: provider() });

    expect(analysis.riskLevel).toBe("LOW");
    expect(analysis.honeypot).toBe(false);
    expect(analysis.sellSimulation.success).toBeNull();
    expect(analysis.findings.some((item) => item.code === "SELL_SIMULATION_UNAVAILABLE")).toBe(true);
  });

  test("marks an actual sell simulation revert as a honeypot signal", async () => {
    const analysis = await auditToken({
      chainId: 97,
      token: TOKEN,
      owner: USER,
      router: ROUTER,
      provider: {
        ...provider(),
        simulateSell: async () => ({ attempted: true, success: false, error: "transfer blocked" }),
      },
    });

    expect(analysis.honeypot).toBe(true);
    expect(analysis.riskLevel).toBe("CRITICAL");
    expect(analysis.findings.some((item) => item.code === "SELL_SIMULATION_FAILED")).toBe(true);
  });

  test("reports owner abilities only when the evidence provider confirms access control", async () => {
    const analysis = await auditToken({
      chainId: 97,
      token: TOKEN,
      owner: USER,
      router: ROUTER,
      provider: provider({ capabilities: [{ kind: "MINT", access: "OWNER", functionName: "mint" }] }),
    });

    expect(analysis.findings.some((item) => item.code === "OWNER_CAN_MINT")).toBe(true);
    expect(analysis.riskLevel).toBe("HIGH");
  });

  test("keeps unknown contract evidence unknown rather than safe", async () => {
    const analysis = await auditToken({
      chainId: 97,
      token: TOKEN,
      owner: USER,
      router: ROUTER,
      provider: provider({ verified: null, proxy: null, codeAvailable: null }),
    });

    expect(analysis.contract.verified).toBeNull();
    expect(analysis.findings.some((item) => item.code === "CONTRACT_EVIDENCE_UNAVAILABLE")).toBe(true);
  });

  test("does not fail closed when optional agent enrichment fails", async () => {
    const analysis = await auditToken({
      chainId: 97,
      token: TOKEN,
      owner: USER,
      router: ROUTER,
      provider: provider(),
      investigator: {
        investigate: async () => {
          throw new Error("agent unavailable");
        },
      },
    });

    expect(analysis.agentAnalysis).toEqual({ available: false, summary: null });
    expect(analysis.riskLevel).toBe("LOW");
  });

  test("reports an unresolved proxy without inventing an implementation", async () => {
    const analysis = await auditToken({
      chainId: 97,
      token: TOKEN,
      owner: USER,
      router: ROUTER,
      provider: provider({ proxy: true, implementation: null }),
    });

    expect(analysis.contract).toEqual({ verified: true, proxy: true, implementation: null });
    expect(analysis.findings.some((item) => item.code === "UPGRADEABLE_CONTRACT")).toBe(true);
    expect(analysis.findings.some((item) => item.code === "PROXY_IMPLEMENTATION_UNKNOWN")).toBe(true);
  });

  test("uses provider-defined market thresholds without inventing one", async () => {
    const analysis = await auditToken({
      chainId: 97,
      token: TOKEN,
      owner: USER,
      router: ROUTER,
      provider: provider({
        market: {
          liquidity: { level: "LOW", threshold: "provider threshold: less than 10 BNB" },
          holderConcentration: { level: "HIGH", threshold: "provider threshold: top 10 holders exceed 80%" },
        },
        identity: { status: "UNKNOWN", evidence: "No token registry is configured." },
      }),
    });

    expect(analysis.findings.some((item) => item.code === "LIQUIDITY_LOW")).toBe(true);
    expect(analysis.findings.some((item) => item.code === "HOLDER_CONCENTRATION_HIGH")).toBe(true);
    expect(analysis.findings.some((item) => item.code === "TOKEN_IDENTITY_UNKNOWN")).toBe(true);
    expect(analysis.riskLevel).toBe("MEDIUM");
  });
});
