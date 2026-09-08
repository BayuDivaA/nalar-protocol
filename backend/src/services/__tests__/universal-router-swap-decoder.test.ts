import { describe, expect, test } from "bun:test";

import { encodeAbiParameters, type Address } from "viem";

import { decodeV3SwapExactIn } from "../universal-router-swap-decoder";

const TOKEN_IN = "0x1111111111111111111111111111111111111111" as Address;

const TOKEN_MIDDLE = "0x2222222222222222222222222222222222222222" as Address;

const TOKEN_OUT = "0x3333333333333333333333333333333333333333" as Address;

const RECIPIENT = "0x4444444444444444444444444444444444444444" as Address;

const PATH = `0x${TOKEN_IN.slice(2)}${"0001f4"}${TOKEN_MIDDLE.slice(2)}${"000bb8"}${TOKEN_OUT.slice(2)}` as `0x${string}`;

describe("Universal Router V3 Swap Decoder", () => {
  test("should decode V3 exact input swap", () => {
    const input = encodeAbiParameters([{ type: "address" }, { type: "uint256" }, { type: "uint256" }, { type: "bytes" }, { type: "bool" }], [RECIPIENT, 10_000_000_000_000_000_000n, 9_500_000_000_000_000_000n, PATH, true]);

    const result = decodeV3SwapExactIn(input);

    expect(result.command).toBe("V3_SWAP_EXACT_IN");

    expect(result.recipient).toBe(RECIPIENT);

    expect(result.amountIn).toBe(10_000_000_000_000_000_000n);

    expect(result.amountOutMin).toBe(9_500_000_000_000_000_000n);

    expect(result.payerIsUser).toBe(true);

    expect(result.tokenIn).toBe(TOKEN_IN);

    expect(result.tokenOut).toBe(TOKEN_OUT);

    expect(result.hopTokens).toEqual([TOKEN_IN, TOKEN_MIDDLE, TOKEN_OUT]);

    expect(result.fees).toEqual([500, 3000]);
  });

  test("should reject invalid V3 path", () => {
    const input = encodeAbiParameters([{ type: "address" }, { type: "uint256" }, { type: "uint256" }, { type: "bytes" }, { type: "bool" }], [RECIPIENT, 1n, 1n, "0x1234", true]);

    expect(() => decodeV3SwapExactIn(input)).toThrow("Invalid V3 path");
  });
});
