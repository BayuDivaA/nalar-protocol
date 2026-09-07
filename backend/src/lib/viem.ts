import { createPublicClient, http } from "viem";

import { bscTestnet } from "viem/chains";

import { env } from "../config/env";

export const publicClient = createPublicClient({
  chain: bscTestnet,

  transport: http(env.BNB_RPC_URL),
});
