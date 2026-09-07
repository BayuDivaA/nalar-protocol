import type { Address, Hex } from "viem";

import { securityCheck, type SecurityCheckResponse } from "@/src/lib/api";

import { sendTransaction } from "@/src/lib/wallet";

export interface GuardedTransaction {
  intent: string;

  transaction: {
    chainId: number;
    to: Address;
    value: bigint;
    data: Hex;
  };
}

export interface GuardedTransactionResult {
  security: SecurityCheckResponse;
  txHash?: Hex;
}

export async function guardedSendTransaction(input: GuardedTransaction): Promise<GuardedTransactionResult> {
  if (input.transaction.chainId !== 97) {
    throw new Error("Only BNB Testnet transactions are supported.");
  }

  const ethereum = getEthereum();

  const accounts = (await ethereum.request({
    method: "eth_requestAccounts",
  })) as string[];

  if (accounts.length === 0) {
    throw new Error("No wallet account selected.");
  }

  const from = accounts[0] as Address;

  /**
   * Security inspection happens BEFORE signing.
   */
  const security = await securityCheck({
    intent: input.intent,

    transaction: {
      chainId: input.transaction.chainId,
      from,
      to: input.transaction.to,
      value: input.transaction.value.toString(),
      data: input.transaction.data,
    },
  });

  /**
   * BLOCK:
   * never reach the wallet signing flow.
   */
  if (security.decision === "BLOCK") {
    return {
      security,
    };
  }

  /**
   * REVIEW:
   * never silently proceed.
   *
   * The UI must explicitly ask the user
   * before a transaction can continue.
   */
  if (security.decision === "REVIEW") {
    return {
      security,
    };
  }

  /**
   * ALLOW:
   * only now can the transaction
   * reach the wallet.
   */
  const txHash = await sendTransaction({
    account: from,
    to: input.transaction.to,
    value: input.transaction.value,
    data: input.transaction.data,
  });

  return {
    security,
    txHash,
  };
}

function getEthereum() {
  if (typeof window === "undefined") {
    throw new Error("Wallet is only available in the browser.");
  }

  const ethereum = (
    window as Window & {
      ethereum?: {
        request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      };
    }
  ).ethereum;

  if (!ethereum) {
    throw new Error("No injected wallet found.");
  }

  return ethereum;
}

export async function confirmAndSendTransaction(input: {
  security: SecurityCheckResponse;
  transaction: {
    to: Address;
    value: bigint;
    data: Hex;
  };
}): Promise<Hex> {
  if (input.security.decision !== "REVIEW") {
    throw new Error("Only REVIEW transactions can be manually confirmed.");
  }

  if (!input.security.explanation || input.security.explanation.recommendedAction !== "REVIEW") {
    throw new Error("Transaction does not require manual review.");
  }

  const ethereum = getEthereum();

  const accounts = (await ethereum.request({
    method: "eth_requestAccounts",
  })) as string[];

  if (accounts.length === 0) {
    throw new Error("No wallet account selected.");
  }

  return sendTransaction({
    account: accounts[0] as Address,
    to: input.transaction.to,
    value: input.transaction.value,
    data: input.transaction.data,
  });
}
