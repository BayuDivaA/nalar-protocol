import type { Address } from "viem";

export interface ERC20AllowanceEffect {
  type: "ERC20_ALLOWANCE";

  token: Address;

  owner: Address;

  spender: Address;

  amount: bigint;

  unlimited: boolean;

  sourceFunction: "approve";
}

export interface ERC721ApprovalEffect {
  type: "ERC721_OPERATOR";

  token: Address;

  owner: Address;

  operator: Address;

  approved: boolean;

  sourceFunction: "setApprovalForAll" | "maliciousApproval";
}

export type ApprovalEffect = ERC20AllowanceEffect | ERC721ApprovalEffect;

export interface TransactionEffects {
  approvals: ApprovalEffect[];
}

const MAX_UINT256 = 2n ** 256n - 1n;

export function analyzeEffects(input: {
  to: Address;

  from: Address;

  functionName?: string;

  args?: readonly unknown[];
}): TransactionEffects {
  const effects: TransactionEffects = {
    approvals: [],
  };

  /**
   * --------------------------------------------------
   * ERC20 approve(address,uint256)
   * --------------------------------------------------
   */
  if (input.functionName === "approve") {
    const spender = input.args?.[0] as Address | undefined;

    const amount = input.args?.[1] as bigint | undefined;

    if (spender && amount !== undefined) {
      effects.approvals.push({
        type: "ERC20_ALLOWANCE",

        token: input.to,

        owner: input.from,

        spender,

        amount,

        unlimited: amount === MAX_UINT256,

        sourceFunction: "approve",
      });
    }
  }

  /**
   * --------------------------------------------------
   * ERC721 setApprovalForAll(address,bool)
   * --------------------------------------------------
   */
  if (input.functionName === "setApprovalForAll") {
    const operator = input.args?.[0] as Address | undefined;

    const approved = input.args?.[1] as boolean | undefined;

    if (operator && approved !== undefined) {
      effects.approvals.push({
        type: "ERC721_OPERATOR",

        token: input.to,

        owner: input.from,

        operator,

        approved,

        sourceFunction: "setApprovalForAll",
      });
    }
  }

  /**
   * --------------------------------------------------
   * Demo malicious approval
   * --------------------------------------------------
   */
  if (input.functionName === "maliciousApproval") {
    const operator = input.args?.[0] as Address | undefined;

    if (operator) {
      effects.approvals.push({
        type: "ERC721_OPERATOR",

        token: input.to,

        owner: input.from,

        operator,

        approved: true,

        sourceFunction: "maliciousApproval",
      });
    }
  }

  return effects;
}
