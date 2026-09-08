import { describe, expect, test } from "bun:test";

import { encodeFunctionData } from "viem";

import { pancakeswapUniversalRouterAbi } from "../../lib/protocols/pancakeswap";

import { decodeTransactionData } from "../../lib/decoder";

const ROUTER = "0x87FD5305E6a40F378da124864B2D479c2028BD86";

describe("PancakeSwap Universal Router", () => {
  test("should resolve PancakeSwap execute()", async () => {
    const data = encodeFunctionData({
      abi: pancakeswapUniversalRouterAbi,
      functionName: "execute",
      args: ["0x", []],
    });

    const result = await decodeTransactionData({
      chainId: 97,
      to: ROUTER,
      data,
    });

    expect(result.decoded).toBe(true);

    expect(result.functionName).toBe("execute");

    expect(result.abiSource).toBe("protocol");

    expect(result.contractVerified).toBe(true);
  });
});
