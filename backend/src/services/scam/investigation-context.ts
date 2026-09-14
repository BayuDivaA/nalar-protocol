import type { Address } from "viem";

import type { ContractEvidence } from "./evidence-provider";

export function buildInvestigationContext(input: { chainId: number; token: Address; evidence: ContractEvidence }) {
  return {
    chainId: input.chainId,
    token: input.token,

    contract: {
      verified: input.evidence.verified,
      proxy: input.evidence.proxy,
      implementation: input.evidence.implementation,
      owner: input.evidence.owner,
      codeAvailable: input.evidence.codeAvailable,
    },

    capabilities: input.evidence.capabilities.map((capability) => ({
      code: capability.code ?? null,
      category: capability.category ?? null,
      functionSignature: capability.functionSignature ?? null,
      access: capability.access,
      evidence: capability.evidence ?? null,
    })),

    accessControl: input.evidence.accessControl ?? [],

    state: input.evidence.state ?? [],

    market: input.evidence.market ?? null,

    identity: input.evidence.identity ?? null,
  };
}
