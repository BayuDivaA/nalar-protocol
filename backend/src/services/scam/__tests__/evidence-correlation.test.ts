import { describe, expect, test } from "bun:test";

import type { ContractStateEvidence } from "../evidence-provider";
import type { ScamFinding } from "../findings";
import { correlateSecurityEvidence } from "../evidence-correlation";

describe("Security evidence correlation", () => {
  test("correlates owner-controlled tax with excessive sell tax", () => {
    const findings: ScamFinding[] = [
      {
        code: "OWNER_CONTROLLED_TAX",
        severity: "HIGH",
        title: "Owner controls tax",
        description: "Owner controls the tax mechanism.",
        source: "ONCHAIN",
      },
      {
        code: "EXCESSIVE_SELL_TAX",
        severity: "CRITICAL",
        title: "Current sell tax is excessive",
        description: "Sell tax is excessive.",
        source: "ONCHAIN",
      },
    ];

    const state: ContractStateEvidence[] = [
      {
        code: "CURRENT_SELL_TAX",
        label: "sellTaxBps",
        value: "9800",
        unit: "BPS",
        status: "KNOWN",
        evidenceSource: "ONCHAIN",
      },
    ];

    const correlated = correlateSecurityEvidence({
      findings,
      state,
    });

    expect(correlated.some((finding) => finding.code === "OWNER_CONTROLLED_EXCESSIVE_SELL_TAX")).toBe(true);

    expect(correlated.find((finding) => finding.code === "OWNER_CONTROLLED_EXCESSIVE_SELL_TAX")?.severity).toBe("CRITICAL");
  });

  test("does not correlate excessive tax without owner control", () => {
    const findings: ScamFinding[] = [
      {
        code: "EXCESSIVE_SELL_TAX",
        severity: "CRITICAL",
        title: "Current sell tax is excessive",
        description: "Sell tax is excessive.",
        source: "ONCHAIN",
      },
    ];

    const correlated = correlateSecurityEvidence({
      findings,
      state: [],
    });

    expect(correlated.some((finding) => finding.code === "OWNER_CONTROLLED_EXCESSIVE_SELL_TAX")).toBe(false);
  });

  test("detects currently disabled trading", () => {
    const findings: ScamFinding[] = [
      {
        code: "TRADING_CAPABILITY",
        severity: "MEDIUM",
        title: "Trading capability detected",
        description: "Trading control exists.",
        source: "CONTRACT",
      },
    ];

    const state: ContractStateEvidence[] = [
      {
        code: "TRADING_ENABLED",
        label: "tradingEnabled",
        value: false,
        unit: "BOOLEAN",
        status: "KNOWN",
        evidenceSource: "ONCHAIN",
      },
    ];

    const correlated = correlateSecurityEvidence({
      findings,
      state,
    });

    expect(correlated.some((finding) => finding.code === "TRADING_CURRENTLY_DISABLED")).toBe(true);
  });

  test("does not claim trading is disabled when state is unknown", () => {
    const findings: ScamFinding[] = [
      {
        code: "TRADING_CAPABILITY",
        severity: "MEDIUM",
        title: "Trading capability detected",
        description: "Trading control exists.",
        source: "CONTRACT",
      },
    ];

    const state: ContractStateEvidence[] = [
      {
        code: "TRADING_ENABLED",
        label: "tradingEnabled",
        value: null,
        unit: "BOOLEAN",
        status: "UNKNOWN",
        evidenceSource: "ONCHAIN",
      },
    ];

    const correlated = correlateSecurityEvidence({
      findings,
      state,
    });

    expect(correlated.some((finding) => finding.code === "TRADING_CURRENTLY_DISABLED")).toBe(false);
  });

  test("correlates upgradeability with verified owner upgrade control", () => {
    const findings: ScamFinding[] = [
      {
        code: "UPGRADEABLE_CONTRACT",
        severity: "MEDIUM",
        title: "Upgradeable proxy detected",
        description: "Proxy detected.",
        source: "ONCHAIN",
      },
      {
        code: "OWNER_UPGRADE_CONTROL",
        severity: "HIGH",
        title: "Owner controls upgrade",
        description: "Owner controls upgrades.",
        source: "ONCHAIN",
      },
    ];

    const correlated = correlateSecurityEvidence({
      findings,
      state: [],
    });

    expect(correlated.some((finding) => finding.code === "OWNER_CONTROLLED_UPGRADE")).toBe(true);
  });
});
