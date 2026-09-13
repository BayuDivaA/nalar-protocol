import type { ContractStateEvidence } from "./evidence-provider";
import type { ScamFinding } from "./findings";

function hasFinding(findings: readonly ScamFinding[], code: ScamFinding["code"]): boolean {
  return findings.some((finding) => finding.code === code);
}

function findState(state: readonly ContractStateEvidence[], code: ContractStateEvidence["code"]): ContractStateEvidence | undefined {
  return state.find((item) => item.code === code);
}

/**
 * Correlates independent deterministic evidence into stronger security signals.
 *
 * This function MUST remain deterministic.
 * AI/agents must not participate in the correlation itself.
 */
export function correlateSecurityEvidence(input: { findings: readonly ScamFinding[]; state: readonly ContractStateEvidence[] }): ScamFinding[] {
  const correlated: ScamFinding[] = [];

  /*
   * OWNER-CONTROLLED SELL TAX
   *
   * Separate evidence:
   *   OWNER_CONTROLLED_TAX
   *   EXCESSIVE_SELL_TAX
   *
   * Combined:
   *   owner has verified control over a currently excessive sell tax.
   */
  if (hasFinding(input.findings, "OWNER_CONTROLLED_TAX") && hasFinding(input.findings, "EXCESSIVE_SELL_TAX")) {
    const sellTax = findState(input.state, "CURRENT_SELL_TAX");

    correlated.push({
      code: "OWNER_CONTROLLED_EXCESSIVE_SELL_TAX",
      severity: "CRITICAL",
      title: "Owner controls an excessive sell tax",
      description: "Verified owner control over the sell-tax mechanism is combined with an observed excessive current sell tax.",
      evidence: sellTax
        ? `${sellTax.label}=${String(sellTax.value)} ${sellTax.unit ?? ""}. The contract evidence also establishes owner control over the tax mechanism.`
        : "Verified owner control over the sell-tax mechanism was combined with an excessive current sell-tax finding.",
      source: "ONCHAIN",
    });
  }

  /*
   * CURRENTLY DISABLED TRADING
   *
   * Capability:
   *   TRADING_CAPABILITY
   *
   * State:
   *   TRADING_ENABLED = false
   *
   * This is a state signal, not automatically a scam verdict.
   */
  const tradingState = findState(input.state, "TRADING_ENABLED");

  if (hasFinding(input.findings, "TRADING_CAPABILITY") && tradingState?.status === "KNOWN" && tradingState.value === false) {
    correlated.push({
      code: "TRADING_CURRENTLY_DISABLED",
      severity: "MEDIUM",
      title: "Token trading is currently disabled",
      description: "The contract exposes trading controls and the current on-chain trading state is disabled.",
      evidence: tradingState.evidence ?? `${tradingState.label}=false`,
      source: "ONCHAIN",
    });
  }

  /*
   * UPGRADE CONTROL + DANGEROUS OWNER CONTROL
   *
   * The presence of an upgrade mechanism plus verified owner upgrade
   * control is stronger evidence than either finding independently.
   */
  if (hasFinding(input.findings, "UPGRADEABLE_CONTRACT") && hasFinding(input.findings, "OWNER_UPGRADE_CONTROL")) {
    correlated.push({
      code: "OWNER_CONTROLLED_UPGRADE",
      severity: "HIGH",
      title: "Owner controls contract upgrades",
      description: "The contract is upgradeable and available evidence establishes owner control over the upgrade mechanism.",
      evidence: "Upgradeable proxy evidence is combined with verified owner upgrade control.",
      source: "ONCHAIN",
    });
  }

  return correlated;
}
