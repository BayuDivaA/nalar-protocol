import { describe, expect, test } from "bun:test";

import { defaultPolicy, evaluatePolicy } from "../policy";

import { makeSecurityDecision } from "../security-decision";

const criticalScamAnalysis = {
  token: "0x1111111111111111111111111111111111111111" as const,
  riskScore: 95,
  riskLevel: "CRITICAL" as const,
  honeypot: true,
  findings: [
    {
      code: "SELL_SIMULATION_FAILED" as const,
      severity: "CRITICAL" as const,
      title: "Sell simulation failed.",
      description: "A simulated sell reverted.",
      source: "SIMULATION" as const,
    },
  ],
  sellSimulation: { attempted: true, success: false, error: "sell reverted" },
  contract: { verified: true, proxy: false, implementation: null },
  agentAnalysis: { available: false, summary: null },
};

describe("TxSentry Security Decision", () => {
  test("ALLOW — safe mint under policy threshold", () => {
    const policy = evaluatePolicy({
      policy: defaultPolicy,
      action: "MINT",
      value: 20_000_000_000_000_000n, // 0.02 BNB
    });

    expect(policy.allowed).toBe(true);
    expect(policy.requiresReview).toBe(false);

    const decision = makeSecurityDecision({
      simulationSuccess: true,

      risk: {
        score: 0,
        level: "LOW",
        reasons: [],
      },

      comparison: {
        matches: true,
        mismatches: [],
      },

      effects: {
        approvals: [],
        swaps: [],
      },

      policy,
    });

    expect(decision.decision).toBe("ALLOW");
  });

  test("REVIEW — allowed action above review threshold", () => {
    const policy = evaluatePolicy({
      policy: defaultPolicy,
      action: "MINT",
      value: 600_000_000_000_000_000n, // 0.6 BNB
    });

    expect(policy.allowed).toBe(true);
    expect(policy.requiresReview).toBe(true);

    const decision = makeSecurityDecision({
      simulationSuccess: true,

      risk: {
        score: 0,
        level: "LOW",
        reasons: [],
      },

      comparison: {
        matches: true,
        mismatches: [],
      },

      effects: {
        approvals: [],
        swaps: [],
      },

      policy,
    });

    expect(decision.decision).toBe("REVIEW");
  });

  test("BLOCK — forbidden NFT approval", () => {
    const policy = evaluatePolicy({
      policy: defaultPolicy,
      action: "NFT_APPROVAL",
      value: 0n,
    });

    expect(policy.allowed).toBe(false);
    expect(policy.requiresReview).toBe(false);

    const decision = makeSecurityDecision({
      simulationSuccess: true,

      risk: {
        score: 90,
        level: "CRITICAL",
        reasons: ["Transaction requests NFT operator approval."],
      },

      comparison: {
        matches: false,
        mismatches: ["Transaction requests an approval that the user did not intend to grant."],
      },

      effects: {
        approvals: [
          {
            type: "ERC721_OPERATOR",
            token: "0x4ACCcd7a3d2e2a7c99BE0ea035B40cE03C7A14d1",
            owner: "0x53E993819F2Bc45A029615e8634BDdEEab4F7817",
            operator: "0x3333333333333333333333333333333333333333",
            approved: true,
            sourceFunction: "maliciousApproval",
          },
        ],
        swaps: [],
      },

      policy,
    });

    expect(decision.decision).toBe("BLOCK");
  });

  test("BLOCK — simulation failure", () => {
    const policy = evaluatePolicy({
      policy: defaultPolicy,
      action: "MINT",
      value: 20_000_000_000_000_000n,
    });

    const decision = makeSecurityDecision({
      simulationSuccess: false,

      risk: {
        score: 0,
        level: "LOW",
        reasons: [],
      },

      comparison: {
        matches: true,
        mismatches: [],
      },

      effects: {
        approvals: [],
        swaps: [],
      },

      policy,
    });

    expect(decision.decision).toBe("BLOCK");
    expect(decision.reasons).toContain("Transaction simulation reverted.");
  });

  test("BLOCK — deterministic critical scam evidence", () => {
    const policy = evaluatePolicy({ policy: defaultPolicy, action: "SWAP", value: 0n });
    const decision = makeSecurityDecision({
      simulationSuccess: true,
      risk: { score: 0, level: "LOW", reasons: [] },
      comparison: { matches: true, mismatches: [] },
      effects: { approvals: [], swaps: [] },
      policy,
      scamAnalysis: criticalScamAnalysis,
    });

    expect(decision.decision).toBe("BLOCK");
    expect(decision.reasons).toContain("Sell simulation failed.");
  });

  test("does not block solely because contract verification is unavailable", () => {
    const policy = evaluatePolicy({ policy: defaultPolicy, action: "SWAP", value: 0n });
    const decision = makeSecurityDecision({
      simulationSuccess: true,
      risk: { score: 35, level: "MEDIUM", reasons: ["Contract source is unverified"] },
      comparison: { matches: true, mismatches: [] },
      effects: { approvals: [], swaps: [] },
      policy,
      scamAnalysis: {
        ...criticalScamAnalysis,
        riskScore: 35,
        riskLevel: "MEDIUM",
        honeypot: false,
        findings: [{ code: "UNVERIFIED_CONTRACT", severity: "MEDIUM", title: "Contract source is unverified", description: "No verified ABI is available.", source: "CONTRACT" }],
        sellSimulation: { attempted: false, success: null, error: null },
      },
    });

    expect(decision.decision).toBe("ALLOW");
  });
});
