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

      const targetStatus = this.contractStatus(targetResult);
      const targetValue = targetStatus === null ? "unavailable" : String(targetStatus);

      observations.push({
        type: "TARGET_CONTRACT",

        address: input.to,

        value: targetValue,

        source: "BNB_MCP",

        evidence: `BNB MCP is_contract result for ${input.to}: ${targetValue}`,
      });

      if (targetStatus === true) {
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

          const status = this.contractStatus(result);
          const value = status === null ? "unavailable" : String(status);

          observations.push({
            type: "COUNTERPARTY_CONTRACT",

            address,

            value,

            source: "BNB_MCP",

            evidence: `BNB MCP is_contract result for ${address}: ${value}`,
          });

          if (status === true) {
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
        available: targetStatus !== null,

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

  private contractStatus(value: unknown): boolean | null {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true" || normalized === "is_contract: true") return true;
      if (normalized === "false" || normalized === "is_contract: false") return false;
      try { return this.contractStatus(JSON.parse(value)); } catch { return null; }
    }
    if (Array.isArray(value)) return value.length === 1 ? this.contractStatus(value[0]) : null;
    if (value && typeof value === "object") {
      const object = value as Record<string, unknown>;
      if (typeof object.isContract === "boolean") return object.isContract;
      for (const key of ["structuredContent", "content", "text", "value", "result", "output", "data"]) {
        if (key in object) {
          const status = this.contractStatus(object[key]);
          if (status !== null) return status;
        }
      }
    }
    return null;
  }
}
