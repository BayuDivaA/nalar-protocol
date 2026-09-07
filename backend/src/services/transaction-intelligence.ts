import type { Address, Hex } from "viem";

import { decodeTransactionData, type DecodedTransaction } from "../lib/decoder";

export interface TransactionIntelligence extends DecodedTransaction {
  chainId: number;
  to: Address;
}

export async function analyzeTransactionIntelligence(input: { chainId: number; to: Address; data: Hex }): Promise<TransactionIntelligence> {
  const decoded = await decodeTransactionData(input.data, {
    chainId: input.chainId,
    to: input.to,
  });

  return {
    chainId: input.chainId,
    to: input.to,
    ...decoded,
  };
}
