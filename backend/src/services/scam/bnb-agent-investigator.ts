import type { Address } from "viem";

import type { ContractEvidence, ContractCapability, ContractStateEvidence, ScamInvestigator } from "./evidence-provider";

import { BnbChainMcpClient, type BnbMcpClient } from "./bnb-mcp-client";

function viewFunctionAbi(name: string, outputType: string): unknown[] {
  return [
    {
      type: "function",
      name,
      inputs: [],
      outputs: [
        {
          name: "",
          type: outputType,
        },
      ],
      stateMutability: "view",
    },
  ];
}

function buildViewAbi(functionName: string, outputType: string): unknown[] {
  return [
    {
      type: "function",
      name: functionName,
      inputs: [],
      outputs: [
        {
          name: "",
          type: outputType,
        },
      ],
      stateMutability: "view",
    },
  ];
}

type ContractProbe = {
  functionName: string;
  abi: unknown[];
};

type ContractReadObservation = {
  functionName: string;
  result: unknown;
};

export class BnbAgentInvestigator implements ScamInvestigator {
  private readonly mcp: BnbMcpClient;

  constructor(mcpClient?: BnbMcpClient) {
    this.mcp = mcpClient ?? new BnbChainMcpClient();
  }

  async investigate(input: { chainId: number; token: Address; evidence: ContractEvidence }): Promise<{
    summary: string | null;
    state?: ContractStateEvidence[];
    owner?: Address | null;
  }> {
    const network = input.chainId === 97 ? "bsc-testnet" : input.chainId === 56 ? "bsc" : `chain-${input.chainId}`;

    const observations: string[] = [];

    try {
      const tokenInfo = await this.mcp.getErc20TokenInfo({
        address: input.token,
        network,
      });

      observations.push(`BNB MCP token information retrieved for ${input.token}.`);

      const probes = this.buildProbeList(input.evidence.capabilities);

      const contractReads = await Promise.all(
        probes.map((probe) =>
          this.readOptionalContractState({
            address: input.token,
            network,
            functionName: probe.functionName,
            abi: probe.abi,
          }),
        ),
      );

      const successfulReads = contractReads.filter((item): item is ContractReadObservation => item !== null);

      const state = successfulReads.map((observation) => this.toStateEvidence(observation)).filter((item): item is ContractStateEvidence => item !== null);

      let owner: Address | null = null;

      for (const observation of successfulReads) {
        if (observation.functionName !== "owner") {
          continue;
        }

        const extracted = this.extractPrimitiveValue(observation.result);

        if (typeof extracted === "string" && /^0x[a-fA-F0-9]{40}$/.test(extracted)) {
          owner = extracted as Address;
        }
      }

      for (const observation of successfulReads) {
        observations.push(`MCP contract state ${observation.functionName}(): ${this.summarizeUnknown(observation.result)}`);
      }

      return {
        summary: this.buildSummary(
          input,
          tokenInfo,
          observations,
          probes.map((probe) => probe.functionName),
        ),
        state,
        owner,
      };
    } catch (error) {
      return {
        summary: error instanceof Error ? `BNB investigator could not enrich this token: ${error.message}` : "BNB investigator enrichment failed.",
      };
    }
  }

  private buildProbeList(capabilities: ContractCapability[]): ContractProbe[] {
    const codes = new Set(capabilities.map((capability) => capability.code).filter(Boolean));

    const probes = new Map<string, ContractProbe>();

    const addProbe = (functionName: string, outputType: string) => {
      if (probes.has(functionName)) {
        return;
      }

      probes.set(functionName, {
        functionName,
        abi: buildViewAbi(functionName, outputType),
      });
    };

    if (codes.has("OWNERSHIP_CAPABILITY")) {
      addProbe("owner", "address");
    }

    if (codes.has("PAUSE_CAPABILITY")) {
      addProbe("paused", "bool");
    }

    if (codes.has("TRADING_CAPABILITY")) {
      addProbe("tradingEnabled", "bool");
    }

    if (codes.has("TAX_CAPABILITY")) {
      addProbe("buyTax", "uint256");
      addProbe("sellTax", "uint256");
    }

    if (codes.has("LIMITS_CAPABILITY")) {
      addProbe("maxTx", "uint256");
      addProbe("maxWallet", "uint256");
    }

    // Fallback for contracts with no usable ABI/capability evidence.
    if (probes.size === 0) {
      addProbe("owner", "address");
      addProbe("sellTax", "uint256");
      addProbe("buyTax", "uint256");
      addProbe("paused", "bool");
      addProbe("tradingEnabled", "bool");
      addProbe("maxTx", "uint256");
      addProbe("maxWallet", "uint256");
    }

    return [...probes.values()];
  }

