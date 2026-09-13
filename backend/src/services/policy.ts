import { parseEther } from "viem";

import type { TransactionAction } from "../lib/classifier";
import type { Policy, PolicyEvaluation } from "../types/policy";

export const defaultPolicy: Policy = {
  maxSpendBNB: "1",

  allowedActions: ["MINT", "TOKEN_TRANSFER", "NFT_TRANSFER", "SWAP", "PAYMENT", "TRANSFER"],

  forbiddenActions: ["TOKEN_APPROVAL", "NFT_APPROVAL", "TOKEN_TRANSFER_FROM", "UNKNOWN"],

  requireReviewAboveBNB: "0.5",
};

export function evaluatePolicy(input: { policy: Policy; action: TransactionAction; value: bigint }): PolicyEvaluation {
  const { policy, action, value } = input;

  const reasons: string[] = [];

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

  if (policy.forbiddenActions.includes(action)) {
    reasons.push(`Action ${action} is forbidden by policy.`);

    return {
      allowed: false,
      requiresReview: false,
      reasons,
    };
  }

  if (!policy.allowedActions.includes(action)) {
    reasons.push(`Action ${action} is not included in the allowed actions.`);

    return {
      allowed: false,
      requiresReview: false,
      reasons,
    };
  }

  if (value > maxSpendWei) {
    reasons.push(`Transaction value exceeds the policy maximum of ${policy.maxSpendBNB} BNB.`);

    return {
      allowed: false,
      requiresReview: false,
      reasons,
    };
  }

  if (value > reviewThresholdWei) {
    reasons.push(`Transaction exceeds the policy review threshold of ${policy.requireReviewAboveBNB} BNB.`);

    return {
      allowed: true,
      requiresReview: true,
      reasons,
    };
  }

  return {
    allowed: true,
    requiresReview: false,
    reasons: [],
  };
}
