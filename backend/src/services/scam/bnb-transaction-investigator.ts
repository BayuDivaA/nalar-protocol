import type { Address } from "viem";

import type { TransactionEffects } from "../effect-analyzer";

import type { BnbMcpClient } from "./bnb-mcp-client";

export interface TransactionInvestigationObservation {
  type: "TARGET_CONTRACT" | "COUNTERPARTY_CONTRACT" | "LATEST_BLOCK";

  address?: Address;

  value: string;

  source: "BNB_MCP";

  evidence: string;
}

export interface TransactionInvestigation {
  available: boolean;

  observations: TransactionInvestigationObservation[];

  contractAddresses: string[];

  summary: string | null;
}

export class BnbTransactionInvestigator {
  constructor(private readonly mcp: BnbMcpClient) {}

  async investigate(input: {
    chainId: number;

    to: Address;

    effects: TransactionEffects;
  }): Promise<TransactionInvestigation> {
    const network = input.chainId === 97 ? "bsc-testnet" : input.chainId === 56 ? "bsc" : `chain-${input.chainId}`;

    const observations: TransactionInvestigationObservation[] = [];

    const contractAddresses = new Set<string>();

    try {
      /*
       * -------------------------------------------------------
       * Target contract
       * -------------------------------------------------------
       */

      const targetResult = await this.mcp.isContract({
        address: input.to,

        network,
      });

      const targetValue = this.extractValue(targetResult);

      observations.push({
        type: "TARGET_CONTRACT",

        address: input.to,

        value: targetValue,

        source: "BNB_MCP",

        evidence: `BNB MCP is_contract result for ${input.to}: ${targetValue}`,
      });

      if (this.looksLikeContract(targetValue)) {
        contractAddresses.add(input.to.toLowerCase());
      }

      /*
       * -------------------------------------------------------
       * Approval counterparties
       * -------------------------------------------------------
       */

      for (const approval of input.effects.approvals) {
        const address = approval.type === "ERC20_ALLOWANCE" ? approval.spender : approval.operator;

        if (contractAddresses.has(address.toLowerCase())) {
          continue;
        }

        try {
          const result = await this.mcp.isContract({
            address,

            network,
          });

          const value = this.extractValue(result);

          observations.push({
            type: "COUNTERPARTY_CONTRACT",

            address,

            value,

            source: "BNB_MCP",

            evidence: `BNB MCP is_contract result for ${address}: ${value}`,
          });

          if (this.looksLikeContract(value)) {
            contractAddresses.add(address.toLowerCase());
          }
        } catch {
          /*
           * Counterparty inspection is enrichment.
           * Do not fail the entire transaction analysis.
           */
        }
      }

      /*
       * -------------------------------------------------------
       * Latest block context
       * -------------------------------------------------------
       */

      try {
        const latestBlock = await this.mcp.getLatestBlock({
          network,
        });

        observations.push({
          type: "LATEST_BLOCK",

          value: this.extractValue(latestBlock),

          source: "BNB_MCP",

          evidence: "Latest BNB block context retrieved through MCP.",
        });
      } catch {
        // Optional evidence.
      }

      return {
        available: observations.length > 0,

        observations,

        contractAddresses: [...contractAddresses],

        summary: `BNB MCP investigation completed with ${observations.length} observations.`,
      };
    } catch (error) {
      return {
        available: false,

        observations,

        contractAddresses: [...contractAddresses],

        summary: error instanceof Error ? error.message : "BNB MCP transaction investigation failed.",
      };
    }
  }

  private extractValue(value: unknown): string {
    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "boolean") {
      return String(value);
    }

    if (typeof value === "number") {
      return String(value);
    }

    if (typeof value === "bigint") {
      return value.toString();
    }

    if (Array.isArray(value)) {
      return value.length === 1 ? this.extractValue(value[0]) : JSON.stringify(value);
    }

    if (value && typeof value === "object") {
      const object = value as Record<string, unknown>;

      for (const key of ["value", "result", "output", "data"]) {
        if (key in object) {
          return this.extractValue(object[key]);
        }
      }

      if (Array.isArray(object.content)) {
        return this.extractValue(object.content);
      }

      try {
        return JSON.stringify(value);
      } catch {
        return "unavailable";
      }
    }

    return "unavailable";
  }

  private looksLikeContract(value: string): boolean {
    const normalized = value.toLowerCase();

    return normalized === "true" || normalized === "is_contract: true" || normalized.includes('"iscontract":true');
  }
}
