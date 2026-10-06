import { getAddress, isAddress, formatEther, type Abi, type Address } from "viem";

import { getChainConfig } from "../config/networks";
import { env } from "../config/env";
import { getPublicClient } from "../lib/viem";
import { resolveContractAbi } from "./contract-resolver";
import { bscEvidenceProvider } from "./scam/bsc-evidence-provider";
import { BnbAgentInvestigator } from "./scam/bnb-agent-investigator";
import { BnbChainMcpClient, type BnbMcpClient } from "./scam/bnb-mcp-client";
import type { ContractEvidence, ContractStateEvidence } from "./scam/evidence-provider";

export type AddressFact = {
  id: string;
  label: string;
  value: string;
  source: "RPC" | "ABI" | "SOURCIFY" | "PROTOCOL" | "BNB_MCP";
  checkedAt: string;
  note?: string;
  addressUrl?: string;
};

export type AddressInspection = {
  kind: "address";
  chainId: 56 | 97;
  network: string;
  address: Address;
  explorerUrl: string;
  checkedAt: string;
  facts: AddressFact[];
  functions: ContractFunction[];
  functionCount: number;
  unknowns: string[];
  sources: { rpc: "available"; abi: "available" | "unavailable"; mcp: "available" | "unavailable" | "not_checked" };
};

export type ContractFunction = {
  signature: string;
  inputs: Array<{ name: string; type: string }>;
  outputs: Array<{ name: string; type: string }>;
  mode: "read" | "write" | "payable";
};

export function describeContractFunctions(abi: Abi): ContractFunction[] {
  return abi.filter((item) => item.type === "function").slice(0, 24).map((item) => ({
    signature: `${item.name}(${item.inputs.map((input) => input.type).join(", ")})`,
    inputs: item.inputs.map((input, index) => ({ name: input.name || `input ${index + 1}`, type: input.type })),
    outputs: item.outputs.map((output, index) => ({ name: output.name || `output ${index + 1}`, type: output.type })),
    mode: item.stateMutability === "view" || item.stateMutability === "pure" ? "read" : item.stateMutability === "payable" ? "payable" : "write",
  }));
}

function mcpContractFlag(value: unknown, expected: { address: string; chainId: number }, depth = 0): boolean | null {
  if (depth > 5) return null;
  if (typeof value === "string") {
    if (value.length > 20_000) return null;
    try { return mcpContractFlag(JSON.parse(value), expected, depth + 1); } catch { return null; }
  }
  if (Array.isArray(value)) return value.length === 1 ? mcpContractFlag(value[0], expected, depth + 1) : null;
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.isError === true) return null;
  if (typeof record.isContract === "boolean") {
    const target = record.address ?? record.contractAddress ?? record.targetAddress;
    if (typeof target === "string" && target.toLowerCase() !== expected.address.toLowerCase()) return null;
    if (record.chainId !== undefined && Number(record.chainId) !== expected.chainId) return null;
    if (typeof record.network === "string" && record.network !== (expected.chainId === 56 ? "bsc" : "bsc-testnet")) return null;
    return record.isContract;
  }
  for (const key of ["structuredContent", "result", "data", "content", "text", "value", "output"]) {
    if (key in record) {
      const flag = mcpContractFlag(record[key], expected, depth + 1);
      if (flag !== null) return flag;
    }
  }
  return null;
}

export class AddressInspectionError extends Error {
  constructor(public code: "INVALID_INPUT" | "UNSUPPORTED_NETWORK" | "RPC_UNAVAILABLE", message: string) {
    super(message);
  }
}

const readTimeout = 9_000;

async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Read timed out")), readTimeout);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function displayState(item: ContractStateEvidence): string | null {
  if (item.status !== "KNOWN" || item.value === null) return null;
  return String(item.value);
}

