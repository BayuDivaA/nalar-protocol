import type { Address } from "viem";

export type TransactionAction = "TOKEN_APPROVAL" | "NFT_APPROVAL" | "TOKEN_TRANSFER" | "TOKEN_TRANSFER_FROM" | "NFT_TRANSFER" | "MINT" | "UNKNOWN";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ClassifiedAction {
  action: TransactionAction;

  riskLevel: RiskLevel;

  description: string;

  target?: Address;

  amount?: string;

  spender?: Address;

  operator?: Address;
}

export function classifyAction(functionName: string, args: readonly unknown[]): ClassifiedAction {
  switch (functionName) {
    case "approve": {
      const spender = args[0] as Address;

      const amount = args[1] as bigint;

      const isUnlimited = amount === 2n ** 256n - 1n;

      return {
        action: "TOKEN_APPROVAL",

        riskLevel: isUnlimited ? "CRITICAL" : "HIGH",

        description: isUnlimited ? "Unlimited token approval granted." : "Token spending allowance granted.",

        spender,

        amount: amount.toString(),
      };
    }

    case "setApprovalForAll": {
      const operator = args[0] as Address;

      const approved = args[1] as boolean;

      return {
        action: "NFT_APPROVAL",

        riskLevel: approved ? "CRITICAL" : "LOW",

        description: approved ? "Operator can manage all NFTs from this collection." : "NFT operator approval revoked.",

        operator,
      };
    }

    case "maliciousApproval": {
      const operator = args[0] as Address;

      return {
        action: "NFT_APPROVAL",

        riskLevel: "CRITICAL",

        description: "Transaction requests NFT operator approval.",

        operator,
      };
    }

    case "transfer": {
      const to = args[0] as Address;

      const amount = args[1] as bigint;

      return {
        action: "TOKEN_TRANSFER",

        riskLevel: "MEDIUM",

        description: "Token transfer detected.",

        target: to,

        amount: amount.toString(),
      };
    }

    case "transferFrom": {
      const to = args[1] as Address;

      const amount = args[2] as bigint;

      return {
        action: "TOKEN_TRANSFER_FROM",

        riskLevel: "HIGH",

        description: "Third-party token transfer detected.",

        target: to,

        amount: amount.toString(),
      };
    }

    case "safeTransferFrom": {
      return {
        action: "NFT_TRANSFER",

        riskLevel: "HIGH",

        description: "NFT transfer detected.",
      };
    }

    case "mint": {
      return {
        action: "MINT",

        riskLevel: "LOW",

        description: "NFT or token mint detected.",
      };
    }

    default: {
      return {
        action: "UNKNOWN",

        riskLevel: "MEDIUM",

        description: "Unknown contract function.",
      };
    }
  }
}
