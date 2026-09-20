import { describe, expect, test } from "bun:test";
import type { Address } from "viem";

import { compareIntent } from "../intent-comparator";
import type { NormalizedIntent } from "../intent-normalizer";
import type { TransactionEffects } from "../effect-analyzer";
import { parseIntentHeuristically } from "../intent-engine";

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

describe("Intent Comparator - SWAP", () => {
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

  test("intended DHON but actual swap receives BUSD should be MISMATCH with structured field results", () => {
    const BUSD = "0x4444444444444444444444444444444444444444" as Address;
    const result = compareIntent(
      createIntent({
        tokenIn: "tBNB",
        tokenOut: "DHON",
        quantity: 0.002,
        description: "beli DHON terus dengan bayar pake 0.002 tBNB",
      }),
      "SWAP",
      createSwapEffects({
        tokenIn: BNB,
        tokenInSymbol: "WBNB",
        tokenInDecimals: 18,
        amountIn: 2_000_000_000_000_000n,
        tokenOut: BUSD,
        tokenOutSymbol: "BUSD",
        tokenOutDecimals: 18,
      }),
      0n,
    );

    expect(result.matches).toBe(false);
    expect(result.overall).toBe("MISMATCH");
    expect(result.action.status).toBe("MATCH");
    expect(result.inputToken.status).toBe("MATCH");
    expect(result.amount.status).toBe("MATCH");
    expect(result.outputToken.status).toBe("MISMATCH");
    expect(result.outputToken.expected).toBe("DHON");
    expect(result.outputToken.actual).toBe("BUSD");
    expect(result.summary).toContain("DHON");
    expect(result.summary).toContain("BUSD");
  });

  test("unknown intent should produce UNCERTAIN and matches=false", () => {
    const result = compareIntent(
      createIntent({
        action: "UNKNOWN",
        description: "something completely random and unparseable",
      }),
      "SWAP",
      createSwapEffects(),
      0n,
    );

    expect(result.matches).toBe(false);
    expect(result.overall).toBe("UNCERTAIN");
  });
});

