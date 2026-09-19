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
  withdraw: {
    code: "WITHDRAW_CAPABILITY",
    category: "WITHDRAW",
  },

  withdrawall: {
    code: "WITHDRAW_CAPABILITY",
    category: "WITHDRAW",
  },

  rescue: {
    code: "WITHDRAW_CAPABILITY",
    category: "WITHDRAW",
  },

  rescuetoken: {
    code: "WITHDRAW_CAPABILITY",
    category: "WITHDRAW",
  },

  rescueerc20: {
    code: "WITHDRAW_CAPABILITY",
    category: "WITHDRAW",
  },

  sweep: {
    code: "WITHDRAW_CAPABILITY",
    category: "WITHDRAW",
  },

  sweepnative: {
    code: "WITHDRAW_CAPABILITY",
    category: "WITHDRAW",
  },

  /*
   * Mint / supply control
   */
  mintto: {
    code: "MINT_CAPABILITY",
    category: "MINT",
  },

  setminter: {
    code: "MINT_CAPABILITY",
    category: "MINT",
  },

  addminter: {
    code: "MINT_CAPABILITY",
    category: "MINT",
  },

  removeminter: {
    code: "MINT_CAPABILITY",
    category: "MINT",
  },

  /*
   * Blacklist variants
   */

  addblacklisted: {
    code: "BLACKLIST_CAPABILITY",
    category: "BLACKLIST",
  },

  removeblacklisted: {
    code: "BLACKLIST_CAPABILITY",
    category: "BLACKLIST",
  },

  setbots: {
    code: "BLACKLIST_CAPABILITY",
    category: "BLACKLIST",
  },

  /*
   * Tax / fee variants
   */
  settaxes: {
    code: "TAX_CAPABILITY",
    category: "TAX",
  },

  setfees: {
    code: "TAX_CAPABILITY",
    category: "TAX",
  },

  setbuytaxes: {
    code: "TAX_CAPABILITY",
    category: "TAX",
  },

  /*
   * Upgrade / admin
   */

  changeadmin: {
    code: "UPGRADE_CAPABILITY",
    category: "UPGRADE",
  },

  transferadmin: {
    code: "UPGRADE_CAPABILITY",
    category: "UPGRADE",
  },

  /*
   * Trading
   */

  settrading: {
    code: "TRADING_CAPABILITY",
    category: "TRADING",
  },

  settaxrate: {
    code: "TAX_CAPABILITY",
    category: "TAX",
  },

  setfeerate: {
    code: "TAX_CAPABILITY",
    category: "TAX",
  },

  updatetax: {
    code: "TAX_CAPABILITY",
    category: "TAX",
  },

  updatefee: {
    code: "TAX_CAPABILITY",
    category: "TAX",
  },

  setfeepercent: {
    code: "TAX_CAPABILITY",
    category: "TAX",
  },

  settaxpercent: {
    code: "TAX_CAPABILITY",
    category: "TAX",
  },

  setblackliststatus: {
    code: "BLACKLIST_CAPABILITY",
    category: "BLACKLIST",
  },

  blockaddress: {
    code: "BLACKLIST_CAPABILITY",
    category: "BLACKLIST",
  },

  unblockaddress: {
    code: "BLACKLIST_CAPABILITY",
    category: "BLACKLIST",
  },

  setmaxtransaction: {
    code: "LIMITS_CAPABILITY",
    category: "LIMITS",
  },

  setmaxwalletbalance: {
    code: "LIMITS_CAPABILITY",
    category: "LIMITS",
  },

  setimplementation: {
    code: "UPGRADE_CAPABILITY",
    category: "UPGRADE",
  },
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

    return [
      {
        code: definition.code,
        category: definition.category,
        functionSignature: signatureOfFunction(fn),
        evidenceSource,
        confidence: "HIGH",
        access: "UNKNOWN",
        functionName: fn.name,
        kind: definition.category === "LIMITS" || definition.category === "OWNERSHIP" || definition.category === "ACCESS_CONTROL" ? undefined : definition.category,
        evidence: `ABI exposes ${signatureOfFunction(fn)}; ABI presence does not establish who may call it.`,
      },
    ];
  });
}