export async function inspectAddress(input: { chainId: number; address: string }, clientFactory = getPublicClient, options: { mcpEnabled?: boolean; mcpClientFactory?: () => BnbMcpClient } = {}): Promise<AddressInspection> {
  const network = getChainConfig(input.chainId);
  if (!network) throw new AddressInspectionError("UNSUPPORTED_NETWORK", "Choose BNB Mainnet or BNB Testnet.");
  if (!isAddress(input.address)) throw new AddressInspectionError("INVALID_INPUT", "Enter a valid 0x address with 40 hexadecimal characters.");

  const address = getAddress(input.address);
  const client = clientFactory(network.chainId);
  const addressUrl = `${network.explorerUrl}/address/${address}`;

  let code: `0x${string}` | undefined;
  try {
    const [actualChainId, currentCode] = await bounded(Promise.all([client.getChainId(), client.getCode({ address })]));
    if (actualChainId !== network.chainId) throw new Error("RPC chain mismatch");
    code = currentCode;
  } catch {
    throw new AddressInspectionError("RPC_UNAVAILABLE", `Could not read ${network.shortName}. Please try again.`);
  }

  const facts: AddressFact[] = [];
  let functions: ContractFunction[] = [];
  let functionCount = 0;
  const unknowns: string[] = [];
  const add = (id: string, label: string, value: string, source: AddressFact["source"], note?: string, linkedAddress?: Address) => {
    facts.push({ id, label, value, source, checkedAt: new Date().toISOString(), ...(note ? { note } : {}), ...(linkedAddress ? { addressUrl: `${network.explorerUrl}/address/${linkedAddress}` } : {}) });
  };

  const hasCode = Boolean(code && code !== "0x");
  add("code", "Code at this address", hasCode ? "Present" : "Not present", "RPC", hasCode ? "Contract code was returned by this network's RPC." : "No code was returned at the time checked. This alone does not prove who controls the address.");

  try {
    const balance = await bounded(client.getBalance({ address }));
    add("balance", "Native balance", `${formatEther(balance)} ${network.nativeSymbol}`, "RPC", "Balance at the time checked; it may change.");
  } catch {
    unknowns.push("Native balance could not be read.");
  }

  let abiStatus: AddressInspection["sources"]["abi"] = "unavailable";
  let mcpStatus: AddressInspection["sources"]["mcp"] = "not_checked";
  const mcp = (options.mcpEnabled ?? env.BNB_INVESTIGATOR_ENABLED) ? (options.mcpClientFactory ?? (() => new BnbChainMcpClient()))() : null;
  if (mcp) {
    try {
      const response = await bounded(mcp.isContract({ address, network: network.chainId === 56 ? "bsc" : "bsc-testnet" }));
      const flag = mcpContractFlag(response, { address, chainId: network.chainId });
      if (flag === hasCode) mcpStatus = "available";
      else {
        mcpStatus = "unavailable";
        unknowns.push("BNB MCP contract-code check did not agree with the RPC observation or could not be read.");
      }
    } catch {
      mcpStatus = "unavailable";
      unknowns.push("BNB MCP contract-code check was not available.");
    }
  }

  if (hasCode) {
    const [evidenceResult, resolutionResult] = await Promise.allSettled([
      bounded(bscEvidenceProvider.inspectContract({ chainId: network.chainId, address })),
      bounded(resolveContractAbi({ chainId: network.chainId, address })),
    ]);

    const evidence: ContractEvidence | null = evidenceResult.status === "fulfilled" ? evidenceResult.value : null;
    const resolution = resolutionResult.status === "fulfilled" ? resolutionResult.value : null;

    if (resolution?.found && resolution.contract) {
      abiStatus = "available";
      functions = describeContractFunctions(resolution.contract.abi);
      functionCount = resolution.contract.abi.filter((item) => item.type === "function").length;
      if (functionCount > functions.length) unknowns.push(`Only ${functions.length} of ${functionCount} ABI-listed functions are shown.`);
      const source = resolution.contract.source === "sourcify" ? "SOURCIFY" : "PROTOCOL";
      add("abi", "Contract interface", resolution.contract.source === "sourcify" ? (resolution.contract.verified ? "Source match found" : "ABI found; source match unconfirmed") : "Known protocol interface", source);
      if (functions.length) add("functions", "Functions listed in ABI", functions.slice(0, 8).map((item) => item.signature).join(", "), source, "The interface lists callable entry points; it does not prove behavior, access, or a complete source review.");
    } else {
      unknowns.push("A contract interface was not available, so some functions and state could not be described.");
    }

    if (evidence) {
      if (evidence.implementation) add("implementation", "Proxy implementation", evidence.implementation, "RPC", "The address stored in the EIP-1967 implementation slot.", evidence.implementation);
      if (evidence.owner) add("owner", "Reported owner", evidence.owner, "RPC", "Read via owner(). This does not prove that the owner controls every function.", evidence.owner);

      const capabilityNames = [...new Set(evidence.capabilities.map((item) => item.functionName).filter((value): value is string => Boolean(value)))].slice(0, 8);
      if (capabilityNames.length && !facts.some((fact) => fact.id === "functions")) add("functions", "Functions listed in ABI", capabilityNames.join(", "), "ABI", "Listed functions do not prove access, behavior, or permission.");

      for (const item of evidence.state ?? []) {
        const value = displayState(item);
        if (value === null) continue;
        const id = `state_${item.code.toLowerCase()}`;
        if (facts.some((fact) => fact.id === id)) continue;
        const isTax = item.code === "CURRENT_SELL_TAX" || item.code === "CURRENT_BUY_TAX";
        const note = isTax ? "A configured value read from the contract. Its unit and effect on transfers are not established here." : "Current value returned by a contract read.";
        add(id, item.label, value, "RPC", note, item.unit === "ADDRESS" && isAddress(value) ? getAddress(value) : undefined);
      }
    } else {
      unknowns.push("Contract state could not be inspected at this time.");
    }

    const tokenAbi = resolution?.contract?.abi;
    const isToken = tokenAbi?.some((item) => item.type === "function" && item.name === "totalSupply") && tokenAbi.some((item) => item.type === "function" && item.name === "balanceOf");
    const hasReadableCapability = evidence?.capabilities.some((item) => ["OWNERSHIP_CAPABILITY", "PAUSE_CAPABILITY", "TRADING_CAPABILITY", "TAX_CAPABILITY", "LIMITS_CAPABILITY"].includes(item.code ?? ""));
    if (mcp && mcpStatus === "available" && isToken && evidence && hasReadableCapability) {
      try {
        const enriched = await bounded(new BnbAgentInvestigator(mcp).investigate({ chainId: network.chainId, token: address, evidence }));
        for (const item of enriched.state ?? []) {
          const value = displayState(item);
          if (value === null) continue;
          const id = `state_${item.code.toLowerCase()}`;
          if (facts.some((fact) => fact.id === id)) continue;
          const isTax = item.code === "CURRENT_SELL_TAX" || item.code === "CURRENT_BUY_TAX";
          add(id, item.label, value, "BNB_MCP", isTax ? "A configured value read through BNB MCP. Its unit and effect on transfers are not established here." : "Value read through BNB MCP.", item.unit === "ADDRESS" && isAddress(value) ? getAddress(value) : undefined);
        }
        if (enriched.state?.length) mcpStatus = "available";
      } catch {
        unknowns.push("BNB MCP contract-state reads were not available.");
      }
    }
  } else {
    unknowns.push("No contract interface or token settings can be read from this address at the time checked.");
  }

  if (mcp) await mcp.close().catch(() => undefined);
  return { kind: "address", chainId: network.chainId, network: network.shortName, address, explorerUrl: addressUrl, checkedAt: new Date().toISOString(), facts, functions, functionCount, unknowns, sources: { rpc: "available", abi: abiStatus, mcp: mcpStatus } };
}
