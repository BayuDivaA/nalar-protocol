import type { ApprovalStateDiff } from "./effect-state";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskResult {
  score: number;
  level: RiskLevel;
  reasons: string[];
}

export function calculateRisk(effects: ApprovalStateDiff[], action?: string): RiskResult {
  let score = 0;

  const reasons: string[] = [];

  /**
   * Transaction-level security signal.
   *
   * Even when the previous state cannot
   * be read, the decoded action itself
   * can indicate a dangerous permission.
   */
  if (action === "NFT_APPROVAL") {
    score = Math.max(score, 90);

    reasons.push("Transaction requests NFT operator approval.");
  }

  /**
   * State-based security analysis.
   */
  for (const effect of effects) {
    if (effect.type === "ERC721_OPERATOR") {
      if (effect.after === true) {
        score = Math.max(score, 90);

        if (effect.before === false) {
          reasons.push("NFT operator approval changes from disabled to enabled.");
        } else if (effect.before === null) {
          reasons.push("NFT operator approval is requested, but the previous approval state could not be verified.");
        } else {
          reasons.push("NFT operator approval is enabled.");
        }
      }
    }
  }

  /**
   * Prevent score from exceeding 100.
   */
  score = Math.min(score, 100);

  let level: RiskLevel = "LOW";

  if (score >= 80) {
    level = "CRITICAL";
  } else if (score >= 60) {
    level = "HIGH";
  } else if (score >= 30) {
    level = "MEDIUM";
  }

  return {
    score,
    level,
    reasons,
  };
}
