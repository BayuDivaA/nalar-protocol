import type { Abi } from "viem";

import { pancakeswapUniversalRouterAbi } from "./pancakeswap";

export interface ProtocolContract {
  name: string;

  protocol: "PancakeSwap";

  address: `0x${string}`;

  chainId: number;

  abi: Abi;
}

export const protocolContracts: ProtocolContract[] = [
  {
    name: "PancakeSwap Infinity Universal Router",

    protocol: "PancakeSwap",

    chainId: 97,

    address: "0x87FD5305E6a40F378da124864B2D479c2028BD86",

    abi: pancakeswapUniversalRouterAbi,
  },
];

export function findProtocolContract(input: {
  chainId: number;

  address: `0x${string}`;
}): ProtocolContract | null {
  const normalized = input.address.toLowerCase();

  return protocolContracts.find((contract) => contract.chainId === input.chainId && contract.address.toLowerCase() === normalized) ?? null;
}
