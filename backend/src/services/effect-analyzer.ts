import type { Address } from "viem";

export interface ApprovalEffect {
  type: "ERC721_OPERATOR";

  token: Address;

  owner: Address;

  operator: Address;

  approved: boolean;

  sourceFunction: string;
}

export interface TransactionEffects {
  approvals: ApprovalEffect[];
}

export function analyzeEffects(input: { to: Address; from: Address; functionName?: string; args?: readonly unknown[] }): TransactionEffects {
  const effects: TransactionEffects = {
    approvals: [],
  };

  if (input.functionName === "setApprovalForAll") {
    const operator = input.args?.[0] as Address;

    const approved = input.args?.[1] as boolean;

    effects.approvals.push({
      type: "ERC721_OPERATOR",

      token: input.to,

      owner: input.from,

      operator,

      approved,

      sourceFunction: "setApprovalForAll",
    });

    return effects;
  }

  if (input.functionName === "maliciousApproval") {
    const operator = input.args?.[0] as Address;

    effects.approvals.push({
      type: "ERC721_OPERATOR",

      token: input.to,

      owner: input.from,

      operator,

      approved: true,

      sourceFunction: "maliciousApproval",
    });

    return effects;
  }

  return effects;
}
