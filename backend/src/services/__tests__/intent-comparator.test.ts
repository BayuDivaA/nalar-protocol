import { describe, expect, test } from "bun:test";
import type { Address } from "viem";

import { compareIntent } from "../intent-comparator";
import type { NormalizedIntent } from "../intent-normalizer";
import type { TransactionEffects } from "../effect-analyzer";

const USER = "0x53E993819F2Bc45A029615e8634BDdEEab4F7817" as Address;

const USDT = "0x1111111111111111111111111111111111111111" as Address;
const BNB = "0x2222222222222222222222222222222222222222" as Address;
const CAKE = "0x3333333333333333333333333333333333333333" as Address;

function createIntent(overrides: Partial<NormalizedIntent> = {}): NormalizedIntent {
  return {
    action: "SWAP",
    quantity: 10,
    tokenIn: "USDT",
    tokenOut: "BNB",
    maxValueNative: null,
    nativeCurrency: null,
    maxValueWei: null,
    allowApproval: false,
    targetAddress: null,
    description: "Swap 10 USDT to BNB",
    ...overrides,
  };
}

function createSwapEffects(overrides: Partial<TransactionEffects["swaps"][number]> = {}): TransactionEffects {
  return {
    approvals: [],
    swaps: [
      {
        type: "SWAP",
        protocol: "PancakeSwap",

        tokenIn: USDT,
        tokenOut: BNB,

        amountIn: 10_000_000n,
        amountOutMin: 1n,

        recipient: USER,

        payerIsUser: true,

        path: "0x" as `0x${string}`,

        hopTokens: [USDT, BNB],

        fees: [500],

        tokenInSymbol: "USDT",
        tokenOutSymbol: "BNB",

        tokenInDecimals: 6,
        tokenOutDecimals: 18,

        ...overrides,
      },
    ],
  };
}

describe("Intent Comparator — SWAP", () => {
  test("matching token pair should match", () => {
    const result = compareIntent(createIntent(), "SWAP", createSwapEffects(), 0n);

    expect(result.matches).toBe(true);
    expect(result.mismatches).toHaveLength(0);
  });

  test("wrong input token should mismatch", () => {
    const result = compareIntent(
      createIntent(),
      "SWAP",
      createSwapEffects({
        tokenIn: CAKE,
        hopTokens: [CAKE, BNB],
        tokenInSymbol: "CAKE",
      }),
      0n,
    );

    expect(result.matches).toBe(false);

    expect(result.mismatches.some((message) => message.toLowerCase().includes("input token"))).toBe(true);
  });

  test("wrong output token should mismatch", () => {
    const result = compareIntent(
      createIntent(),
      "SWAP",
      createSwapEffects({
        tokenOut: CAKE,
        hopTokens: [USDT, CAKE],
        tokenOutSymbol: "CAKE",
      }),
      0n,
    );

    expect(result.matches).toBe(false);

    expect(result.mismatches.some((message) => message.toLowerCase().includes("output token"))).toBe(true);
  });

  test("missing swap effect should mismatch", () => {
    const result = compareIntent(
      createIntent(),
      "SWAP",
      {
        approvals: [],
        swaps: [],
      },
      0n,
    );

    expect(result.matches).toBe(false);

    expect(result.mismatches.some((message) => message.toLowerCase().includes("no swap effect"))).toBe(true);
  });

  test("unspecified token should not constrain the swap", () => {
    const result = compareIntent(
      createIntent({
        tokenIn: null,
        tokenOut: null,
      }),
      "SWAP",
      createSwapEffects({
        tokenIn: CAKE,
        tokenInSymbol: "CAKE",
        tokenOut: BNB,
      }),
      0n,
    );

    expect(result.matches).toBe(true);
  });

  test("matching input amount should match", () => {
    const result = compareIntent(
      createIntent({
        quantity: 10,
      }),
      "SWAP",
      createSwapEffects({
        amountIn: 10_000_000n,
        tokenInDecimals: 6,
      }),
      0n,
    );

    expect(result.matches).toBe(true);
    expect(result.mismatches).toHaveLength(0);
  });

  test("different input amount should mismatch", () => {
    const result = compareIntent(
      createIntent({
        quantity: 10,
      }),
      "SWAP",
      createSwapEffects({
        amountIn: 100_000_000n,
        tokenInDecimals: 6,
      }),
      0n,
    );

    expect(result.matches).toBe(false);

    expect(result.mismatches.some((message) => message.toLowerCase().includes("input amount"))).toBe(true);
  });
});
