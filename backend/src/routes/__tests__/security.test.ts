import { describe, expect, test, mock } from "bun:test";

mock.module("../../services/intent-engine", () => ({
  parseUserIntent: async (_input: string) => {
    return {
      action: "MINT",
      quantity: 1,
      maxValueNative: "0.02",
      nativeCurrency: "BNB",
      allowApproval: false,
      targetAddress: null,
      description: "Mint 1 NFT for 0.02 BNB",
    };
  },
}));

const { default: app } = await import("../../index");

const DEMO_NFT = "0x4ACCcd7a3d2e2a7c99BE0ea035B40cE03C7A14d1";

const USER = "0x53E993819F2Bc45A029615e8634BDdEEab4F7817";

describe("POST /api/transactions/security-check", () => {
  test("safe mint should ALLOW", async () => {
    const response = await app.fetch(
      new Request("http://localhost/api/transactions/security-check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intent: "I want to mint 1 NFT for 0.02 BNB",
          transaction: {
            chainId: 97,
            from: USER,
            to: DEMO_NFT,
            value: "20000000000000000",
            data: "0x6871ee40",
          },
        }),
      }),
    );

    expect(response.status).toBe(200);

    const body = (await response.json()) as SecurityCheckResponse;

    expect(body.ok).toBe(true);
    expect(body.decision).toBe("ALLOW");
    expect(body.riskScore).toBe(0);
    expect(body.riskLevel).toBe("LOW");
    expect(body.intentMatch).toBe(true);

    expect(body.actual.action).toBe("MINT");
    expect(body.actual.functionName).toBe("safeMint");

    expect(body.simulation.success).toBe(true);

    expect(body.policy.evaluation.allowed).toBe(true);
    expect(body.policy.evaluation.requiresReview).toBe(false);
  });

  test("malicious approval should BLOCK", async () => {
    const response = await app.fetch(
      new Request("http://localhost/api/transactions/security-check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intent: "I want to mint 1 NFT for 0.02 BNB",
          transaction: {
            chainId: 97,
            from: USER,
            to: DEMO_NFT,
            value: "0",
            data: "0x73fbd8db0000000000000000000000003333333333333333333333333333333333333333",
          },
        }),
      }),
    );

    expect(response.status).toBe(200);

    const body = (await response.json()) as SecurityCheckResponse;

    expect(body.ok).toBe(true);
    expect(body.decision).toBe("BLOCK");
    expect(body.riskScore).toBe(90);
    expect(body.riskLevel).toBe("CRITICAL");
    expect(body.intentMatch).toBe(false);

    expect(body.actual.action).toBe("NFT_APPROVAL");
    expect(body.actual.functionName).toBe("maliciousApproval");

    expect(body.simulation.success).toBe(true);

    expect(body.policy.evaluation.allowed).toBe(false);
    expect(body.policy.evaluation.requiresReview).toBe(false);

    expect(body.policy.evaluation.reasons).toContain("Action NFT_APPROVAL is forbidden by policy.");

    expect(body.effects.approvals).toHaveLength(1);

    expect(body.effects.approvals[0].approved).toBe(true);

    expect(body.stateDiff).toHaveLength(1);
    expect(body.stateDiff[0].before).toBe(false);
    expect(body.stateDiff[0].after).toBe(true);

    expect(body.comparison.matches).toBe(false);
  });
});
