import { formatUnits, getAddress, type Address } from "viem";

import type { TransactionAction } from "../lib/classifier";
import type { TransactionEffects } from "./effect-analyzer";

export interface TransactionSummary {
  title: string;
  action: string;
  valueNative: string | null;
  target: Address;
  description: string;
  details: string[];
}

interface TranslateInput {
  from: Address;
  to: Address;
  value: bigint;

  action: TransactionAction;

  functionName?: string | null;

  args?: readonly unknown[];

  effects: TransactionEffects;

  intentDescription?: string | null;
}

function isAddress(value: unknown): value is Address {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function shortenAddress(address: Address): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getAddressArg(value: unknown): Address | null {
  if (!isAddress(value)) {
    return null;
  }

  return getAddress(value);
}

export function translateTransaction(input: TranslateInput): TransactionSummary {
  const { to, value, action, functionName, args, effects } = input;

  const valueNative = value > 0n ? formatUnits(value, 18) : null;

  /**
   * ================================================
   * NFT MINT
   * ================================================
   */
  if (action === "MINT") {
    return {
      title: "Mint NFT",

      action: "MINT",

      valueNative,

      target: to,

      description: valueNative ? `Mint an NFT by sending ${valueNative} BNB to the contract.` : "Mint an NFT through this contract.",

      details: ["The transaction calls the contract's mint function.", ...(valueNative ? [`Amount sent: ${valueNative} BNB.`] : [])],
    };
  }

  /**
   * ================================================
   * ERC20 TRANSFER
   * ================================================
   */
  if (action === "TOKEN_TRANSFER") {
    const recipient = getAddressArg(args?.[0]);

    const amount = typeof args?.[1] === "bigint" ? args[1] : null;

    return {
      title: "Send tokens",

      action: "TOKEN_TRANSFER",

      valueNative,

      target: to,

      description: recipient ? `Send tokens to ${shortenAddress(recipient)}.` : "Send tokens to another address.",

      details: [...(recipient ? [`Recipient: ${recipient}`] : []), ...(amount !== null ? [`Token amount: ${amount.toString()} base units.`] : []), "The transaction moves tokens from your wallet to another address."],
    };
  }

  /**
   * ================================================
   * NFT TRANSFER
   * ================================================
   */
  if (action === "NFT_TRANSFER") {
    return {
      title: "Transfer NFT",

      action: "NFT_TRANSFER",

      valueNative,

      target: to,

      description: "The transaction transfers an NFT to another address.",

      details: ["The transaction attempts to move an NFT.", "The exact NFT recipient should be checked before signing."],
    };
  }

  /**
   * ================================================
   * NFT APPROVAL
   * ================================================
   */
  if (action === "NFT_APPROVAL") {
    const approval = effects.approvals.find((effect) => effect.type === "ERC721_OPERATOR");

    if (approval) {
      return {
        title: "Give NFT management permission",

        action: "NFT_APPROVAL",

        valueNative,

        target: to,

        description: `Give ${shortenAddress(approval.operator)} permission to manage your NFTs.`,

        details: [`Operator: ${approval.operator}`, approval.approved ? "This permission is being enabled." : "This permission is being removed.", "An approval gives another address permission over NFTs from this collection."],
      };
    }

    return {
      title: "NFT approval",

      action: "NFT_APPROVAL",

      valueNative,

      target: to,

      description: "The transaction changes permission to manage NFTs.",

      details: ["Another address may receive permission to manage NFTs."],
    };
  }

  /**
   * ================================================
   * ERC20 APPROVAL
   * ================================================
   */
  if (action === "TOKEN_APPROVAL") {
    const approval = effects.approvals.find((effect) => effect.type === "ERC20_ALLOWANCE");

    if (approval) {
      const amount = approval.unlimited ? "unlimited" : approval.amount.toString();

      return {
        title: "Give token spending permission",

        action: "TOKEN_APPROVAL",

        valueNative,

        target: to,

        description: `Give ${shortenAddress(approval.spender)} permission to spend your tokens.`,

        details: [`Spender: ${approval.spender}`, `Allowance: ${amount}`, approval.unlimited ? "The permission is not limited to a specific token amount." : "The permission is limited to a specific token amount."],
      };
    }

    return {
      title: "Token approval",

      action: "TOKEN_APPROVAL",

      valueNative,

      target: to,

      description: "The transaction gives another address permission to spend your tokens.",

      details: [],
    };
  }

  /**
   * ================================================
   * SWAP
   * ================================================
   */
  if (action === "SWAP" || effects.swaps.length > 0) {
    const swap = effects.swaps[0];

    if (swap) {
      const tokenIn = swap.tokenInSymbol ?? shortenAddress(swap.tokenIn);

      const tokenOut = swap.tokenOutSymbol ?? shortenAddress(swap.tokenOut);

      return {
        title: "Swap tokens",

        action: "SWAP",

        valueNative,

        target: to,

        description: `Swap ${tokenIn} for ${tokenOut}.`,

        details: [`Input: ${tokenIn}`, `Output: ${tokenOut}`, `Protocol: ${swap.protocol}`, `Recipient: ${shortenAddress(swap.recipient)}`],
      };
    }
  }

  /**
   * ================================================
   * FALLBACK
   * ================================================
   */
  return {
    title: "Contract transaction",

    action: functionName ?? action,

    valueNative,

    target: to,

    description: `Interact with a smart contract using ${functionName ?? "an unknown function"}.`,

    details: [`Action type: ${action}`],
  };
}
