import type { NormalizedIntent } from "./intent-normalizer";

import type { TransactionEffects } from "./effect-analyzer";
import type { TransactionAction } from "../lib/classifier";

import { getAddress, parseUnits } from "viem";
import { formatTokenAmount } from "./token-amount";

export interface IntentComparison {
  matches: boolean;

  mismatches: string[];
}

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
  if (isNativeBnbReference(requested) && isNativeBnbReference(actualSymbol)) {
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

  /**
   * 1. Check maximum BNB spending.
   */
  if (intent.maxValueWei !== null && value > intent.maxValueWei) {
    mismatches.push(["Transaction value exceeds the user's limit.", `Expected <= ${intent.maxValueWei.toString()} wei.`, `Received ${value.toString()} wei.`].join(" "));
  }

  /**
   * 2. Check semantic action.
   *
   * Some user-level actions map to a more
   * specific blockchain-level action.
   *
   * TRANSFER ↔ PAYMENT
   */
  const actualMatchesIntent = intent.action === "UNKNOWN" || intent.action === actualAction || (intent.action === "TRANSFER" && actualAction === "PAYMENT");

  if (!actualMatchesIntent) {
    mismatches.push([`User intended to ${intent.action.toLowerCase()}.`, `Transaction actually performs ${actualAction.toLowerCase()}.`].join(" "));
  }

  /**
   * 3. Check SWAP semantics.
   *
   * The action alone is not enough.
   * A SWAP intent also carries token direction.
   */
  if (intent.action === "SWAP") {
    const swap = effects.swaps[0];

    if (!swap) {
      mismatches.push("User intended to swap tokens, but no swap effect was detected.");
    } else {
      if (intent.tokenIn !== null && !tokenMatches(intent.tokenIn, swap.tokenIn, swap.tokenInSymbol)) {
        mismatches.push([`Input token mismatch.`, `User intended to sell ${intent.tokenIn}.`, `Transaction actually sells ${swap.tokenInSymbol ?? swap.tokenIn}.`].join(" "));
      }

      if (intent.tokenOut !== null && !tokenMatches(intent.tokenOut, swap.tokenOut, swap.tokenOutSymbol)) {
        mismatches.push([`Output token mismatch.`, `User intended to receive ${intent.tokenOut}.`, `Transaction actually receives ${swap.tokenOutSymbol ?? swap.tokenOut}.`].join(" "));
      }

      /**
       * Compare requested input amount.
       *
       * Only compare when the user explicitly
       * provided a quantity.
       */
      if (intent.quantity !== null) {
        if (swap.tokenInDecimals === null || swap.tokenInDecimals === undefined) {
          mismatches.push("Input amount could not be verified because token decimals are unavailable.");
        } else {
          const requestedAmount = quantityToRawAmount(intent.quantity, swap.tokenInDecimals);

          if (requestedAmount === null) {
            mismatches.push("The requested swap amount could not be represented safely.");
          } else if (requestedAmount !== swap.amountIn) {
            const actualAmount = formatTokenAmount(swap.amountIn, swap.tokenInDecimals);

            mismatches.push(
              ["Input amount mismatch.", `User intended to swap ${intent.quantity} ${swap.tokenInSymbol ?? intent.tokenIn ?? "tokens"}.`, `Transaction actually swaps ${actualAmount} ${swap.tokenInSymbol ?? "tokens"}.`].join(" "),
            );
          }
        }
      }
    }
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
   *
   * Minting should not silently introduce
   * approval side effects.
   */
  if (intent.action === "MINT" && hasApproval) {
    mismatches.push("User intended to mint an NFT, but the transaction includes an approval effect.");
  }

  return {
    matches: mismatches.length === 0,
    mismatches,
  };
}
