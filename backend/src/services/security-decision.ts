import type { IntentComparison } from "./intent-comparator";
import type { TransactionEffects } from "./effect-analyzer";
import type { RiskResult } from "./risk-engine";

export type SecurityDecision = "ALLOW" | "REVIEW" | "BLOCK";

export interface SecurityDecisionResult {
  decision: SecurityDecision;
  reasons: string[];
}

export function makeSecurityDecision(input: { simulationSuccess: boolean; risk: RiskResult; comparison: IntentComparison; effects: TransactionEffects }): SecurityDecisionResult {
  const reasons = new Set<string>();

  /**
   * 1. Simulation failure = BLOCK
   */
  if (!input.simulationSuccess) {
    reasons.add("Transaction simulation reverted.");

    return {
      decision: "BLOCK",
      reasons: [...reasons],
    };
  }

  /**
   * 2. Critical security signal = BLOCK
   */
  if (input.risk.level === "CRITICAL") {
    for (const reason of input.risk.reasons) {
      reasons.add(reason);
    }

    return {
      decision: "BLOCK",
      reasons: [...reasons],
    };
  }

  /**
   * 3. Intent mismatch
   */
  if (!input.comparison.matches) {
    for (const mismatch of input.comparison.mismatches) {
      reasons.add(mismatch);
    }

    /**
     * High-risk mismatch:
     * BLOCK
     */
    if (input.risk.level === "HIGH") {
      return {
        decision: "BLOCK",
        reasons: [...reasons],
      };
    }

    /**
     * Lower-risk mismatch:
     * REVIEW
     */
    return {
      decision: "REVIEW",
      reasons: [...reasons],
    };
  }

  /**
   * 4. High risk without intent mismatch
   */
  if (input.risk.level === "HIGH") {
    for (const reason of input.risk.reasons) {
      reasons.add(reason);
    }

    return {
      decision: "REVIEW",
      reasons: [...reasons],
    };
  }

  /**
   * 5. Everything looks consistent.
   */
  return {
    decision: "ALLOW",
    reasons: [],
  };
}
