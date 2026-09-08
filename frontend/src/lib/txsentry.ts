import type { Address, Hex } from "viem";

import { securityCheck, type SecurityCheckResponse } from "@/src/lib/api";

import { sendTransaction } from "@/src/lib/wallet";

export interface TransactionRequest {
  chainId: number;
  to: Address;
  value: bigint;
  data: Hex;
}

export interface GuardedTransaction {
  intent: string;
  transaction: TransactionRequest;
}

export interface GuardedTransactionResult {
  security: SecurityCheckResponse;
  txHash?: Hex;
}

/**
 * Analyze a transaction before it reaches the wallet.
 *
 * IMPORTANT:
 * - BLOCK never reaches wallet signing.
 * - REVIEW stops before signing.
 * - ALLOW is the only automatic signing path.
 */
export async function guardedSendTransaction(input: GuardedTransaction): Promise<GuardedTransactionResult> {
  const from = await getConnectedAccount();

  if (input.transaction.chainId !== 97) {
    throw new Error("Only BNB Testnet transactions are supported.");
  }

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

  if (security.decision === "BLOCK") {
    return {
      security,
    };
  }

  if (security.decision === "REVIEW") {
    return {
      security,
    };
  }

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

/**
 * Sign a transaction that has previously
 * received a REVIEW verdict and was explicitly
 * confirmed by the user.
 */
export async function confirmAndSendTransaction(input: {
  security: SecurityCheckResponse;

  transaction: TransactionRequest;
}): Promise<Hex> {
  if (input.security.decision !== "REVIEW") {
    throw new Error("Only REVIEW transactions can be confirmed.");
  }

  const from = await getConnectedAccount();

  return sendTransaction({
    account: from,

    to: input.transaction.to,

    value: input.transaction.value,

    data: input.transaction.data,
  });
}

async function getConnectedAccount(): Promise<Address> {
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
    throw new Error("No injected wallet found. Please install MetaMask.");
  }

  const accounts = (await ethereum.request({
    method: "eth_requestAccounts",
  })) as string[];

  if (accounts.length === 0) {
    throw new Error("No wallet account selected.");
  }

  return accounts[0] as Address;
}
