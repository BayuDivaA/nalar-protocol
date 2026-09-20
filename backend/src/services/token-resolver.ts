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

const tokenMetadataCache = new Map<string, TokenMetadata>();

const ROUTER_NATIVE_ETH_FLAG = "0x0000000000000000000000000000000000000002".toLowerCase();
const NATIVE_TOKEN_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee".toLowerCase();

export async function resolveTokenMetadata(address: Address): Promise<TokenMetadata> {
  const normalized = address.toLowerCase();

  if (normalized === ROUTER_NATIVE_ETH_FLAG || normalized === NATIVE_TOKEN_ADDRESS) {
    return {
      address,
      symbol: "tBNB",
      decimals: 18,
    };
  }

  const cached = tokenMetadataCache.get(normalized);
  if (cached) {
    return cached;
  }

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

  const result: TokenMetadata = {
    address,
    symbol,
    decimals,
  };

  if (symbol !== null || decimals !== null) {
    tokenMetadataCache.set(normalized, result);
  }

  return result;
}
