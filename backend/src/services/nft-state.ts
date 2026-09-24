import type { Address } from "viem";

import { publicClient } from "../lib/viem";
import { demoNftAbi } from "../lib/demo-nft";

export async function getApprovalState(collection: Address, owner: Address, operator: Address): Promise<boolean | null> {
  try {
    const result = await publicClient.readContract({
      address: collection,
      abi: demoNftAbi,
      functionName: "isApprovedForAll",
      args: [owner, operator],
    });

    return result;
  } catch (error) {
    console.error("Failed to read NFT approval state:", error);

    return null;
  }
}
