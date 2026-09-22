import { createPublicClient, http, type PublicClient } from "viem";
import { bsc, bscTestnet } from "viem/chains";
import { env } from "../config/env";
import { NETWORKS } from "../config/networks";

const clientCache = new Map<number, PublicClient>();

export function getRpcUrl(chainId: number): string {
  if (chainId === 56) {
    return env.BSC_MAINNET_RPC_URL || NETWORKS[56].defaultRpcUrl;
  }
  return env.BSC_TESTNET_RPC_URL || env.BNB_RPC_URL || NETWORKS[97].defaultRpcUrl;
}

export function getPublicClient(chainId: number = 97): PublicClient {
  const normalizedChainId = chainId === 56 ? 56 : 97;
  const cached = clientCache.get(normalizedChainId);
  if (cached) {
    return cached;
  }

  const chain = normalizedChainId === 56 ? bsc : bscTestnet;
  const rpcUrl = getRpcUrl(normalizedChainId);

  const client = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  clientCache.set(normalizedChainId, client);
  return client;
}

export const publicClient = getPublicClient(97);
