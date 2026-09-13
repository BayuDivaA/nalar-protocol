import type { Abi, AbiFunction } from "viem";

import type { CapabilityCategory, CapabilityCode, ContractCapability, EvidenceSource } from "./evidence-provider";

type CapabilityDefinition = {
  code: CapabilityCode;
  category: CapabilityCategory;
};

const EXACT_CAPABILITIES: Record<string, CapabilityDefinition> = {
  mint: { code: "MINT_CAPABILITY", category: "MINT" },
  pause: { code: "PAUSE_CAPABILITY", category: "PAUSE" },
  unpause: { code: "PAUSE_CAPABILITY", category: "PAUSE" },
  blacklist: { code: "BLACKLIST_CAPABILITY", category: "BLACKLIST" },
  addblacklist: { code: "BLACKLIST_CAPABILITY", category: "BLACKLIST" },
  removeblacklist: { code: "BLACKLIST_CAPABILITY", category: "BLACKLIST" },
  setblacklist: { code: "BLACKLIST_CAPABILITY", category: "BLACKLIST" },
  setblacklisted: { code: "BLACKLIST_CAPABILITY", category: "BLACKLIST" },
  settax: { code: "TAX_CAPABILITY", category: "TAX" },
  setfee: { code: "TAX_CAPABILITY", category: "TAX" },
  setbuytax: { code: "TAX_CAPABILITY", category: "TAX" },
  setselltax: { code: "TAX_CAPABILITY", category: "TAX" },
  setbuyfee: { code: "TAX_CAPABILITY", category: "TAX" },
  setsellfee: { code: "TAX_CAPABILITY", category: "TAX" },
  setmaxtx: { code: "LIMITS_CAPABILITY", category: "LIMITS" },
  setmaxwallet: { code: "LIMITS_CAPABILITY", category: "LIMITS" },
  setmaxtransactionamount: { code: "LIMITS_CAPABILITY", category: "LIMITS" },
  setmaxwalletamount: { code: "LIMITS_CAPABILITY", category: "LIMITS" },
  settradingenabled: { code: "TRADING_CAPABILITY", category: "TRADING" },
  enabletrading: { code: "TRADING_CAPABILITY", category: "TRADING" },
  disabletrading: { code: "TRADING_CAPABILITY", category: "TRADING" },
  setrouter: { code: "ROUTER_CAPABILITY", category: "ROUTER" },
  setpair: { code: "PAIR_CAPABILITY", category: "PAIR" },
  upgradeto: { code: "UPGRADE_CAPABILITY", category: "UPGRADE" },
  upgradetoandcall: { code: "UPGRADE_CAPABILITY", category: "UPGRADE" },
  transferownership: { code: "OWNERSHIP_CAPABILITY", category: "OWNERSHIP" },
  renounceownership: { code: "OWNERSHIP_CAPABILITY", category: "OWNERSHIP" },
  owner: { code: "OWNERSHIP_CAPABILITY", category: "OWNERSHIP" },
  getowner: { code: "OWNERSHIP_CAPABILITY", category: "OWNERSHIP" },
  hasrole: { code: "ACCESS_CONTROL_CAPABILITY", category: "ACCESS_CONTROL" },
  grantrole: { code: "ACCESS_CONTROL_CAPABILITY", category: "ACCESS_CONTROL" },
  revokerole: { code: "ACCESS_CONTROL_CAPABILITY", category: "ACCESS_CONTROL" },
  renouncerole: { code: "ACCESS_CONTROL_CAPABILITY", category: "ACCESS_CONTROL" },
  default_admin_role: { code: "ACCESS_CONTROL_CAPABILITY", category: "ACCESS_CONTROL" },
};

function signatureOfFunction(fn: AbiFunction): string {
  return `${fn.name}(${fn.inputs.map((input) => input.type).join(",")})`;
}

export function detectContractCapabilities(abi: Abi, evidenceSource: EvidenceSource = "ABI"): ContractCapability[] {
  return abi.flatMap((item) => {
    if (item.type !== "function") return [];

    const fn = item as AbiFunction;
    const definition = EXACT_CAPABILITIES[fn.name.toLowerCase()];

    if (!definition) return [];

    return [{
      code: definition.code,
      category: definition.category,
      functionSignature: signatureOfFunction(fn),
      evidenceSource,
      confidence: "HIGH",
      access: "UNKNOWN",
      functionName: fn.name,
      kind: definition.category === "LIMITS" || definition.category === "OWNERSHIP" || definition.category === "ACCESS_CONTROL" ? undefined : definition.category,
      evidence: `ABI exposes ${signatureOfFunction(fn)}; ABI presence does not establish who may call it.`,
    }];
  });
}
