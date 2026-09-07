import type { NormalizedIntent } from "./intent-normalizer";

import type { TransactionEffects } from "./effect-analyzer";
import type { TransactionAction } from "../lib/classifier";

export interface IntentComparison {
  matches: boolean;

  mismatches: string[];
}

export function compareIntent(intent: NormalizedIntent, actualAction: TransactionAction, effects: TransactionEffects, value: bigint): IntentComparison {
  const mismatches: string[] = [];

  /**
   * 1. Check maximum BNB spending.
   */
  if (intent.maxValueWei !== null && value > intent.maxValueWei) {
    mismatches.push(["Transaction value exceeds the user's limit.", `Expected <= ${intent.maxValueWei.toString()} wei.`, `Received ${value.toString()} wei.`].join(" "));
  }

  /**
   * 2. Check semantic action.
   *
   * Example:
   * Intent  : MINT
   * Actual  : NFT_APPROVAL
   *
   * This is an intent mismatch.
   */
  if (intent.action !== "UNKNOWN" && intent.action !== actualAction) {
    mismatches.push([`User intended to ${intent.action.toLowerCase()}.`, `Transaction actually performs ${actualAction.toLowerCase()}.`].join(" "));
  }

  /**
   * 3. Check approval side effects.
   */
  const hasApproval = effects.approvals.length > 0;

  if (hasApproval && !intent.allowApproval) {
    mismatches.push("Transaction requests an approval that the user did not intend to grant.");
  }

  /**
   * 4. Specific protection for mint intent.
   *
   * Minting should not silently introduce
   * approval side effects.
   */
  if (intent.action === "MINT" && hasApproval) {
    mismatches.push("User intended to mint an NFT, but the transaction includes an approval effect.");
  }

  return {
    matches: mismatches.length === 0,
    mismatches,
  };
}
