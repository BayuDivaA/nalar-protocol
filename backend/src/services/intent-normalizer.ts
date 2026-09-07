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

  return {
    ...intent,
    maxValueWei,
  };
}
