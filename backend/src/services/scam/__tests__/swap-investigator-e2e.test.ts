import { describe, expect, test } from "bun:test";
import type { Address } from "viem";

import type {
  BlockchainEvidenceProvider,
  ContractEvidence,
  ScamInvestigator,
} from "../evidence-provider";

import {
  auditSwapTokens,
} from "../token-auditor";

const TOKEN_IN =
  "0xae13d989dac2f0debff460ac112a837c89baa7cd" as Address;

const TOKEN_OUT =
  "0xb4923f24777f58dcb7866c104025d5247875fd63" as Address;

const USER =
  "0x53E993819F2Bc45A029615e8634BDdEEab4F7817" as Address;

const ROUTER =
  "0x87FD5305E6a40F378da124864B2D479c2028BD86" as Address;

function createEvidence(): ContractEvidence {
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

test("swap investigator E2E enrichment", async () => {
  const calls: Address[] = [];

  const provider: BlockchainEvidenceProvider = {
    async inspectContract(input) {
      return createEvidence();
    },
  };

  const investigator: ScamInvestigator = {
    async investigate(input) {
      calls.push(input.token);

      return {
        summary: `Investigated ${input.token}`,
      };
    },
  };

  const result = await auditSwapTokens({
    chainId: 97,
    owner: USER,
    router: ROUTER,
    provider,
    investigator,
    swaps: [
      {
        type: "SWAP",
        protocol: "PancakeSwap",
        tokenIn: TOKEN_IN,
        tokenOut: TOKEN_OUT,
        amountIn: 200000000000000000n,
        amountOutMin: 0n,
        recipient: USER,
        payerIsUser: false,
        path: "0x",
        hopTokens: [TOKEN_IN, TOKEN_OUT],
        fees: [],
      },
    ],
  });

  expect(result).toHaveLength(2);

  expect(calls).toHaveLength(2);

  for (const analysis of result) {
    expect(analysis.agentAnalysis.available).toBe(true);
    expect(analysis.agentAnalysis.summary).toContain("Investigated");
  }
});