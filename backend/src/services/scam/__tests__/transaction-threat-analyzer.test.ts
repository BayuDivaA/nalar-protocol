import { describe, expect, test } from "bun:test";

import type { Address } from "viem";

import { analyzeTransactionThreats } from "../transaction-threat-analyzer";

const USER = "0x53E993819F2Bc45A029615e8634BDdEEab4F7817" as Address;

const CONTRACT = "0x1111111111111111111111111111111111111111" as Address;

const SPENDER = "0x2222222222222222222222222222222222222222" as Address;

describe("Transaction threat analyzer", () => {
  test("detects unexpected unlimited allowance", () => {
    const findings = analyzeTransactionThreats({
      from: USER,

      to: CONTRACT,

      value: 0n,

      action: "TOKEN_APPROVAL",

      functionName: "approve",

      protocol: undefined,

      contractVerified: true,

      effects: {
        swaps: [],

        approvals: [
          {
            type: "ERC20_ALLOWANCE",

            token: CONTRACT,

            owner: USER,

            spender: SPENDER,

            amount: 2n ** 256n - 1n,

            unlimited: true,

            sourceFunction: "approve",
          },
        ],
      },

      intentAllowsApproval: false,
    });

    expect(findings.some((finding) => finding.code === "UNLIMITED_ALLOWANCE")).toBe(true);

    expect(findings.some((finding) => finding.code === "UNEXPECTED_SPENDER")).toBe(true);
  });

  test("detects unexpected NFT operator", () => {
    const findings = analyzeTransactionThreats({
      from: USER,

      to: CONTRACT,

      value: 0n,

      action: "NFT_APPROVAL",

      functionName: "setApprovalForAll",

      contractVerified: true,

      effects: {
        swaps: [],

        approvals: [
          {
            type: "ERC721_OPERATOR",

            token: CONTRACT,

            owner: USER,

            operator: SPENDER,

            approved: true,

            sourceFunction: "setApprovalForAll",
          },
        ],
      },

      intentAllowsApproval: false,
    });

    expect(findings.some((finding) => finding.code === "UNEXPECTED_NFT_OPERATOR")).toBe(true);

    expect(findings.find((finding) => finding.code === "UNEXPECTED_NFT_OPERATOR")?.severity).toBe("CRITICAL");
  });

  test("detects unknown execution with native value", () => {
    const findings = analyzeTransactionThreats({
      from: USER,

      to: CONTRACT,

      value: 1000000000000000n,

      action: "UNKNOWN",

      functionName: null,

      contractVerified: false,

      effects: {
        swaps: [],

        approvals: [],
      },

      intentAllowsApproval: false,
    });

    expect(findings.some((finding) => finding.code === "UNKNOWN_EXECUTION_PATH")).toBe(true);
  });
});
