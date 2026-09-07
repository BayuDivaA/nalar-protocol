import type { NormalizedIntent } from "./intent-normalizer";

import type { TransactionEffects } from "./effect-analyzer";

export interface IntentComparison {
  matches: boolean;

  mismatches: string[];
}

export function compareIntent(
  intent: NormalizedIntent,

  effects: TransactionEffects,

  value: bigint,
): IntentComparison {
  const mismatches: string[] = [];

  /**
   * 1. Check maximum BNB spending.
   */
  if (intent.maxValueWei !== null && value > intent.maxValueWei) {
    mismatches.push(["Transaction value exceeds the user's limit.", `Expected <= ${intent.maxValueWei.toString()} wei.`, `Received ${value.toString()} wei.`].join(" "));
  }

  /**
   * 2. Check approval side effects.
   */
  const hasApproval = effects.approvals.length > 0;

  if (hasApproval && !intent.allowApproval) {
    mismatches.push("Transaction requests an approval that the user did not intend to grant.");
  }

  /**
   * 3. Specific protection for mint intent.
   */
  if (intent.action === "MINT" && hasApproval) {
    mismatches.push("User intended to mint an NFT, but the transaction includes an approval effect.");
  }

  return {
    matches: mismatches.length === 0,

    mismatches,
  };
}
