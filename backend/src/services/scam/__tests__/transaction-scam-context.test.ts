import { describe, expect, test } from "bun:test";

import type { Address } from "viem";

import type { TokenScamAnalysis } from "../findings";
import { buildTransactionScamContext } from "../transaction-scam-context";

const TOKEN_A = "0x1111111111111111111111111111111111111111" as Address;

const TOKEN_B = "0x2222222222222222222222222222222222222222" as Address;

function analysis(token: Address, riskLevel: TokenScamAnalysis["riskLevel"]): TokenScamAnalysis {
  return {
    token,
    riskScore: riskLevel === "CRITICAL" ? 95 : riskLevel === "HIGH" ? 65 : 10,
    riskLevel,
    honeypot: false,
    findings: [],
    sellSimulation: {
      attempted: false,
      success: null,
      error: null,
    },
    contract: {
      verified: true,
      proxy: false,
      implementation: null,
    },
    agentAnalysis: {
      available: false,
      summary: null,
    },
    contractPrivileges: {
      capabilities: [],
      accessControl: [],
      state: [],
    },
  };
}

describe("transaction scam context", () => {
  test("collects affected tokens", () => {
    const context = buildTransactionScamContext([analysis(TOKEN_A, "LOW"), analysis(TOKEN_B, "LOW")]);

    expect(context.affectedTokens).toEqual([TOKEN_A, TOKEN_B]);
  });

  test("detects critical token risk", () => {
    const context = buildTransactionScamContext([analysis(TOKEN_A, "LOW"), analysis(TOKEN_B, "CRITICAL")]);

    expect(context.critical).toBe(true);
    expect(context.highRisk).toBe(true);
  });

  test("does not mark low-risk transaction as high risk", () => {
    const context = buildTransactionScamContext([analysis(TOKEN_A, "LOW"), analysis(TOKEN_B, "MEDIUM")]);

    expect(context.critical).toBe(false);
    expect(context.highRisk).toBe(false);
  });
});
