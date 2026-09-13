import type { Address } from "viem";

import type { SwapEffect } from "../effect-analyzer";
import type { SellSimulation } from "./findings";

export type ContractCapabilityKind = "MINT" | "PAUSE" | "BLACKLIST" | "TRADING" | "TAX" | "ROUTER" | "PAIR" | "WITHDRAW" | "UPGRADE";

export type CapabilityCategory = ContractCapabilityKind | "LIMITS" | "OWNERSHIP" | "ACCESS_CONTROL";

export type CapabilityCode =
  | "MINT_CAPABILITY"
  | "PAUSE_CAPABILITY"
  | "BLACKLIST_CAPABILITY"
  | "TAX_CAPABILITY"
  | "LIMITS_CAPABILITY"
  | "TRADING_CAPABILITY"
  | "ROUTER_CAPABILITY"
  | "PAIR_CAPABILITY"
  | "UPGRADE_CAPABILITY"
  | "OWNERSHIP_CAPABILITY"
  | "ACCESS_CONTROL_CAPABILITY";

export type EvidenceSource = "ABI" | "PROXY" | "IMPLEMENTATION" | "ONCHAIN" | "BYTECODE";

/** Access is only OWNER when source or bytecode analysis proves it. */
export type CapabilityAccess = "OWNER" | "PRIVILEGED" | "PUBLIC" | "UNKNOWN";

export interface ContractCapability {
  /** New normalized evidence fields are optional for compatibility with the prior capability adapter. */
  code?: CapabilityCode;
  category?: CapabilityCategory;
  functionSignature?: string;
  evidenceSource?: EvidenceSource;
  confidence?: "LOW" | "MEDIUM" | "HIGH";
  kind?: ContractCapabilityKind;
  access: CapabilityAccess;
  functionName?: string;
  evidence?: string;
}

export interface AccessControlEvidence {
  mechanism: "OWNABLE" | "ACCESS_CONTROL" | "ROLE" | "PUBLIC" | "UNKNOWN";
  status: "VERIFIED" | "UNKNOWN";
  controller: "OWNER" | "ROLE" | "PUBLIC" | "UNKNOWN";
  address: Address | null;
  role?: `0x${string}` | null;
  capabilityCodes?: CapabilityCode[];
  evidenceSource: EvidenceSource;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  evidence?: string;
}

export interface ContractStateEvidence {
  code: "CURRENT_SELL_TAX" | "PAUSED" | "TRADING_ENABLED" | "CURRENT_BUY_TAX" | "MAX_TX" | "MAX_WALLET" | "TOTAL_SUPPLY" | "ROUTER" | "PAIR";
  label: string;
  value: string | boolean | bigint | null;
  unit?: "BPS" | "PERCENT" | "RAW" | "ADDRESS" | "BOOLEAN";
  status: "KNOWN" | "UNKNOWN";
  evidenceSource: EvidenceSource;
  evidence?: string;
}

/** Providers own data-source-specific thresholds and must disclose them as evidence. */
export interface MarketEvidence {
  liquidity: { level: "LOW" | "NORMAL"; threshold: string; evidence?: string } | null;
  holderConcentration: { level: "HIGH" | "NORMAL"; threshold: string; evidence?: string } | null;
}

export interface TokenIdentityEvidence {
  status: "KNOWN" | "UNKNOWN";
  evidence?: string;
}

export interface ContractEvidence {
  verified: boolean | null;
  proxy: boolean | null;
  implementation: Address | null;
  owner: Address | null;
  codeAvailable: boolean | null;
  capabilities: ContractCapability[];
  accessControl?: AccessControlEvidence[];
  state?: ContractStateEvidence[];
  market?: MarketEvidence;
  identity?: TokenIdentityEvidence;
}

export interface SellSimulationRequest {
  chainId: number;
  token: Address;
  owner: Address;
  router: Address;
  /** Original buy path, when an adapter can construct a supported reverse route. */
  swap?: SwapEffect;
}

/**
 * This boundary deliberately exposes read-only evidence only. Implementations
 * must never sign, broadcast, or retain private keys.
 */
export interface BlockchainEvidenceProvider {
  inspectContract(input: { chainId: number; address: Address }): Promise<ContractEvidence>;
  simulateSell?(request: SellSimulationRequest): Promise<SellSimulation>;
}

export interface ScamInvestigator {
  investigate(input: { chainId: number; token: Address; evidence: ContractEvidence }): Promise<{ summary: string | null }>;
}
