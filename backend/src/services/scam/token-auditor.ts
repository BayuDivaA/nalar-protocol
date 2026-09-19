import type { Address } from "viem";

import { bscEvidenceProvider } from "./bsc-evidence-provider";
import type { SwapEffect } from "../effect-analyzer";
import type { BlockchainEvidenceProvider, ContractCapability, ContractEvidence, ScamInvestigator } from "./evidence-provider";
import type { ScamFinding, SellSimulation, TokenScamAnalysis } from "./findings";
import { analyzePrivilegeEvidence } from "./privilege-analysis";
import { calculateScamRisk } from "./scam-risk-engine";
import { correlateSecurityEvidence } from "./evidence-correlation";

function unavailableEvidence(): ContractEvidence {
  return {
    verified: null,
    proxy: null,
    implementation: null,
    owner: null,
    codeAvailable: null,
    capabilities: [],
  };
}

export async function auditToken(input: { chainId: number; token: Address; owner: Address; router: Address; swap?: SwapEffect; provider?: BlockchainEvidenceProvider; investigator?: ScamInvestigator }): Promise<TokenScamAnalysis> {
  const provider: BlockchainEvidenceProvider = input.provider ?? bscEvidenceProvider;
  const findings: ScamFinding[] = [];

  let evidence: ContractEvidence = unavailableEvidence();
  let inspectionUnavailable = false;

  try {
    evidence = await provider.inspectContract({ chainId: input.chainId, address: input.token });
  } catch {
    inspectionUnavailable = true;
    findings.push({ code: "CONTRACT_EVIDENCE_UNAVAILABLE", severity: "MEDIUM", title: "Contract evidence is unavailable", description: "The contract could not be inspected, so its safety properties remain unknown.", source: "ONCHAIN" });
  }

  if (evidence.verified === false) {
    findings.push({ code: "UNVERIFIED_CONTRACT", severity: "INFO", title: "Contract source is unverified", description: "No verified ABI or source match was available for this contract.", source: "CONTRACT" });
  }

  if (!inspectionUnavailable && (evidence.verified === null || evidence.codeAvailable === null)) {
    findings.push({
      code: "CONTRACT_EVIDENCE_UNAVAILABLE",
      severity: "MEDIUM",
      title: "Contract evidence is incomplete",
      description: "Verification or bytecode evidence is unavailable; this is not evidence that the token is safe.",
      source: "ONCHAIN",
    });
  }

  if (evidence.proxy === true) {
    findings.push({
      code: "UPGRADEABLE_CONTRACT",
      severity: "MEDIUM",
      title: "Upgradeable proxy detected",
      description: "The contract uses a discovered proxy implementation slot and its behavior can change after deployment.",
      source: "ONCHAIN",
    });

    if (evidence.implementation === null) {
      findings.push({
        code: "PROXY_IMPLEMENTATION_UNKNOWN",
        severity: "MEDIUM",
        title: "Proxy implementation is unknown",
        description: "The contract appears to be upgradeable, but its implementation address could not be resolved.",
        source: "ONCHAIN",
      });
    }
  }

  // ------------------------------------------------------------
  // BNB investigator enrichment
  // ------------------------------------------------------------
  let agentAnalysis: {
    available: boolean;
    summary: string | null;
  } = {
    available: false,
    summary: null,
  };

  if (input.investigator) {
    try {
      const observation = await input.investigator.investigate({
        chainId: input.chainId,
        token: input.token,
        evidence,
      });

      agentAnalysis = {
        available: true,
        summary: observation.summary,
      };

      // MCP investigator is an evidence provider only.
      // It may enrich deterministic state, but it never directly
      // produces ALLOW/BLOCK decisions.
      if (observation.state?.length) {
        evidence = {
          ...evidence,
          state: [...(evidence.state ?? []), ...observation.state],
        };
      }

      if (!evidence.owner && observation.owner) {
        evidence = {
          ...evidence,
          owner: observation.owner,
        };
      }
    } catch {
      // Investigator failure is intentionally non-authoritative.
      // Deterministic evidence must continue normally.
    }
  }

  const accessControl = evidence.accessControl ?? [];

  const state = evidence.state ?? [];

  // ------------------------------------------------------------
  // Deterministic analysis AFTER MCP enrichment
  // ------------------------------------------------------------
  findings.push(
    ...analyzePrivilegeEvidence({
      capabilities: evidence.capabilities,
      accessControl,
      state,
    }),
  );

  findings.push(
    ...correlateSecurityEvidence({
      findings,
      state,
    }),
  );

  if (evidence.market?.liquidity?.level === "LOW") {
    findings.push({
      code: "LIQUIDITY_LOW",
      severity: "MEDIUM",
      title: "Liquidity is low",
      description: "The configured market-data provider reported low available liquidity.",
      evidence: `${evidence.market.liquidity.threshold}${evidence.market.liquidity.evidence ? `: ${evidence.market.liquidity.evidence}` : ""}`,
      source: "ONCHAIN",
    });
  }

  if (evidence.market?.holderConcentration?.level === "HIGH") {
    findings.push({
      code: "HOLDER_CONCENTRATION_HIGH",
      severity: "MEDIUM",
      title: "Token ownership is concentrated",
      description: "The configured market-data provider reported high holder concentration.",
      evidence: `${evidence.market.holderConcentration.threshold}${evidence.market.holderConcentration.evidence ? `: ${evidence.market.holderConcentration.evidence}` : ""}`,
      source: "ONCHAIN",
    });
  }

  if (evidence.identity?.status === "UNKNOWN") {
    findings.push({
      code: "TOKEN_IDENTITY_UNKNOWN",
      severity: "INFO",
      title: "Token identity is unknown",
      description: "No configured registry could establish a known token identity for this address.",
      evidence: evidence.identity.evidence,
      source: "REPUTATION",
    });
  }

  let sellSimulation: SellSimulation = { attempted: false, success: null, error: null };

  if (provider.simulateSell) {
    try {
      sellSimulation = await provider.simulateSell({ chainId: input.chainId, token: input.token, owner: input.owner, router: input.router, swap: input.swap });
    } catch (error) {
      sellSimulation = { attempted: true, success: null, error: error instanceof Error ? error.message : "Sell simulation failed unexpectedly." };
    }
  }

  if (sellSimulation.attempted && sellSimulation.success === false) {
    findings.push({
      code: "SELL_SIMULATION_FAILED",
      severity: "CRITICAL",
      title: "Sell simulation failed.",
      description: "A read-only attempt to sell the received token reverted.",
      evidence: sellSimulation.error ?? undefined,
      source: "SIMULATION",
    });
  } else if (sellSimulation.success === null) {
    findings.push({
      code: "SELL_SIMULATION_UNAVAILABLE",
      severity: "INFO",
      title: "Sell simulation is unavailable",
      description: "No nested-state sell simulation was available, so sellability remains unknown.",
      evidence: sellSimulation.error ?? undefined,
      source: "SIMULATION",
    });
  }

  const risk = calculateScamRisk(findings);

  return {
    token: input.token,
    riskScore: risk.score,
    riskLevel: risk.level,
    honeypot: sellSimulation.attempted && sellSimulation.success === false,
    findings,
    sellSimulation,
    contract: { verified: evidence.verified, proxy: evidence.proxy, implementation: evidence.implementation },
    agentAnalysis,
    contractPrivileges: { capabilities: evidence.capabilities, accessControl, state },
  };
}

export async function auditSwapTokens(input: { chainId: number; owner: Address; router: Address; swaps: readonly SwapEffect[]; provider?: BlockchainEvidenceProvider; investigator?: ScamInvestigator }): Promise<TokenScamAnalysis[]> {
  const uniqueTokens = new Map<
    string,
    {
      token: Address;
      swap?: SwapEffect;
    }
  >();

  for (const swap of input.swaps) {
    const tokenInKey = swap.tokenIn.toLowerCase();

    if (!uniqueTokens.has(tokenInKey)) {
      uniqueTokens.set(tokenInKey, {
        token: swap.tokenIn,
        swap,
      });
    }

    const tokenOutKey = swap.tokenOut.toLowerCase();

    if (!uniqueTokens.has(tokenOutKey)) {
      uniqueTokens.set(tokenOutKey, {
        token: swap.tokenOut,
        swap,
      });
    }
  }

  return Promise.all(
    [...uniqueTokens.values()].map(({ token, swap }) =>
      auditToken({
        chainId: input.chainId,
        token,
        owner: input.owner,
        router: input.router,
        swap,
        provider: input.provider,
        investigator: input.investigator,
      }),
    ),
  );
}
