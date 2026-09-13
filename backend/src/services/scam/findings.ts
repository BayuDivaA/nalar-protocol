import type { Address } from "viem";

import type { AccessControlEvidence, ContractCapability, ContractStateEvidence } from "./evidence-provider";

export type ScamFindingSeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ScamFindingSource = "SIMULATION" | "CONTRACT" | "ONCHAIN" | "ABI" | "PROXY" | "IMPLEMENTATION" | "AGENT" | "REPUTATION";

export type ScamFindingCode =
  | "SELL_SIMULATION_FAILED"
  | "SELL_SIMULATION_UNAVAILABLE"
  | "BLACKLIST_MECHANISM"
  | "TRADING_RESTRICTION"
  | "TRANSFER_RESTRICTED"
  | "EXCESSIVE_SELL_TAX"
  | "OWNER_CAN_CHANGE_TAX"
  | "OWNER_CAN_MINT"
  | "OWNER_CAN_PAUSE"
  | "OWNER_CAN_BLACKLIST"
  | "OWNER_CAN_CHANGE_ROUTER"
  | "OWNER_CAN_CHANGE_PAIR"
  | "OWNER_CAN_WITHDRAW"
  | "UPGRADEABLE_CONTRACT"
  | "PROXY_IMPLEMENTATION_UNKNOWN"
  | "UNVERIFIED_CONTRACT"
  | "CONTRACT_EVIDENCE_UNAVAILABLE"
  | "TOKEN_IDENTITY_UNKNOWN"
  | "LIQUIDITY_LOW"
  | "HOLDER_CONCENTRATION_HIGH"
  | "UNLIMITED_ALLOWANCE"
  | "UNEXPECTED_SPENDER"
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
  | "ACCESS_CONTROL_CAPABILITY"
  | "CAPABILITY_ACCESS_UNKNOWN"
  | "OWNER_CONTROLLED_TAX"
  | "OWNER_CONTROLLED_MINT"
  | "OWNER_CONTROLLED_BLACKLIST"
  | "OWNER_UPGRADE_CONTROL"
  | "PUBLIC_TAX_CONTROL"
  | "PUBLIC_MINT"
  | "PUBLIC_BLACKLIST"
  | "PRIVILEGED_CAPABILITY"
  | "CURRENT_SELL_TAX"
  | "OWNER_CONTROLLED_EXCESSIVE_SELL_TAX"
  | "TRADING_CURRENTLY_DISABLED"
  | "OWNER_CONTROLLED_UPGRADE";

export interface ScamFinding {
  code: ScamFindingCode;
  severity: ScamFindingSeverity;
  title: string;
  description: string;
  evidence?: string;
  source: ScamFindingSource;
}

export interface SellSimulation {
  attempted: boolean;
  success: boolean | null;
  error: string | null;
}

export interface TokenScamAnalysis {
  token: Address;
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  honeypot: boolean;
  findings: ScamFinding[];
  sellSimulation: SellSimulation;
  contract: {
    verified: boolean | null;
    proxy: boolean | null;
    implementation: Address | null;
  };
  agentAnalysis: {
    available: boolean;
    summary: string | null;
  };
  contractPrivileges?: {
    capabilities: ContractCapability[];
    accessControl: AccessControlEvidence[];
    state: ContractStateEvidence[];
  };
}
