import { describe, expect, test } from "bun:test";

import { encodeAbiParameters, getAddress } from "viem";

import { decodeV2SwapExactIn } from "../universal-router-v2-swap-decoder";

const RECIPIENT = getAddress("0x0000000000000000000000000000000000000002");

const TOKEN_IN = getAddress("0xae13d989dac2f0debff460ac112a837c89baa7cd");

const TOKEN_OUT = getAddress("0x337610d27c682e347c9cd60bd4b3b107c9d34ddd");

const AMOUNT_IN = 200_000_000_000_000_000n;

const AMOUNT_OUT_MIN = 1_000_000_000_000_000_000n;

describe("Universal Router V2 Swap Decoder", () => {
  test("should decode V2 exact input swap", () => {
    const encoded = encodeAbiParameters([{ type: "address" }, { type: "uint256" }, { type: "uint256" }, { type: "address[]" }, { type: "bool" }], [RECIPIENT, AMOUNT_IN, AMOUNT_OUT_MIN, [TOKEN_IN, TOKEN_OUT], false]);

    const result = decodeV2SwapExactIn(encoded);

    expect(result.command).toBe("V2_SWAP_EXACT_IN");

    expect(result.recipient).toBe(RECIPIENT);

    expect(result.amountIn).toBe(AMOUNT_IN);

    expect(result.amountOutMin).toBe(AMOUNT_OUT_MIN);

    expect(result.payerIsUser).toBe(false);

    expect(result.tokenIn).toBe(TOKEN_IN);

    expect(result.tokenOut).toBe(TOKEN_OUT);

    expect(result.hopTokens).toEqual([TOKEN_IN, TOKEN_OUT]);
  });

  test("should reject invalid V2 path", () => {
    const encoded = encodeAbiParameters([{ type: "address" }, { type: "uint256" }, { type: "uint256" }, { type: "address[]" }, { type: "bool" }], [RECIPIENT, AMOUNT_IN, AMOUNT_OUT_MIN, [TOKEN_IN], false]);

    expect(() => decodeV2SwapExactIn(encoded)).toThrow("Invalid V2 swap path");
  });
});
