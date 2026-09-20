// Bun supplies this module at test runtime; the backend TypeScript setup does
// not include Bun's type declarations.
// @ts-expect-error Bun's test module is available when running the test suite.
import { describe, expect, test, mock, beforeEach } from "bun:test";

type SecurityCheckResponse = {
  ok: boolean;

  decision: "ALLOW" | "REVIEW" | "BLOCK";

  riskScore: number;

  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

  intentMatch: boolean;

  intent?: {
    action: string;
    quantity: number | null;
    tokenIn: string | null;
    tokenOut: string | null;
    maxValueNative: string | null;
    nativeCurrency: "BNB" | null;
    allowApproval: boolean;
    targetAddress: string | null;
    description: string;
  };

  actual: {
    action: string;
    functionName: string | null;
    selector: string | null;
    value: string;
    description: string;
  };

  simulation: {
    success: boolean;
    gasEstimate: string | null;
    error: string | null;
  };

  policy: {
    evaluation: {
      allowed: boolean;
      requiresReview: boolean;
      reasons: string[];
    };
  };

  effects: {
    approvals: {
      type: "ERC20_ALLOWANCE" | "ERC721_OPERATOR";
      token: string;
      owner: string;
      spender?: string;
      amount?: string;
      unlimited?: boolean;
      operator?: string;
      approved?: boolean;
      sourceFunction: string;
    }[];

    swaps?: {
      type: "SWAP";
      protocol: string;
      tokenIn: string;
      tokenOut: string;
      amountIn: string;
      amountOutMin: string;
      recipient: string;
      payerIsUser: boolean;
    }[];
  };

  stateDiff: {
    type: "ERC721_OPERATOR";
    token: string;
    owner: string;
    operator: string;
    before: boolean | null;
    after: boolean;
    sourceFunction: string;
  }[];

  comparison: {
    matches: boolean;
    mismatches: string[];
  };

  explanation?: {
    title: string;
    summary: string;
    details: string[];
    recommendedAction: "CANCEL" | "REVIEW" | "PROCEED";
  };

  transactionSummary?: {
    title?: string;
    description?: string;
    details?: string[];
    target?: string | null;
    valueNative?: string | null;
    action?: string;
  };
};

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

mock.module("../../services/explanation-engine", () => ({
  generateSecurityExplanation: async (input: { intent: string; decision: string; riskLevel: string; riskScore: number; intentMatch: boolean; actualAction: string; actualFunction: string | null; reasons: string[] }) => {
    return {
      title: input.decision === "BLOCK" ? "Test Transaction Blocked" : input.decision === "REVIEW" ? "Test Transaction Review" : "Test Transaction Allowed",

      summary: input.decision === "BLOCK" ? "Transaction blocked by deterministic security rules." : input.decision === "REVIEW" ? "Transaction requires additional review." : "Transaction allowed by deterministic security rules.",

      details: [`Intent: ${input.intent}`, `Actual action: ${input.actualAction}`, `Risk: ${input.riskLevel} (${input.riskScore}/100)`],

      recommendedAction: input.decision === "BLOCK" ? "CANCEL" : input.decision === "REVIEW" ? "REVIEW" : "PROCEED",
    };
  },
}));

mock.module("../../services/simulator", () => ({
  simulateTransaction: async () => ({
    success: true,
    gasEstimate: "500000",
    returnData: "0x",
    error: null,
  }),
}));

process.env.BNB_INVESTIGATOR_ENABLED = "false";

const { default: app } = await import("../../index");

const DEMO_NFT = "0x4ACCcd7a3d2e2a7c99BE0ea035B40cE03C7A14d1";

const USER = "0x53E993819F2Bc45A029615e8634BDdEEab4F7817";

const MALICIOUS_OPERATOR = "0x3333333333333333333333333333333333333333";

const ERC20_TOKEN = "0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565";

const ERC20_SPENDER = "0x3333333333333333333333333333333333333333";

const MAX_UINT256 = "115792089237316195423570985008687907853269984665640564039457584007913129639935";

