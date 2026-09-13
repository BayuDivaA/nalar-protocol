import type { IntentComparison } from "./intent-comparator";
import type { TransactionEffects } from "./effect-analyzer";
import type { RiskResult } from "./risk-engine";
import type { PolicyEvaluation } from "../types/policy";
import type { TokenScamAnalysis } from "./scam/findings";

export type SecurityDecision = "ALLOW" | "REVIEW" | "BLOCK";

export interface SecurityDecisionResult {
  decision: SecurityDecision;
  reasons: string[];
}

export function makeSecurityDecision(input: {
  simulationSuccess: boolean;
  risk: RiskResult;
  comparison: IntentComparison;
  effects: TransactionEffects;
  policy: PolicyEvaluation;
  scamAnalyses?: readonly TokenScamAnalysis[];
}): SecurityDecisionResult {
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

  const criticalScamAnalyses = input.scamAnalyses?.filter((analysis) => analysis.riskLevel === "CRITICAL") ?? [];

  if (criticalScamAnalyses.length > 0) {
    for (const analysis of criticalScamAnalyses) {
      for (const finding of analysis.findings) {
        if (finding.severity === "CRITICAL") {
          reasons.add(`${analysis.token}: ${finding.title}`);
        }
      }
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

    if (input.policy.requiresReview) {
      for (const reason of input.policy.reasons) {
        reasons.add(reason);
      }
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
