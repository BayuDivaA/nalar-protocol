import type { Address } from "viem";

import type { ContractEvidence, ScamInvestigator } from "./evidence-provider";

import { BnbChainMcpClient, type BnbMcpClient } from "./bnb-mcp-client";

export class BnbAgentInvestigator implements ScamInvestigator {
  private readonly mcp: BnbMcpClient;

  constructor(mcpClient?: BnbMcpClient) {
    this.mcp = mcpClient ?? new BnbChainMcpClient();
  }

  async investigate(input: { chainId: number; token: Address; evidence: ContractEvidence }): Promise<{
    summary: string | null;
  }> {
    const network = input.chainId === 97 ? "bsc-testnet" : input.chainId === 56 ? "bsc" : `chain-${input.chainId}`;

    const observations: string[] = [];

    try {
      const tokenInfo = await this.mcp.getErc20TokenInfo({
        address: input.token,
        network,
      });

      observations.push(`BNB MCP token information retrieved for ${input.token}.`);

      return {
        summary: this.buildSummary(input, tokenInfo, observations),
      };
    } catch (error) {
      return {
        summary: error instanceof Error ? `BNB investigator could not enrich this token: ${error.message}` : "BNB investigator enrichment failed.",
      };
    }
  }

  private buildSummary(
    input: {
      chainId: number;
      token: Address;
      evidence: ContractEvidence;
    },
    tokenInfo: unknown,
    observations: string[],
  ): string {
    const capabilityCount = input.evidence.capabilities.length;

    const stateCount = input.evidence.state?.length ?? 0;

    const accessCount = input.evidence.accessControl?.length ?? 0;

    return [
      "BNB investigation completed.",
      `Token: ${input.token}`,
      `Chain ID: ${input.chainId}`,
      `Deterministic capabilities observed: ${capabilityCount}`,
      `Access-control evidence entries: ${accessCount}`,
      `On-chain state evidence entries: ${stateCount}`,
      ...observations,
      `MCP token metadata: ${this.summarizeUnknown(tokenInfo)}`,
    ].join(" ");
  }

  private summarizeUnknown(value: unknown): string {
    try {
      const serialized = JSON.stringify(value);

      if (!serialized) {
        return "unavailable";
      }

      return serialized.length > 500 ? `${serialized.slice(0, 500)}...` : serialized;
    } catch {
      return "unavailable";
    }
  }
}
