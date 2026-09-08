import { describe, expect, test } from "bun:test";

import { encodeFunctionData, type Address } from "viem";

import { pancakeswapUniversalRouterAbi } from "../../lib/protocols/pancakeswap";

import { analyzeEffects } from "../effect-analyzer";

import { decodeTransactionData } from "../../lib/decoder";

const ROUTER = "0x87FD5305E6a40F378da124864B2D479c2028BD86" as Address;

const USER = "0x53E993819F2Bc45A029615e8634BDdEEab4F7817" as Address;

const TOKEN_IN = "0x1111111111111111111111111111111111111111" as Address;

const TOKEN_OUT = "0x2222222222222222222222222222222222222222" as Address;

const PATH = `0x${TOKEN_IN.slice(2)}0001f4${TOKEN_OUT.slice(2)}` as `0x${string}`;

describe("PancakeSwap Effect Analysis", () => {
  test("should convert execute() into SWAP effect", async () => {
    /**
     * Build the inner V3 swap input.
     */
    const innerInput = (await import("viem")).encodeAbiParameters([{ type: "address" }, { type: "uint256" }, { type: "uint256" }, { type: "bytes" }, { type: "bool" }], [USER, 10_000_000n, 9_000_000n, PATH, true]);

    /**
     * Build Universal Router execute().
     *
     * command 0x00 =
     * V3_SWAP_EXACT_IN
     */
    const data = encodeFunctionData({
      abi: pancakeswapUniversalRouterAbi,
      functionName: "execute",
      args: ["0x00", [innerInput]],
    });

    const decoded = await decodeTransactionData({
      chainId: 97,
      to: ROUTER,
      data,
    });

    expect(decoded.decoded).toBe(true);

    expect(decoded.functionName).toBe("execute");

    expect(decoded.abiSource).toBe("protocol");

    expect(decoded.protocol).toBe("PancakeSwap");

    const effects = analyzeEffects({
      from: USER,
      to: ROUTER,
      functionName: decoded.functionName,
      args: decoded.args,
      protocol: decoded.protocol,
    });

    expect(effects.swaps).toHaveLength(1);

    const swap = effects.swaps[0]!;

    expect(swap.type).toBe("SWAP");

    expect(swap.protocol).toBe("PancakeSwap");

    expect(swap.tokenIn).toBe(TOKEN_IN);

    expect(swap.tokenOut).toBe(TOKEN_OUT);

    expect(swap.amountIn).toBe(10_000_000n);

    expect(swap.amountOutMin).toBe(9_000_000n);

    expect(swap.recipient).toBe(USER);

    expect(swap.payerIsUser).toBe(true);
  });
});
