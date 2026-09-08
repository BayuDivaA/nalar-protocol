import type { Address } from "viem";

import { publicClient } from "../lib/viem";

const erc20MetadataAbi = [
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "string",
      },
    ],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint8",
      },
    ],
  },
] as const;

export interface TokenMetadata {
  address: Address;
  symbol: string | null;
  decimals: number | null;
}

export async function resolveTokenMetadata(address: Address): Promise<TokenMetadata> {
  let symbol: string | null = null;
  let decimals: number | null = null;

  try {
    symbol = await publicClient.readContract({
      address,
      abi: erc20MetadataAbi,
      functionName: "symbol",
    });
  } catch (error) {
    console.warn(`[TOKEN] Failed to read symbol for ${address}`, error);
  }

  try {
    decimals = await publicClient.readContract({
      address,
      abi: erc20MetadataAbi,
      functionName: "decimals",
    });
  } catch (error) {
    console.warn(`[TOKEN] Failed to read decimals for ${address}`, error);
  }

  return {
    address,
    symbol,
    decimals,
  };
}
