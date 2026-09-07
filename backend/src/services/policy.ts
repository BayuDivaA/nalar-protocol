import { parseEther } from "viem";

import type { TransactionAction } from "../lib/classifier";

import type { Policy, PolicyEvaluation } from "../types/policy";

/**
 * Default TxSentry security policy.
 *
 * Untuk MVP, policy dibuat statis terlebih dahulu.
 * Nanti bisa kita ubah menjadi configurable per user.
 */
export const defaultPolicy: Policy = {
  /**
   * Maximum native BNB value allowed
   * in a single transaction.
   */
  maxSpendBNB: "1",

  /**
   * Actions that are explicitly allowed.
   */
  allowedActions: ["MINT", "TOKEN_TRANSFER", "NFT_TRANSFER"],

  /**
   * Actions that are explicitly forbidden.
   *
   * Approval actions sengaja dilarang
   * untuk default consumer security mode.
   */
  forbiddenActions: ["TOKEN_APPROVAL", "NFT_APPROVAL", "TOKEN_TRANSFER_FROM", "UNKNOWN"],

  /**
   * Transactions above this value
   * require human review.
   */
  requireReviewAboveBNB: "0.5",
};

/**
 * Evaluate a transaction against a policy.
 *
 * IMPORTANT:
 * This function is deterministic.
 * No LLM is involved in policy enforcement.
 */
export function evaluatePolicy(input: {
  policy: Policy;

  action: TransactionAction;

  value: bigint;
}): PolicyEvaluation {
  const { policy, action, value } = input;

  const reasons: string[] = [];

  /**
   * Convert policy values from BNB
   * into wei for exact comparison.
   */
  let maxSpendWei: bigint;

  let reviewThresholdWei: bigint;

  try {
    maxSpendWei = parseEther(policy.maxSpendBNB);
  } catch {
    return {
      allowed: false,
      requiresReview: false,
      reasons: ["Invalid maximum spend policy."],
    };
  }

  try {
    reviewThresholdWei = parseEther(policy.requireReviewAboveBNB);
  } catch {
    return {
      allowed: false,
      requiresReview: false,
      reasons: ["Invalid review threshold policy."],
    };
  }

  /**
   * ------------------------------------------------
   * RULE 1
   * Forbidden action
   * ------------------------------------------------
   */
  if (policy.forbiddenActions.includes(action)) {
    reasons.push(`Action ${action} is forbidden by policy.`);

    return {
      allowed: false,
      requiresReview: false,
      reasons,
    };
  }

  /**
   * ------------------------------------------------
   * RULE 2
   * Action is not explicitly allowed
   * ------------------------------------------------
   *
   * We use a fail-closed approach:
   * if an action is not on the allowlist,
   * it is not automatically trusted.
   */
  if (!policy.allowedActions.includes(action)) {
    reasons.push(`Action ${action} is not included in the allowed actions.`);

    return {
      allowed: false,
      requiresReview: false,
      reasons,
    };
  }

  /**
   * ------------------------------------------------
   * RULE 3
   * Maximum spending limit
   * ------------------------------------------------
   */
  if (value > maxSpendWei) {
    reasons.push(`Transaction value exceeds the policy maximum of ${policy.maxSpendBNB} BNB.`);

    return {
      allowed: false,
      requiresReview: false,
      reasons,
    };
  }

  /**
   * ------------------------------------------------
   * RULE 4
   * Human review threshold
   * ------------------------------------------------
   */
  if (value > reviewThresholdWei) {
    reasons.push(`Transaction exceeds the policy review threshold of ${policy.requireReviewAboveBNB} BNB.`);

    return {
      allowed: true,
      requiresReview: true,
      reasons,
    };
  }

  /**
   * ------------------------------------------------
   * RULE 5
   * Everything is within policy
   * ------------------------------------------------
   */
  return {
    allowed: true,
    requiresReview: false,
    reasons: [],
  };
}
