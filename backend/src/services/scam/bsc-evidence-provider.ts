import { getAddress, isAddress, type Abi, type AbiFunction, type Address, type Hex } from "viem";

import { publicClient } from "../../lib/viem";
import { resolveContractAbi } from "../contract-resolver";
import type { AccessControlEvidence, BlockchainEvidenceProvider, ContractCapability, ContractEvidence, ContractStateEvidence, EvidenceSource, SellSimulationRequest } from "./evidence-provider";
import type { SellSimulation } from "./findings";
import { detectContractCapabilities } from "./contract-capabilities";

const EIP1967_IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" as Hex;

function addressFromImplementationSlot(value: Hex): Address | null {
  const candidate = `0x${value.slice(-40)}`;

  if (!isAddress(candidate) || /^0x0{40}$/i.test(candidate)) return null;

  return getAddress(candidate);
}

function functionByName(abi: Abi, names: readonly string[]): AbiFunction | null {
  return (abi.find((item) => item.type === "function" && names.includes(item.name)) as AbiFunction | undefined) ?? null;
}

function readValueForState(value: unknown): string | boolean | bigint | null {
  if (typeof value === "string" || typeof value === "boolean" || typeof value === "bigint") return value;
  return null;
}

async function readKnownState(address: Address, abi: Abi): Promise<ContractStateEvidence[]> {
  const reads: Array<{ names: string[]; code: ContractStateEvidence["code"]; label: string; unit?: ContractStateEvidence["unit"] }> = [
    { names: ["sellTaxBps", "sellTaxBasisPoints"], code: "CURRENT_SELL_TAX", label: "sellTaxBps", unit: "BPS" },
    { names: ["sellTax", "currentSellTax"], code: "CURRENT_SELL_TAX", label: "sellTax" },
    { names: ["buyTaxBps", "buyTaxBasisPoints"], code: "CURRENT_BUY_TAX", label: "buyTaxBps", unit: "BPS" },
    { names: ["buyTax", "currentBuyTax"], code: "CURRENT_BUY_TAX", label: "buyTax" },
    { names: ["paused"], code: "PAUSED", label: "paused", unit: "BOOLEAN" },
    { names: ["tradingEnabled"], code: "TRADING_ENABLED", label: "tradingEnabled", unit: "BOOLEAN" },
    { names: ["maxTx", "maxTransactionAmount"], code: "MAX_TX", label: "maxTx", unit: "RAW" },
    { names: ["maxWallet", "maxWalletAmount"], code: "MAX_WALLET", label: "maxWallet", unit: "RAW" },
    { names: ["totalSupply"], code: "TOTAL_SUPPLY", label: "totalSupply", unit: "RAW" },
    { names: ["router"], code: "ROUTER", label: "router", unit: "ADDRESS" },
    { names: ["pair"], code: "PAIR", label: "pair", unit: "ADDRESS" },
  ];

  return Promise.all(reads.flatMap((read) => {
    const fn = functionByName(abi, read.names);
    if (!fn || fn.stateMutability !== "view" && fn.stateMutability !== "pure") return [];

    return [publicClient.readContract({ address, abi: [fn], functionName: fn.name }).then((value) => ({ code: read.code, label: read.label, value: readValueForState(value), unit: read.unit, status: "KNOWN" as const, evidenceSource: "ONCHAIN" as const })).catch(() => ({ code: read.code, label: read.label, value: null, unit: read.unit, status: "UNKNOWN" as const, evidenceSource: "ONCHAIN" as const }))];
  }));
}

async function readOwner(address: Address, abi: Abi): Promise<Address | null> {
  const fn = functionByName(abi, ["owner", "getOwner"]);
  if (!fn || fn.stateMutability !== "view" && fn.stateMutability !== "pure") return null;

  try {
    const value = await publicClient.readContract({ address, abi: [fn], functionName: fn.name });
    return isAddress(value) ? getAddress(value) : null;
  } catch {
    return null;
  }
}

