import type { NormalizedIntent } from "./intent-normalizer";

import type { TransactionEffects } from "./effect-analyzer";
import type { TransactionAction } from "../lib/classifier";

import { formatUnits, getAddress, parseUnits } from "viem";
import { formatTokenAmount } from "./token-amount";
import { formatDisplaySymbol } from "./transaction-translator";

export type FieldMatchStatus = "MATCH" | "MISMATCH" | "UNSPECIFIED";

export interface FieldComparison<T = unknown> {
  status: FieldMatchStatus;
  expected?: T;
  actual?: T;
  reason?: string;
}

export interface IntentComparison {
  matches: boolean;
  mismatches: string[];
  overall: "MATCH" | "MISMATCH" | "UNCERTAIN";
  action: FieldComparison<string>;
  inputToken: FieldComparison<string>;
  outputToken: FieldComparison<string>;
  amount: FieldComparison<string | number>;
  recipient: FieldComparison<string>;
  summary: string;
}

const WBNB_TESTNET = "0xae13d989dac2f0debff460ac112a837c89baa7cd".toLowerCase();
const ROUTER_ETH_FLAG = "0x0000000000000000000000000000000000000002".toLowerCase();

function normalizeTokenReference(token: string | null | undefined): string | null {
  if (!token) {
    return null;
  }

  const value = token.trim();

  if (!value) {
    return null;
  }

  if (/^0x[a-fA-F0-9]{40}$/.test(value)) {
    return getAddress(value);
  }

  return value.toUpperCase();
}

function isNativeBnbReference(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toUpperCase();

  return normalized === "BNB" || normalized === "TBNB" || normalized === "WBNB";
}

function tokenMatches(requested: string, actualAddress: string, actualSymbol?: string | null): boolean {
  const normalizedRequested = normalizeTokenReference(requested);

  if (!normalizedRequested) {
    return true;
  }

  /**
   * Native BNB and its wrapped representation
   * are semantically equivalent for a swap.
   *
   * PancakeSwap may wrap native BNB into WBNB
   * before executing the actual swap.
   */
  const addrLower = actualAddress.toLowerCase();
  if (isNativeBnbReference(requested) && (isNativeBnbReference(actualSymbol) || addrLower === WBNB_TESTNET || addrLower === ROUTER_ETH_FLAG)) {
    return true;
  }

  const normalizedAddress = normalizeTokenReference(actualAddress);

  if (normalizedRequested === normalizedAddress) {
    return true;
  }

  const normalizedSymbol = normalizeTokenReference(actualSymbol);

  return normalizedSymbol !== null && normalizedRequested === normalizedSymbol;
}

function quantityToRawAmount(quantity: number, decimals: number): bigint | null {
  if (!Number.isFinite(quantity) || quantity < 0) {
    return null;
  }

  const quantityText = String(quantity);

  if (/e/i.test(quantityText)) {
    return null;
  }

  try {
    return parseUnits(quantityText, decimals);
  } catch {
    return null;
  }
}

