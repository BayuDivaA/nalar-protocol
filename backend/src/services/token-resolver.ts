import type { Address } from "viem";

import { getPublicClient } from "../lib/viem";
import { getNativeSymbol } from "../config/networks";

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

export function clearTokenMetadataCache(): void {
  tokenMetadataCache.clear();
}

export async function resolveTokenMetadata(address: Address, chainId: number = 97): Promise<TokenMetadata> {
  const normalized = address.toLowerCase();
  const cacheKey = `${chainId}:${normalized}`;

  if (normalized === ROUTER_NATIVE_ETH_FLAG || normalized === NATIVE_TOKEN_ADDRESS) {
    return {
      address,
      symbol: getNativeSymbol(chainId),
      decimals: 18,
    };
  }

  const cached = tokenMetadataCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  let symbol: string | null = null;
  let decimals: number | null = null;

  const client = getPublicClient(chainId);

  try {
    symbol = await client.readContract({
      address,
      abi: erc20MetadataAbi,
      functionName: "symbol",
    });
  } catch (error) {
    console.warn(`[TOKEN] Failed to read symbol for ${address} on chain ${chainId}`, error);
  }

  try {
    decimals = await client.readContract({
      address,
      abi: erc20MetadataAbi,
      functionName: "decimals",
    });
  } catch (error) {
    console.warn(`[TOKEN] Failed to read decimals for ${address} on chain ${chainId}`, error);
  }

  const result: TokenMetadata = {
    address,
    symbol,
    decimals,
  };

  if (symbol !== null || decimals !== null) {
    tokenMetadataCache.set(cacheKey, result);
  }

  return result;
}