function accessControlEvidence(abi: Abi, owner: Address | null): AccessControlEvidence[] {
  const capabilities = detectContractCapabilities(abi);
  const evidence: AccessControlEvidence[] = [];

  if (capabilities.some((capability) => capability.code === "OWNERSHIP_CAPABILITY")) {
    evidence.push({ mechanism: "OWNABLE", status: owner ? "VERIFIED" : "UNKNOWN", controller: owner ? "OWNER" : "UNKNOWN", address: owner, evidenceSource: owner ? "ONCHAIN" : "ABI", confidence: owner ? "HIGH" : "LOW", evidence: owner ? `Current owner resolved to ${owner}; this does not prove every mutating function is owner-only.` : "Ownership function is present, but the current owner could not be read." });
  }

  if (capabilities.some((capability) => capability.code === "ACCESS_CONTROL_CAPABILITY")) {
    evidence.push({ mechanism: "ACCESS_CONTROL", status: "UNKNOWN", controller: "UNKNOWN", address: null, evidenceSource: "ABI", confidence: "LOW", evidence: "Role-management functions are present, but no role-to-capability mapping was proven." });
  }

  return evidence;
}

async function inspectAbi(address: Address, abi: Abi, source: EvidenceSource): Promise<{ capabilities: ContractCapability[]; accessControl: AccessControlEvidence[]; state: ContractStateEvidence[] }> {
  const capabilities = detectContractCapabilities(abi, source);
  const owner = await readOwner(address, abi);
  const accessControl = accessControlEvidence(abi, owner);
  const state = await readKnownState(address, abi);

  return { capabilities, accessControl, state };
}

/** Read-only BNB-chain adapter. It intentionally does not construct a sell without state overrides. */
export class BscEvidenceProvider implements BlockchainEvidenceProvider {
  async inspectContract(input: { chainId: number; address: Address }): Promise<ContractEvidence> {
    const [resolution, codeResult, implementationResult] = await Promise.allSettled([
      resolveContractAbi({ chainId: input.chainId, address: input.address }),
      publicClient.getCode({ address: input.address }),
      publicClient.getStorageAt({ address: input.address, slot: EIP1967_IMPLEMENTATION_SLOT }),
    ]);

    const resolutionValue = resolution.status === "fulfilled" ? resolution.value : null;
    const code = codeResult.status === "fulfilled" ? codeResult.value : null;
    const implementationValue = implementationResult.status === "fulfilled" ? implementationResult.value : null;
    const implementation = implementationValue ? addressFromImplementationSlot(implementationValue) : null;
    const baseInspection = resolutionValue?.found && resolutionValue.contract ? await inspectAbi(input.address, resolutionValue.contract.abi, "ABI") : { capabilities: [], accessControl: [], state: [] };
    const implementationResolution = implementation ? await resolveContractAbi({ chainId: input.chainId, address: implementation }) : null;
    const implementationInspection = implementationResolution?.found && implementationResolution.contract ? await inspectAbi(input.address, implementationResolution.contract.abi, "IMPLEMENTATION") : { capabilities: [], accessControl: [], state: [] };

    return {
      verified: resolutionValue?.found ? (resolutionValue.contract?.verified ?? null) : resolutionValue?.error?.includes("not found") ? false : null,
      proxy: implementation ? true : null,
      implementation,
      owner: baseInspection.accessControl.find((item) => item.mechanism === "OWNABLE")?.address ?? null,
      codeAvailable: codeResult.status === "fulfilled" ? code !== undefined && code !== "0x" : null,
      capabilities: [...baseInspection.capabilities, ...implementationInspection.capabilities],
      accessControl: [...baseInspection.accessControl, ...implementationInspection.accessControl],
      state: [...baseInspection.state, ...implementationInspection.state],
    };
  }

  async simulateSell(_request: SellSimulationRequest): Promise<SellSimulation> {
    /**
     * A normal eth_call cannot observe the token balance created by the pending
     * buy. Pretending that its balance failure is a honeypot would be unsafe.
     * A future adapter may implement this with a supported nested-state/state-
     * override simulator while preserving the same read-only contract.
     */
    return {
      attempted: false,
      success: null,
      error: "Nested-state sell simulation is unavailable from the configured RPC provider.",
    };
  }
}

export const bscEvidenceProvider = new BscEvidenceProvider();
