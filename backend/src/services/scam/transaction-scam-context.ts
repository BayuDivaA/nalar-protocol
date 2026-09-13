import type { Address } from "viem";

import type { TokenScamAnalysis } from "./findings";
import { calculateScamRisk } from "./scam-risk-engine";
import type { ScamRiskResult } from "./scam-risk-engine";

export interface TransactionScamContext {
  affectedTokens: Address[];
  analyses: TokenScamAnalysis[];
  risk: ScamRiskResult | null;
  critical: boolean;
  highRisk: boolean;
}

export function buildTransactionScamContext(analyses: readonly TokenScamAnalysis[]): TransactionScamContext {
  const affectedTokens = [...new Map(analyses.map((analysis) => [analysis.token.toLowerCase(), analysis.token])).values()];

  const findings = analyses.flatMap((analysis) => analysis.findings);

  const risk = findings.length > 0 ? calculateScamRisk(findings) : null;

  return {
    affectedTokens,
    analyses: [...analyses],
    risk,
    critical: analyses.some((analysis) => analysis.riskLevel === "CRITICAL"),
    highRisk: analyses.some((analysis) => analysis.riskLevel === "HIGH" || analysis.riskLevel === "CRITICAL"),
  };
}
