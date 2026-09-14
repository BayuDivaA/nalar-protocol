import { describe, expect, test } from "bun:test";
import type { Address } from "viem";

import type {
  BlockchainEvidenceProvider,
  ContractEvidence,
  ScamInvestigator,
} from "../evidence-provider";
import { auditToken } from "../token-auditor";

const TOKEN =
  "0x1111111111111111111111111111111111111111" as Address;

const USER =
  "0x2222222222222222222222222222222222222222" as Address;

const ROUTER =
  "0x3333333333333333333333333333333333333333" as Address;

function createEvidence(): ContractEvidence {
  return {
    verified: true,
    proxy: false,
    implementation: null,
    owner: USER,
    codeAvailable: true,

    capabilities: [
      {
        code: "TAX_CAPABILITY",
        category: "TAX",
        functionSignature: "setSellTax(uint256)",
        evidenceSource: "ABI",
        confidence: "HIGH",
        access: "UNKNOWN",
        functionName: "setSellTax",
      },
    ],

    accessControl: [],

    state: [],
  };
}

describe("BNB investigator integration", () => {
  test("investigator enrichment is attached to token analysis", async () => {
    let called = false;

    const provider: BlockchainEvidenceProvider = {
      async inspectContract() {
        return createEvidence();
      },
    };

    const investigator: ScamInvestigator = {
      async investigate(input) {
        called = true;

        expect(input.chainId).toBe(97);

        expect(
          input.token.toLowerCase(),
        ).toBe(TOKEN.toLowerCase());

        expect(
          input.evidence.capabilities,
        ).toHaveLength(1);

        return {
          summary:
            "BNB investigator found owner-controlled tax capability.",
        };
      },
    };

    const result = await auditToken({
      chainId: 97,
      token: TOKEN,
      owner: USER,
      router: ROUTER,
      provider,
      investigator,
    });

    expect(called).toBe(true);

    expect(
      result.agentAnalysis.available,
    ).toBe(true);

    expect(
      result.agentAnalysis.summary,
    ).toBe(
      "BNB investigator found owner-controlled tax capability.",
    );
  });

  test("investigator failure does not break deterministic analysis", async () => {
    const provider: BlockchainEvidenceProvider = {
      async inspectContract() {
        return createEvidence();
      },
    };

    const investigator: ScamInvestigator = {
      async investigate() {
        throw new Error(
          "BNB MCP unavailable",
        );
      },
    };

    const result = await auditToken({
      chainId: 97,
      token: TOKEN,
      owner: USER,
      router: ROUTER,
      provider,
      investigator,
    });

    expect(
      result.agentAnalysis.available,
    ).toBe(false);

    expect(
      result.agentAnalysis.summary,
    ).toBeNull();

    expect(result.findings).toEqual(
      expect.any(Array),
    );

    expect(result.riskLevel).toBeDefined();
  });

  test("investigator cannot change deterministic risk", async () => {
  const provider: BlockchainEvidenceProvider = {
    async inspectContract() {
      return createEvidence();
    },
  };

  const investigator: ScamInvestigator = {
    async investigate() {
      return {
        summary:
          "This token appears completely safe.",
      };
    },
  };

  const result = await auditToken({
    chainId: 97,
    token: TOKEN,
    owner: USER,
    router: ROUTER,
    provider,
    investigator,
  });

  expect(result.agentAnalysis.available).toBe(true);

  // Agent output is informational only.
  expect(result.riskLevel).not.toBeUndefined();
});
});