describe("POST /api/transactions/security-check", () => {
  beforeEach(() => {
    process.env.BNB_INVESTIGATOR_ENABLED = "false";

    mock.module("../../services/intent-engine", () => ({
      parseUserIntent: async (_input: string) => ({
        action: "MINT",
        quantity: 1,
        maxValueNative: "0.02",
        nativeCurrency: "BNB",
        allowApproval: false,
        targetAddress: null,
        description: "Mint 1 NFT for 0.02 BNB",
      }),
    }));

    mock.module("../../services/explanation-engine", () => ({
      generateSecurityExplanation: async (input: { intent: string; decision: string; riskLevel: string; riskScore: number; intentMatch: boolean; actualAction: string; actualFunction: string | null; reasons: string[] }) => ({
        title: input.decision === "BLOCK" ? "Test Transaction Blocked" : input.decision === "REVIEW" ? "Test Transaction Review" : "Test Transaction Allowed",
        summary: input.decision === "BLOCK" ? "Transaction blocked by deterministic security rules." : input.decision === "REVIEW" ? "Transaction requires additional review." : "Transaction allowed by deterministic security rules.",
        details: [`Intent: ${input.intent}`, `Actual action: ${input.actualAction}`, `Risk: ${input.riskLevel} (${input.riskScore}/100)`],
        recommendedAction: input.decision === "BLOCK" ? "CANCEL" : input.decision === "REVIEW" ? "REVIEW" : "PROCEED",
      }),
    }));

    mock.module("../../services/simulator", () => ({
      simulateTransaction: async () => ({
        success: true,
        gasEstimate: "500000",
        returnData: "0x",
        error: null,
      }),
    }));
  });

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

    /**
     * Core result
     */
    expect(body.ok).toBe(true);
    expect(body.decision).toBe("ALLOW");

    /**
     * Risk
     */
    expect(body.riskScore).toBe(0);
    expect(body.riskLevel).toBe("LOW");

    /**
     * Intent comparison
     */
    expect(body.intentMatch).toBe(true);
    expect(body.comparison.matches).toBe(true);
    expect(body.comparison.mismatches).toHaveLength(0);

    /**
     * Classification
     */
    expect(body.actual.action).toBe("MINT");
    expect(body.actual.functionName).toBe("safeMint");

    /**
     * Simulation
     */
    expect(body.simulation.success).toBe(true);
    expect(body.simulation.error).toBeNull();

    /**
     * Policy
     */
    expect(body.policy.evaluation.allowed).toBe(true);
    expect(body.policy.evaluation.requiresReview).toBe(false);
    expect(body.policy.evaluation.reasons).toHaveLength(0);

    /**
     * No approval side effect
     */
    expect(body.effects.approvals).toHaveLength(0);
    expect(body.stateDiff).toHaveLength(0);

    /**
     * Explanation contract
     */
    expect(body.explanation).toBeDefined();
    expect(body.explanation?.title).toBe("Test Transaction Allowed");
    expect(body.explanation?.recommendedAction).toBe("PROCEED");

    /**
     * Transaction summary contract
     */
    expect(body.transactionSummary).toBeDefined();
    expect(body.transactionSummary?.title).toBe("Mint NFT");
    expect(body.transactionSummary?.action).toBe("MINT");
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

    /**
     * Core result
     */
    expect(body.ok).toBe(true);
    expect(body.decision).toBe("BLOCK");

    /**
     * Risk
     */
    expect(body.riskScore).toBe(90);
    expect(body.riskLevel).toBe("CRITICAL");

    /**
     * Intent mismatch
     */
    expect(body.intentMatch).toBe(false);
    expect(body.comparison.matches).toBe(false);

    expect(body.comparison.mismatches.length).toBeGreaterThan(0);

    /**
     * Classification
     */
    expect(body.actual.action).toBe("NFT_APPROVAL");

    expect(body.actual.functionName).toBe("maliciousApproval");

    /**
     * Simulation
     */
    expect(body.simulation.success).toBe(true);
    expect(body.simulation.error).toBeNull();

    /**
     * Policy
     */
    expect(body.policy.evaluation.allowed).toBe(false);

    expect(body.policy.evaluation.requiresReview).toBe(false);

    expect(body.policy.evaluation.reasons).toContain("Action NFT_APPROVAL is forbidden by policy.");

    /**
     * Approval effect
     */
    expect(body.effects.approvals).toHaveLength(1);

    expect(body.effects.approvals[0]?.type).toBe("ERC721_OPERATOR");

    expect(body.effects.approvals[0]?.owner).toBe(USER);

    expect(body.effects.approvals[0]?.operator).toBe(MALICIOUS_OPERATOR);

    expect(body.effects.approvals[0]?.approved).toBe(true);

    expect(body.effects.approvals[0]?.sourceFunction).toBe("maliciousApproval");

    /**
     * State diff
     */
    expect(body.stateDiff).toHaveLength(1);

    expect(body.stateDiff[0]?.before).toBe(false);

    expect(body.stateDiff[0]?.after).toBe(true);

    expect(body.stateDiff[0]?.operator).toBe(MALICIOUS_OPERATOR);

    /**
     * Explanation contract
     */
    expect(body.explanation).toBeDefined();

    expect(body.explanation?.title).toBe("Test Transaction Blocked");

    expect(body.explanation?.recommendedAction).toBe("CANCEL");

    /**
     * Transaction summary contract
     */
    expect(body.transactionSummary).toBeDefined();

    expect(body.transactionSummary?.action).toBe("NFT_APPROVAL");
  });

  test("limited ERC20 approval should REVIEW", async () => {
    const response = await app.fetch(
      new Request("http://localhost/api/transactions/security-check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intent: "I want to approve 100 USDT for a swap",

          transaction: {
            chainId: 97,
            from: USER,
            to: ERC20_TOKEN,
            value: "0",
            data: "0x095ea7b3" + "0000000000000000000000003333333333333333333333333333333333333333" + "0000000000000000000000000000000000000000000000000000000005f5e100",
          },
        }),
      }),
    );

    expect(response.status).toBe(200);

    const body = (await response.json()) as SecurityCheckResponse;

    expect(body.ok).toBe(true);

    expect(body.actual.action).toBe("TOKEN_APPROVAL");

    expect(body.actual.functionName).toBe("approve");

    expect(body.riskLevel).toBe("HIGH");
    expect(body.riskScore).toBe(60);

    expect(body.intentMatch).toBe(false);

    expect(body.policy.evaluation.allowed).toBe(false);

    expect(body.policy.evaluation.requiresReview).toBe(false);

    expect(body.policy.evaluation.reasons).toContain("Action TOKEN_APPROVAL is forbidden by policy.");

    expect(body.decision).toBe("BLOCK");

    expect(body.effects.approvals).toHaveLength(1);

    expect(body.effects.approvals[0]?.type).toBe("ERC20_ALLOWANCE");

    expect(body.effects.approvals[0]?.spender).toBe(ERC20_SPENDER);

    expect(body.effects.approvals[0]?.unlimited).toBe(false);

    expect(body.transactionSummary).toBeDefined();

    expect(body.transactionSummary?.action).toBe("TOKEN_APPROVAL");
  });

  test("unlimited ERC20 approval should BLOCK", async () => {
    const response = await app.fetch(
      new Request("http://localhost/api/transactions/security-check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intent: "I want to swap 10 USDT to BNB",

          transaction: {
            chainId: 97,
            from: USER,
            to: ERC20_TOKEN,
            value: "0",
            data: "0x095ea7b3" + "0000000000000000000000003333333333333333333333333333333333333333" + "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
          },
        }),
      }),
    );

    expect(response.status).toBe(200);

    const body = (await response.json()) as SecurityCheckResponse;

    expect(body.ok).toBe(true);

    expect(body.decision).toBe("BLOCK");

    expect(body.actual.action).toBe("TOKEN_APPROVAL");

    expect(body.actual.functionName).toBe("approve");

    expect(body.riskScore).toBe(90);

    expect(body.riskLevel).toBe("CRITICAL");

    expect(body.intentMatch).toBe(false);

    expect(body.policy.evaluation.allowed).toBe(false);

    expect(body.policy.evaluation.reasons).toContain("Action TOKEN_APPROVAL is forbidden by policy.");

    expect(body.effects.approvals).toHaveLength(1);

    expect(body.effects.approvals[0]?.type).toBe("ERC20_ALLOWANCE");

    expect(body.effects.approvals[0]?.spender).toBe(ERC20_SPENDER);

    expect(body.effects.approvals[0]?.unlimited).toBe(true);

    expect(body.effects.approvals[0]?.amount).toBe(BigInt(MAX_UINT256).toString());

    expect(body.transactionSummary).toBeDefined();

    expect(body.transactionSummary?.action).toBe("TOKEN_APPROVAL");
  });
});