export function compareIntent(intent: NormalizedIntent, actualAction: TransactionAction, effects: TransactionEffects, value: bigint): IntentComparison {
  const mismatches: string[] = [];

  let actionComparison: FieldComparison<string>;
  let inputTokenComparison: FieldComparison<string> = { status: "UNSPECIFIED" };
  let outputTokenComparison: FieldComparison<string> = { status: "UNSPECIFIED" };
  let amountComparison: FieldComparison<string | number> = { status: "UNSPECIFIED" };
  let recipientComparison: FieldComparison<string> = { status: "UNSPECIFIED" };

  /**
   * 1. Check semantic action.
   */
  if (intent.action === "UNKNOWN") {
    actionComparison = {
      status: "UNSPECIFIED",
      expected: "UNKNOWN",
      actual: actualAction,
      reason: "Intent action could not be determined from the provided description.",
    };
    mismatches.push("Intent action could not be verified from the description.");
  } else if (intent.action === actualAction || (intent.action === "TRANSFER" && actualAction === "PAYMENT")) {
    actionComparison = {
      status: "MATCH",
      expected: intent.action,
      actual: actualAction,
    };
  } else {
    actionComparison = {
      status: "MISMATCH",
      expected: intent.action,
      actual: actualAction,
      reason: `Expected ${intent.action.toLowerCase()}, actual is ${actualAction.toLowerCase()}`,
    };
    mismatches.push(`User intended to ${intent.action.toLowerCase()}, but transaction actually performs ${actualAction.toLowerCase()}.`);
  }

  /**
   * 2. Check SWAP semantics.
   */
  const swap = effects.swaps[0];
  if (intent.action === "SWAP") {
    if (!swap) {
      actionComparison = {
        status: "MISMATCH",
        expected: "SWAP",
        actual: actualAction,
        reason: "User intended to swap tokens, but no swap effect was detected.",
      };
      mismatches.push("User intended to swap tokens, but no swap effect was detected.");
    } else {
      const actualTokenInSymbol = formatDisplaySymbol(swap.tokenInSymbol, swap.tokenIn);
      const actualTokenOutSymbol = formatDisplaySymbol(swap.tokenOutSymbol, swap.tokenOut);

      // Compare tokenIn
      if (intent.tokenIn !== null) {
        const inMatch = tokenMatches(intent.tokenIn, swap.tokenIn, swap.tokenInSymbol);
        if (inMatch) {
          inputTokenComparison = {
            status: "MATCH",
            expected: intent.tokenIn,
            actual: actualTokenInSymbol,
          };
        } else {
          inputTokenComparison = {
            status: "MISMATCH",
            expected: intent.tokenIn,
            actual: actualTokenInSymbol,
            reason: `Expected ${intent.tokenIn}, actual is ${actualTokenInSymbol}`,
          };
          mismatches.push(`Input token mismatch: User intended to sell ${intent.tokenIn}, but transaction actually sells ${actualTokenInSymbol}.`);
        }
      } else {
        inputTokenComparison = {
          status: "UNSPECIFIED",
          actual: actualTokenInSymbol,
        };
      }

      // Compare tokenOut
      if (intent.tokenOut !== null) {
        const outMatch = tokenMatches(intent.tokenOut, swap.tokenOut, swap.tokenOutSymbol);
        if (outMatch) {
          outputTokenComparison = {
            status: "MATCH",
            expected: intent.tokenOut,
            actual: actualTokenOutSymbol,
          };
        } else {
          outputTokenComparison = {
            status: "MISMATCH",
            expected: intent.tokenOut,
            actual: actualTokenOutSymbol,
            reason: `Expected ${intent.tokenOut}, actual is ${actualTokenOutSymbol}`,
          };
          mismatches.push(`Output token mismatch: User intended to receive ${intent.tokenOut}, but transaction actually receives ${actualTokenOutSymbol}.`);
        }
      } else {
        outputTokenComparison = {
          status: "UNSPECIFIED",
          actual: actualTokenOutSymbol,
        };
      }

      // Compare quantity / amount
      if (intent.quantity !== null) {
        if (swap.tokenInDecimals === null || swap.tokenInDecimals === undefined) {
          amountComparison = {
            status: "UNSPECIFIED",
            expected: intent.quantity,
            reason: "Input amount could not be verified because token decimals are unavailable.",
          };
          mismatches.push("Input amount could not be verified because token decimals are unavailable.");
        } else {
          const requestedAmount = quantityToRawAmount(intent.quantity, swap.tokenInDecimals);
          const actualAmountFormatted = formatTokenAmount(swap.amountIn, swap.tokenInDecimals);

          if (requestedAmount === null) {
            amountComparison = {
              status: "MISMATCH",
              expected: intent.quantity,
              actual: actualAmountFormatted,
              reason: "The requested swap amount could not be represented safely.",
            };
            mismatches.push("The requested swap amount could not be represented safely.");
          } else if (requestedAmount !== swap.amountIn) {
            amountComparison = {
              status: "MISMATCH",
              expected: intent.quantity,
              actual: actualAmountFormatted,
              reason: `Expected ${intent.quantity}, actual is ${actualAmountFormatted}`,
            };
            mismatches.push(`Input amount mismatch: User intended to swap ${intent.quantity} ${actualTokenInSymbol}, but transaction actually swaps ${actualAmountFormatted} ${actualTokenInSymbol}.`);
          } else {
            amountComparison = {
              status: "MATCH",
              expected: intent.quantity,
              actual: actualAmountFormatted,
            };
          }
        }
      }

      // Compare recipient if specified
      if (intent.targetAddress) {
        if (swap.recipient.toLowerCase() === intent.targetAddress.toLowerCase()) {
          recipientComparison = {
            status: "MATCH",
            expected: intent.targetAddress,
            actual: swap.recipient,
          };
        } else {
          recipientComparison = {
            status: "MISMATCH",
            expected: intent.targetAddress,
            actual: swap.recipient,
            reason: `Expected recipient ${intent.targetAddress}, actual is ${swap.recipient}`,
          };
          mismatches.push(`Recipient mismatch: Expected recipient ${intent.targetAddress}, transaction sends to ${swap.recipient}.`);
        }
      }
    }
  }

  /**
   * 3. Check maximum BNB spending.
   */
  if (intent.maxValueWei !== null && value > intent.maxValueWei) {
    const expectedValue = intent.maxValueNative ?? `${intent.maxValueWei.toString()} wei`;
    const actualValue = `${formatUnits(value, 18)} tBNB`;
    if (amountComparison.status !== "MISMATCH") {
      amountComparison = {
        status: "MISMATCH",
        expected: expectedValue,
        actual: actualValue,
        reason: "Transaction value exceeds user limit.",
      };
    }
    mismatches.push(`Transaction value exceeds limit: Expected <= ${expectedValue}, received ${actualValue}.`);
  }

  /**
   * 4. Check approval side effects.
   */
  const hasApproval = effects.approvals.length > 0;
  if (hasApproval && !intent.allowApproval) {
    mismatches.push("Transaction requests an approval that the user did not intend to grant.");
  }

  /**
   * 5. Specific protection for mint intent.
   */
  if (intent.action === "MINT" && hasApproval) {
    mismatches.push("User intended to mint an NFT, but the transaction includes an approval effect.");
  }

  /**
   * Determine overall status and human summary.
   */
  const isMismatch = mismatches.length > 0;
  const overall: "MATCH" | "MISMATCH" | "UNCERTAIN" = intent.action === "UNKNOWN" ? "UNCERTAIN" : isMismatch ? "MISMATCH" : "MATCH";
  const matches = !isMismatch && intent.action !== "UNKNOWN";

  let summary = "";
  if (outputTokenComparison.status === "MISMATCH") {
    summary = `You asked to receive ${outputTokenComparison.expected}, but this transaction is configured to receive ${outputTokenComparison.actual} instead.`;
  } else if (inputTokenComparison.status === "MISMATCH") {
    summary = `You asked to spend ${inputTokenComparison.expected}, but this transaction is configured to spend ${inputTokenComparison.actual} instead.`;
  } else if (amountComparison.status === "MISMATCH") {
    summary = `You intended to spend ${amountComparison.expected}, but the transaction sends ${amountComparison.actual}.`;
  } else if (actionComparison.status === "MISMATCH") {
    summary = `You intended to ${intent.action.toLowerCase()}, but the transaction performs ${actualAction.toLowerCase()}.`;
  } else if (intent.action === "UNKNOWN") {
    summary = "Could not clearly verify your intent from the description.";
  } else if (isMismatch) {
    summary = mismatches[0] ?? "Transaction details do not match your intent.";
  } else {
    summary = "Transaction matches your intended action.";
  }

  return {
    matches,
    mismatches,
    overall,
    action: actionComparison,
    inputToken: inputTokenComparison,
    outputToken: outputTokenComparison,
    amount: amountComparison,
    recipient: recipientComparison,
    summary,
  };
}
