import type { ApprovalEffect } from "./effect-analyzer";
import type { ApprovalStateDiff } from "./effect-state";
import type { ScamRiskResult } from "./scam/scam-risk-engine";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskResult {
  score: number;
  level: RiskLevel;
  reasons: string[];
}

const RISK_RANK: Record<RiskLevel, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

export function calculateRisk(effects: ApprovalStateDiff[], action?: string, approvalEffects: ApprovalEffect[] = []): RiskResult {
  let score = 0;

  const reasons: string[] = [];

  /**
   * --------------------------------------------------
   * NFT approval
   * --------------------------------------------------
   */
  if (action === "NFT_APPROVAL") {
    score = Math.max(score, 90);

    reasons.push("Transaction requests NFT operator approval.");
  }

  /**
   * --------------------------------------------------
   * ERC20 approval
   * --------------------------------------------------
   *
   * ERC20 approve() creates an allowance for a spender.
   *
   * Unlimited allowance is a stronger security signal
   * because the spender can potentially use the entire
   * token balance allowed by the approval.
   */
  for (const approval of approvalEffects) {
    if (approval.type !== "ERC20_ALLOWANCE") {
      continue;
    }

    if (approval.unlimited) {
      score = Math.max(score, 90);

      reasons.push("Transaction requests an unlimited ERC20 token allowance.");
    } else {
      score = Math.max(score, 60);

      reasons.push("Transaction grants an ERC20 token allowance to another address.");
    }
  }

  /**
   * --------------------------------------------------
   * NFT approval state analysis
   * --------------------------------------------------
   */
  for (const effect of effects) {
    if (effect.type !== "ERC721_OPERATOR") {
      continue;
    }

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

export function mergeScamRisk(risk: RiskResult, scamRisk: ScamRiskResult | null): RiskResult {
  if (!scamRisk) return risk;

  const level = RISK_RANK[risk.level] >= RISK_RANK[scamRisk.level] ? risk.level : scamRisk.level;

  return {
    score: Math.max(risk.score, scamRisk.score),
    level,
    reasons: [...new Set([...risk.reasons, ...scamRisk.reasons])],
  };
}
