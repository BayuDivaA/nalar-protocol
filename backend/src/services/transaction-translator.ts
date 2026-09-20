import { formatUnits, getAddress, type Address } from "viem";

import type { TransactionAction } from "../lib/classifier";
import type { TransactionEffects } from "./effect-analyzer";
import { formatTokenAmount } from "./token-amount";

export interface AssetTransferSummary {
  amount?: string | null;
  symbol?: string | null;
  address?: Address | null;
}

export interface TransactionSummary {
  title: string;
  action: string;
  valueNative: string | null;
  target: Address;
  description: string;
  details: string[];
  protocol?: string | null;
  recipient?: Address | null;
  input?: AssetTransferSummary | null;
  output?: AssetTransferSummary | null;
  summary?: string;
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

  targetIsContract?: boolean | null;
}

const WBNB_TESTNET = "0xae13d989dac2f0debff460ac112a837c89baa7cd".toLowerCase();
const ROUTER_ETH_FLAG = "0x0000000000000000000000000000000000000002".toLowerCase();

export function formatDisplaySymbol(symbol?: string | null, address?: string | null): string {
  if (!symbol && !address) {
    return "tokens";
  }

  const symUpper = symbol?.trim().toUpperCase();
  const addrLower = address?.toLowerCase();

  if (symUpper === "WBNB" || symUpper === "BNB" || symUpper === "TBNB" || addrLower === WBNB_TESTNET || addrLower === ROUTER_ETH_FLAG || addrLower === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee") {
    return "tBNB";
  }

  if (symbol && symbol.trim()) {
    return symbol.trim();
  }

  if (address && isAddress(address)) {
    return shortenAddress(getAddress(address));
  }

  return "tokens";
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
    if (input.targetIsContract === false) {
      const title = valueNative ? `Send ${valueNative} tBNB` : "Personal transfer";
      const desc = valueNative
        ? `Send ${valueNative} tBNB to an address (the destination is not a smart contract).`
        : "Call an address that is not a smart contract.";
      return {
        title,
        action: "PAYMENT",
        valueNative,
        target: to,
        description: desc,
        summary: desc,
        input: valueNative ? { amount: valueNative, symbol: "tBNB" } : null,
        details: [
          "The destination address is an externally owned account (EOA), not a smart contract.",
          "No smart contract minting logic was detected at this address.",
          ...(valueNative ? [`Amount sent: ${valueNative} tBNB.`] : []),
        ],
      };
    }

    const mintEffect = effects.mints?.[0];
    const qty = mintEffect?.quantity ?? 1;
    const qtyLabel = qty > 1 ? `${qty} NFTs` : "1 NFT";

    const title = `Mint ${qtyLabel}`;
    const desc = valueNative
      ? `Mint an NFT by sending ${valueNative} tBNB to the contract.`
      : "Mint an NFT through this contract.";
    return {
      title,
      action: "MINT",
      valueNative,
      target: to,
      description: desc,
      summary: desc,
      input: valueNative ? { amount: valueNative, symbol: "tBNB" } : null,
      details: [
        "The transaction calls the contract's mint function.",
        ...(valueNative ? [`Amount sent: ${valueNative} tBNB.`] : []),
        ...(qty ? [`Mint quantity: ${qty}.`] : []),
      ],
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
      recipient,
      description: recipient ? `Send tokens to ${shortenAddress(recipient)}.` : "Send tokens to another address.",
      summary: recipient ? `Send tokens to ${shortenAddress(recipient)}.` : "Send tokens to another address.",
      input: amount !== null ? { amount: amount.toString(), address: to } : null,
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
      summary: "Transfer an NFT to another address.",
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
      const desc = `Give ${shortenAddress(approval.operator)} permission to manage your NFTs.`;
      return {
        title: "Give NFT management permission",
        action: "NFT_APPROVAL",
        valueNative,
        target: to,
        recipient: approval.operator,
        description: desc,
        summary: desc,
        details: [`Operator: ${approval.operator}`, approval.approved ? "This permission is being enabled." : "This permission is being removed.", "An approval gives another address permission over NFTs from this collection."],
      };
    }

    return {
      title: "NFT approval",
      action: "NFT_APPROVAL",
      valueNative,
      target: to,
      description: "The transaction changes permission to manage NFTs.",
      summary: "The transaction changes permission to manage NFTs.",
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
      const desc = `Give ${shortenAddress(approval.spender)} permission to spend your tokens.`;

      return {
        title: "Give token spending permission",
        action: "TOKEN_APPROVAL",
        valueNative,
        target: to,
        recipient: approval.spender,
        description: desc,
        summary: desc,
        details: [`Spender: ${approval.spender}`, `Allowance: ${amount}`, approval.unlimited ? "The permission is not limited to a specific token amount." : "The permission is limited to a specific token amount."],
      };
    }

    return {
      title: "Token approval",
      action: "TOKEN_APPROVAL",
      valueNative,
      target: to,
      description: "The transaction gives another address permission to spend your tokens.",
      summary: "The transaction gives another address permission to spend your tokens.",
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
      const tokenInDisplay = formatDisplaySymbol(swap.tokenInSymbol, swap.tokenIn);
      const tokenOutDisplay = formatDisplaySymbol(swap.tokenOutSymbol, swap.tokenOut);
      const protocol = swap.protocol ?? "PancakeSwap";

      let amountInFormatted: string | null = null;
      if (swap.tokenInDecimals !== null && swap.tokenInDecimals !== undefined && swap.amountIn > 0n) {
        amountInFormatted = formatTokenAmount(swap.amountIn, swap.tokenInDecimals);
      } else if (value > 0n) {
        amountInFormatted = formatUnits(value, 18);
      }

      let amountOutMinFormatted: string | null = null;
      if (swap.tokenOutDecimals !== null && swap.tokenOutDecimals !== undefined && swap.amountOutMin > 0n) {
        amountOutMinFormatted = formatTokenAmount(swap.amountOutMin, swap.tokenOutDecimals);
      }

      const title = amountInFormatted ? `Swap ${amountInFormatted} ${tokenInDisplay} for ${tokenOutDisplay}` : `Swap ${tokenInDisplay} for ${tokenOutDisplay}`;

      const summary = amountInFormatted ? `Swap ${amountInFormatted} ${tokenInDisplay} for ${tokenOutDisplay} through ${protocol}.` : `Swap ${tokenInDisplay} for ${tokenOutDisplay} through ${protocol}.`;

      return {
        title,
        action: "SWAP",
        valueNative,
        target: to,
        protocol,
        recipient: swap.recipient,
        input: {
          amount: amountInFormatted,
          symbol: tokenInDisplay,
          address: swap.tokenIn,
        },
        output: {
          amount: amountOutMinFormatted,
          symbol: tokenOutDisplay,
          address: swap.tokenOut,
        },
        description: summary,
        summary,
        details: [
          `Input: ${amountInFormatted ? `${amountInFormatted} ` : ""}${tokenInDisplay}`,
          `Output: ${amountOutMinFormatted ? `min ${amountOutMinFormatted} ` : ""}${tokenOutDisplay}`,
          `Protocol: ${protocol}`,
          `Recipient: ${shortenAddress(swap.recipient)}`,
        ],
      };
    }
  }

  /**
   * ================================================
   * FALLBACK
   * ================================================
   */
  const fallbackSummary = `Interact with contract ${shortenAddress(to)} using ${functionName ?? "an unknown function"}.`;
  return {
    title: "Contract transaction",
    action: functionName ?? action,
    valueNative,
    target: to,
    description: fallbackSummary,
    summary: fallbackSummary,
    details: [`Action type: ${action}`],
  };
}
