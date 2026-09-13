import type { ScamFinding, ScamFindingSeverity } from "./findings";

export type ScamRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ScamRiskResult {
  score: number;
  level: ScamRiskLevel;
  reasons: string[];
}

const SEVERITY_WEIGHT: Record<ScamFindingSeverity, number> = {
  INFO: 0,
  LOW: 15,
  MEDIUM: 35,
  HIGH: 65,
  CRITICAL: 95,
};

const SEVERITY_CAP: Record<ScamFindingSeverity, number> = {
  INFO: 0,
  LOW: 25,
  MEDIUM: 55,
  HIGH: 75,
  CRITICAL: 100,
};

const SEVERITY_RANK: Record<ScamFindingSeverity, number> = {
  INFO: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

function levelForScore(score: number): ScamRiskLevel {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 30) return "MEDIUM";
  return "LOW";
}

/**
 * A scam finding's highest severity sets the score ceiling. Distinct lower
 * severity findings can increase confidence, but cannot turn noisy metadata
 * into a critical result by accumulation alone.
 */
export function calculateScamRisk(findings: readonly ScamFinding[]): ScamRiskResult {
  const unique = [...new Map(findings.map((finding) => [`${finding.code}:${finding.evidence ?? finding.title}`, finding])).values()];

  let highest: ScamFindingSeverity = "INFO";
  let score = 0;

  for (const finding of unique) {
    score += SEVERITY_WEIGHT[finding.severity];

    if (SEVERITY_RANK[finding.severity] > SEVERITY_RANK[highest]) {
      highest = finding.severity;
    }
  }

  score = Math.min(score, SEVERITY_CAP[highest]);

  return {
    score,
    level: levelForScore(score),
    reasons: unique.map((finding) => finding.title),
  };
}
