import { describe, expect, test } from "bun:test";

import { encodeFunctionData } from "viem";

import { decodeTransactionData } from "../../lib/decoder";

const EXTERNAL_CONTRACT = "0x63E936adccAb39D3b18EB707d0A3E2f3454465ac";

const depositAbi = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "amount",
        type: "uint256",
      },
    ],
    outputs: [],
  },
] as const;

describe("External Contract Decoder", () => {
  test("should decode deposit() from verified external contract", async () => {
    const data = encodeFunctionData({
      abi: depositAbi,
      functionName: "deposit",
      args: [1_000_000n],
    });

    const result = await decodeTransactionData(data, {
      chainId: 97,
      to: EXTERNAL_CONTRACT,
    });

    expect(result.decoded).toBe(true);
    expect(result.functionName).toBe("deposit");

    expect(result.abiSource).toBe("sourcify");

    expect(result.contractVerified).toBe(true);

    expect(result.classification.action).toBe("DEPOSIT");
  });
});
