import type { IntentComparison } from "./intent-comparator";
import type { TransactionEffects } from "./effect-analyzer";
import type { RiskResult } from "./risk-engine";
import type { PolicyEvaluation } from "../types/policy";

export type SecurityDecision = "ALLOW" | "REVIEW" | "BLOCK";

export interface SecurityDecisionResult {
  decision: SecurityDecision;
  reasons: string[];
}

export function makeSecurityDecision(input: { simulationSuccess: boolean; risk: RiskResult; comparison: IntentComparison; effects: TransactionEffects; policy: PolicyEvaluation }): SecurityDecisionResult {
  const reasons = new Set<string>();

  if (!input.simulationSuccess) {
    reasons.add("Transaction simulation reverted.");
    return {
      decision: "BLOCK",
      reasons: [...reasons],
    };
  }

  if (!input.policy.allowed) {
    for (const reason of input.policy.reasons) {
      reasons.add(reason);
    }

    return {
      decision: "BLOCK",
      reasons: [...reasons],
    };
  }

  if (input.risk.level === "CRITICAL") {
    for (const reason of input.risk.reasons) {
      reasons.add(reason);
    }

    return {
      decision: "BLOCK",
      reasons: [...reasons],
    };
  }

  if (!input.comparison.matches) {
    for (const mismatch of input.comparison.mismatches) {
      reasons.add(mismatch);
    }

    if (input.risk.level === "HIGH") {
      return {
        decision: "BLOCK",
        reasons: [...reasons],
      };
    }

    return {
      decision: "REVIEW",
      reasons: [...reasons],
    };
  }

  if (input.policy.requiresReview) {
    for (const reason of input.policy.reasons) {
      reasons.add(reason);
    }

    return {
      decision: "REVIEW",
      reasons: [...reasons],
    };
  }

  if (input.risk.level === "HIGH") {
    for (const reason of input.risk.reasons) {
      reasons.add(reason);
    }

    return {
      decision: "REVIEW",
      reasons: [...reasons],
    };
  }

  return {
    decision: "ALLOW",
    reasons: [],
  };
}
