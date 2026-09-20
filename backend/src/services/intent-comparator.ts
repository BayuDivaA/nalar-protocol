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
  quantity?: FieldComparison<number | string>;
  summary: string;
}

export interface CompareIntentContext {
  targetIsContract?: boolean | null;
  functionName?: string | null;
  args?: readonly unknown[];
  actualQuantity?: number | null;
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

export function compareIntent(
  intent: NormalizedIntent,
  actualAction: TransactionAction,
  effects: TransactionEffects,
  value: bigint,
  context?: CompareIntentContext,
): IntentComparison {
  const mismatches: string[] = [];

  let actionComparison: FieldComparison<string>;
  let inputTokenComparison: FieldComparison<string> = { status: "UNSPECIFIED" };
  let outputTokenComparison: FieldComparison<string> = { status: "UNSPECIFIED" };
  let amountComparison: FieldComparison<string | number> = { status: "UNSPECIFIED" };
  let recipientComparison: FieldComparison<string> = { status: "UNSPECIFIED" };
  let quantityComparison: FieldComparison<number | string> = { status: "UNSPECIFIED" };

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
  } else if (context?.targetIsContract === false && intent.action === "MINT") {
    actionComparison = {
      status: "MISMATCH",
      expected: "MINT",
      actual: "PAYMENT",
      reason: "Target address is not a smart contract.",
    };
    mismatches.push("Target address is not a smart contract; no minting contract logic detected.");
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
   * 3. Check MINT semantics.
   */
  if (intent.action === "MINT") {
    // Determine actual quantity
    let actualQty: number | null | undefined = context?.actualQuantity;
    if (actualQty === undefined) {
      if (effects.mints && effects.mints.length > 0) {
        actualQty = effects.mints[0]?.quantity ?? null;
      } else if (actualAction === "MINT" || context?.functionName === "mint" || context?.functionName === "safeMint") {
        actualQty = 1;
      } else {
        actualQty = null;
      }
    }

    // Compare quantity if specified in intent
    if (intent.quantity !== null) {
      if (actualQty !== null && actualQty !== undefined) {
        if (intent.quantity === actualQty) {
          quantityComparison = {
            status: "MATCH",
            expected: intent.quantity,
            actual: actualQty,
          };
        } else {
          quantityComparison = {
            status: "MISMATCH",
            expected: intent.quantity,
            actual: actualQty,
            reason: `Expected ${intent.quantity}, actual is ${actualQty}`,
          };
          mismatches.push(`NFT quantity mismatch: Expected ${intent.quantity}, Actual ${actualQty}.`);
        }
      } else {
        quantityComparison = {
          status: "UNSPECIFIED",
          expected: intent.quantity,
          reason: "Actual mint quantity could not be determined.",
        };
      }
    }

    // Compare payment / amount for MINT
    if (intent.maxValueNative !== null) {
      const expectedPayment = `${intent.maxValueNative} tBNB`;
      const actualPayment = `${formatUnits(value, 18)} tBNB`;

      if (intent.maxValueWei !== null && value === intent.maxValueWei) {
        amountComparison = {
          status: "MATCH",
          expected: expectedPayment,
          actual: actualPayment,
        };
      } else {
        amountComparison = {
          status: "MISMATCH",
          expected: expectedPayment,
          actual: actualPayment,
          reason: `Expected ${expectedPayment}, actual is ${actualPayment}`,
        };
        mismatches.push(`Payment mismatch: Expected ${expectedPayment}, Actual ${actualPayment}.`);
      }
    }
  }

  /**
   * 4. Check maximum BNB spending (for non-MINT operations).
   */
  if (intent.action !== "MINT" && intent.maxValueWei !== null && value > intent.maxValueWei) {
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
   * 5. Check approval side effects.
   */
  const hasApproval = effects.approvals.length > 0;
  if (hasApproval && !intent.allowApproval) {
    mismatches.push("Transaction requests an approval that the user did not intend to grant.");
  }

  /**
   * 6. Specific protection for mint intent.
   */
  if (intent.action === "MINT" && hasApproval) {
    mismatches.push("User intended to mint an NFT, but the transaction includes an approval effect.");
  }

  /**
   * Determine overall status and human summary.
   *
   * Invariants:
   * 1. If mismatches.length > 0 -> overall is "MISMATCH", matches is false.
   * 2. If intent action is UNKNOWN -> overall is "UNCERTAIN", matches is false.
   * 3. If any specified intent requirement is UNVERIFIED / UNSPECIFIED -> overall is "UNCERTAIN", matches is false.
   *    (UNKNOWN != MATCH: A transaction must NEVER show MATCH when a required comparison field is unknown).
   * 4. Only if all specified intent requirements have status "MATCH" -> overall is "MATCH", matches is true.
   */
  const isMismatch = mismatches.length > 0;

  let hasUnverifiedRequirement = false;
  if (intent.action === "UNKNOWN") {
    hasUnverifiedRequirement = true;
  }
  if (intent.action === "MINT" && intent.quantity !== null && quantityComparison.status === "UNSPECIFIED") {
    hasUnverifiedRequirement = true;
  }
  if (intent.action === "SWAP" && intent.quantity !== null && amountComparison.status === "UNSPECIFIED") {
    hasUnverifiedRequirement = true;
  }
  if (intent.action === "SWAP" && intent.tokenIn !== null && inputTokenComparison.status === "UNSPECIFIED") {
    hasUnverifiedRequirement = true;
  }
  if (intent.action === "SWAP" && intent.tokenOut !== null && outputTokenComparison.status === "UNSPECIFIED") {
    hasUnverifiedRequirement = true;
  }

  let overall: "MATCH" | "MISMATCH" | "UNCERTAIN";
  let matches: boolean;

  if (intent.action === "UNKNOWN") {
    overall = "UNCERTAIN";
    matches = false;
  } else if (isMismatch) {
    overall = "MISMATCH";
    matches = false;
  } else if (hasUnverifiedRequirement) {
    overall = "UNCERTAIN";
    matches = false;
  } else {
    overall = "MATCH";
    matches = true;
  }

  let summary = "";
  if (quantityComparison.status === "MISMATCH" && amountComparison.status === "MISMATCH") {
    summary = `You asked to mint ${quantityComparison.expected} NFTs for ${amountComparison.expected}, but the transaction mints ${quantityComparison.actual} NFT for ${amountComparison.actual}.`;
  } else if (quantityComparison.status === "MISMATCH") {
    summary = `You asked to mint ${quantityComparison.expected} NFTs, but the transaction mints ${quantityComparison.actual}.`;
  } else if (outputTokenComparison.status === "MISMATCH") {
    summary = `You asked to receive ${outputTokenComparison.expected}, but this transaction is configured to receive ${outputTokenComparison.actual} instead.`;
  } else if (inputTokenComparison.status === "MISMATCH") {
    summary = `You asked to spend ${inputTokenComparison.expected}, but this transaction is configured to spend ${inputTokenComparison.actual} instead.`;
  } else if (amountComparison.status === "MISMATCH") {
    summary = `You intended to pay ${amountComparison.expected}, but the transaction sends ${amountComparison.actual}.`;
  } else if (actionComparison.status === "MISMATCH") {
    summary = `You intended to ${intent.action.toLowerCase()}, but the transaction performs ${actualAction.toLowerCase()}.`;
  } else if (intent.action === "UNKNOWN") {
    summary = "Could not clearly verify your intent from the description.";
  } else if (overall === "UNCERTAIN") {
    summary = "Could not verify all requested transaction parameters from the transaction data.";
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
    quantity: quantityComparison,
    summary,
  };
}