describe("Intent Comparator - MINT and Invariant Checks", () => {
  const CONTRACT = "0x5555555555555555555555555555555555555555" as Address;
  const EOA = "0x6666666666666666666666666666666666666666" as Address;

  function createMintIntent(overrides: Partial<NormalizedIntent> = {}): NormalizedIntent {
    return {
      action: "MINT",
      quantity: 300,
      tokenIn: "tBNB",
      tokenOut: null,
      maxValueNative: "2",
      nativeCurrency: "BNB",
      maxValueWei: 2_000_000_000_000_000_000n, // 2 tBNB
      allowApproval: false,
      targetAddress: null,
      description: "Mint 300 NFTs for 2 tBNB",
      ...overrides,
    };
  }

  // Test 1: "Mint 300 NFTs for 2 tBNB" vs "Mint 1 NFT with 0.02 tBNB to EOA"
  test("Test 1: Mint 300 NFTs for 2 tBNB vs 1 NFT with 0.02 tBNB to EOA produces MISMATCH", () => {
    const result = compareIntent(
      createMintIntent(),
      "MINT",
      {
        approvals: [],
        swaps: [],
        mints: [{ type: "MINT", contract: EOA, recipient: USER, quantity: 1 }],
      },
      20_000_000_000_000_000n, // 0.02 tBNB
      { targetIsContract: false, actualQuantity: 1 },
    );

    expect(result.matches).toBe(false);
    expect(result.overall).toBe("MISMATCH");
    expect(result.quantity?.status).toBe("MISMATCH");
    expect(result.quantity?.expected).toBe(300);
    expect(result.quantity?.actual).toBe(1);
    expect(result.amount.status).toBe("MISMATCH");
    expect(result.amount.expected).toBe("2 tBNB");
    expect(result.amount.actual).toBe("0.02 tBNB");
    expect(result.mismatches.some((m) => m.toLowerCase().includes("quantity mismatch"))).toBe(true);
    expect(result.mismatches.some((m) => m.toLowerCase().includes("payment mismatch"))).toBe(true);
  });

  // Test 2: "Mint 1 NFT for 0.02 tBNB" vs "Mint 1 NFT with 0.02 tBNB to contract"
  test("Test 2: Mint 1 NFT for 0.02 tBNB vs 1 NFT with 0.02 tBNB to contract produces MATCH", () => {
    const result = compareIntent(
      createMintIntent({
        quantity: 1,
        maxValueNative: "0.02",
        maxValueWei: 20_000_000_000_000_000n,
        description: "Mint 1 NFT for 0.02 tBNB",
      }),
      "MINT",
      {
        approvals: [],
        swaps: [],
        mints: [{ type: "MINT", contract: CONTRACT, recipient: USER, quantity: 1 }],
      },
      20_000_000_000_000_000n, // 0.02 tBNB
      { targetIsContract: true, actualQuantity: 1 },
    );

    expect(result.matches).toBe(true);
    expect(result.overall).toBe("MATCH");
    expect(result.quantity?.status).toBe("MATCH");
    expect(result.quantity?.expected).toBe(1);
    expect(result.quantity?.actual).toBe(1);
    expect(result.amount.status).toBe("MATCH");
    expect(result.mismatches).toHaveLength(0);
  });

  // Test 3: "Mint 300 NFTs for 2 tBNB" vs "Mint 300 NFTs with 0.02 tBNB" (Payment mismatch)
  test("Test 3: Mint 300 NFTs for 2 tBNB vs 300 NFTs with 0.02 tBNB produces MISMATCH due to payment", () => {
    const result = compareIntent(
      createMintIntent(),
      "MINT",
      {
        approvals: [],
        swaps: [],
        mints: [{ type: "MINT", contract: CONTRACT, recipient: USER, quantity: 300 }],
      },
      20_000_000_000_000_000n, // 0.02 tBNB
      { targetIsContract: true, actualQuantity: 300 },
    );

    expect(result.matches).toBe(false);
    expect(result.overall).toBe("MISMATCH");
    expect(result.quantity?.status).toBe("MATCH");
    expect(result.amount.status).toBe("MISMATCH");
    expect(result.amount.expected).toBe("2 tBNB");
    expect(result.amount.actual).toBe("0.02 tBNB");
    expect(result.mismatches.some((m) => m.toLowerCase().includes("payment mismatch"))).toBe(true);
  });

  // Test 4: "Mint 300 NFTs for 2 tBNB" vs "Mint 1 NFT with 2 tBNB" (Quantity mismatch)
  test("Test 4: Mint 300 NFTs for 2 tBNB vs 1 NFT with 2 tBNB produces MISMATCH due to quantity", () => {
    const result = compareIntent(
      createMintIntent(),
      "MINT",
      {
        approvals: [],
        swaps: [],
        mints: [{ type: "MINT", contract: CONTRACT, recipient: USER, quantity: 1 }],
      },
      2_000_000_000_000_000_000n, // 2 tBNB
      { targetIsContract: true, actualQuantity: 1 },
    );

    expect(result.matches).toBe(false);
    expect(result.overall).toBe("MISMATCH");
    expect(result.quantity?.status).toBe("MISMATCH");
    expect(result.quantity?.expected).toBe(300);
    expect(result.quantity?.actual).toBe(1);
    expect(result.amount.status).toBe("MATCH");
    expect(result.mismatches.some((m) => m.toLowerCase().includes("quantity mismatch"))).toBe(true);
  });

  // Test 5: "Mint 300 NFTs for 2 tBNB" vs "Unknown quantity with 2 tBNB" (UNKNOWN != MATCH)
  test("Test 5: Mint 300 NFTs for 2 tBNB vs unknown quantity produces UNCERTAIN", () => {
    const result = compareIntent(
      createMintIntent(),
      "MINT",
      {
        approvals: [],
        swaps: [],
        mints: [],
      },
      2_000_000_000_000_000_000n, // 2 tBNB
      { targetIsContract: true, actualQuantity: null },
    );

    expect(result.matches).toBe(false);
    expect(result.overall).toBe("UNCERTAIN");
    expect(result.quantity?.status).toBe("UNSPECIFIED");
    expect(result.amount.status).toBe("MATCH");
  });

  // Test 6: Intent parser extracts quantity and payment for MINT
  test("Test 6: parseIntentHeuristically extracts quantity and payment for MINT", () => {
    const parsed = parseIntentHeuristically("Mint 300 NFTs for 2 tBNB");

    expect(parsed.action).toBe("MINT");
    expect(parsed.quantity).toBe(300);
    expect(parsed.maxValueNative).toBe("2");
    expect(parsed.nativeCurrency).toBe("BNB");
    expect(parsed.tokenIn).toBe("tBNB");
  });
});