  private async readOptionalContractState(input: { address: Address; network: string; functionName: string; abi: unknown[] }): Promise<ContractReadObservation | null> {
    try {
      const result = await this.mcp.readContract({
        contractAddress: input.address,
        abi: input.abi,
        functionName: input.functionName,
        args: [],
        network: input.network,
      });

      return {
        functionName: input.functionName,
        result,
      };
    } catch (error) {
      console.debug(`[BNB MCP] ${input.functionName}() unavailable:`, error instanceof Error ? error.message : String(error));

      return null;
    }
  }

  private toStateEvidence(observation: ContractReadObservation): ContractStateEvidence | null {
    const primitive = this.extractPrimitiveValue(observation.result);

    switch (observation.functionName) {
      case "sellTax":
        return this.makeStateEvidence("CURRENT_SELL_TAX", "sellTax", primitive, "PERCENT");

      case "buyTax":
        return this.makeStateEvidence("CURRENT_BUY_TAX", "buyTax", primitive, "PERCENT");

      case "paused":
        if (typeof primitive !== "boolean") {
          return null;
        }

        return {
          code: "PAUSED",
          label: "paused",
          value: primitive,
          unit: "BOOLEAN",
          status: "KNOWN",
          evidenceSource: "ONCHAIN",
          evidence: "Read from BNB MCP read_contract().",
        };

      case "tradingEnabled":
        if (typeof primitive !== "boolean") {
          return null;
        }

        return {
          code: "TRADING_ENABLED",
          label: "tradingEnabled",
          value: primitive,
          unit: "BOOLEAN",
          status: "KNOWN",
          evidenceSource: "ONCHAIN",
          evidence: "Read from BNB MCP read_contract().",
        };

      case "maxTx":
        return this.makeStateEvidence("MAX_TX", "maxTx", primitive, "RAW");

      case "maxWallet":
        return this.makeStateEvidence("MAX_WALLET", "maxWallet", primitive, "RAW");

      default:
        return null;
    }
  }

  private makeStateEvidence(code: ContractStateEvidence["code"], label: string, value: unknown, unit: ContractStateEvidence["unit"]): ContractStateEvidence | null {
    const normalized = this.normalizeStateValue(value);

    if (normalized === null) {
      return null;
    }

    return {
      code,
      label,
      value: normalized,
      unit,
      status: "KNOWN",
      evidenceSource: "ONCHAIN",
      evidence: "Read from BNB MCP read_contract().",
    };
  }

  private normalizeStateValue(value: unknown): string | boolean | bigint | null {
    if (typeof value === "string" || typeof value === "boolean" || typeof value === "bigint") {
      return value;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }

    return null;
  }

  private extractPrimitiveValue(value: unknown): unknown {
    if (typeof value === "string" || typeof value === "boolean" || typeof value === "number" || typeof value === "bigint") {
      return value;
    }

    if (Array.isArray(value)) {
      if (value.length === 1) {
        return this.extractPrimitiveValue(value[0]);
      }

      return null;
    }

    if (!value || typeof value !== "object") {
      return null;
    }

    const object = value as Record<string, unknown>;

    const priorityKeys = ["value", "result", "output", "data", "structuredContent"];

    for (const key of priorityKeys) {
      if (key in object) {
        const extracted = this.extractPrimitiveValue(object[key]);

        if (extracted !== null) {
          return extracted;
        }
      }
    }

    if ("content" in object && Array.isArray(object.content)) {
      for (const item of object.content) {
        if (item && typeof item === "object" && "text" in item && typeof item.text === "string") {
          const text = item.text;

          try {
            const parsed = JSON.parse(text);
            const extracted = this.extractPrimitiveValue(parsed);

            if (extracted !== null) {
              return extracted;
            }
          } catch {
            if (text === "true") return true;
            if (text === "false") return false;

            if (/^\d+$/.test(text)) {
              return text;
            }

            if (/^0x[a-fA-F0-9]{40}$/.test(text)) {
              return text;
            }
          }
        }
      }
    }

    return null;
  }

  private buildSummary(
    input: {
      chainId: number;
      token: Address;
      evidence: ContractEvidence;
    },
    tokenInfo: unknown,
    observations: string[],
    probes: string[],
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
      `MCP contract probes attempted: ${probes.length}`,
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
