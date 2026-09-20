import { parseEther } from "viem";

import type { UserIntent } from "../types/intent";

export interface NormalizedIntent extends UserIntent {
  maxValueWei: bigint | null;
}

export function normalizeIntent(intent: UserIntent): NormalizedIntent {
  let maxValueWei: bigint | null = null;

  if (intent.maxValueNative !== null) {
    if (intent.nativeCurrency !== "BNB") {
      throw new Error("Unsupported native currency.");
    }

    maxValueWei = parseEther(intent.maxValueNative);
  }

  const tokenIn = intent.tokenIn ?? intent.inputAsset ?? null;
  const tokenOut = intent.tokenOut ?? intent.outputAsset ?? null;

  return {
    ...intent,
    tokenIn,
    tokenOut,
    inputAsset: intent.inputAsset ?? tokenIn,
    outputAsset: intent.outputAsset ?? tokenOut,
    maxValueWei,
  };
}
