import { decodeAbiParameters, getAddress, type Address, type Hex } from "viem";

export interface DecodedV2SwapExactIn {
  command: "V2_SWAP_EXACT_IN";

  recipient: Address;

  amountIn: bigint;

  amountOutMin: bigint;

  path: Address[];

  payerIsUser: boolean;

  tokenIn: Address;

  tokenOut: Address;

  hopTokens: Address[];
}

export function decodeV2SwapExactIn(input: Hex): DecodedV2SwapExactIn {
  let decoded: readonly [Address, bigint, bigint, readonly Address[], boolean];

  try {
    decoded = decodeAbiParameters([{ type: "address" }, { type: "uint256" }, { type: "uint256" }, { type: "address[]" }, { type: "bool" }], input);
  } catch (error) {
    throw new Error("Unable to decode V2_SWAP_EXACT_IN input.", {
      cause: error,
    });
  }

  const recipient = getAddress(decoded[0]);

  const amountIn = decoded[1];

  const amountOutMin = decoded[2];

  const path = decoded[3].map((address) => getAddress(address));

  const payerIsUser = decoded[4];

  if (path.length < 2) {
    throw new Error("Invalid V2 swap path: at least two tokens are required.");
  }

  return {
    command: "V2_SWAP_EXACT_IN",

    recipient,

    amountIn,

    amountOutMin,

    path,

    payerIsUser,

    tokenIn: path[0]!,

    tokenOut: path[path.length - 1]!,

    hopTokens: path,
  };
}
