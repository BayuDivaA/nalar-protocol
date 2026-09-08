import { decodeAbiParameters, getAddress, type Address, type Hex } from "viem";

export interface DecodedV3SwapExactIn {
  command: "V3_SWAP_EXACT_IN";

  recipient: Address;

  amountIn: bigint;

  amountOutMin: bigint;

  path: Hex;

  payerIsUser: boolean;

  tokenIn: Address;

  tokenOut: Address;

  fees: number[];

  hopTokens: Address[];

  minHopPriceX36?: bigint[];
}

function decodeV3Path(path: Hex): {
  tokenIn: Address;
  tokenOut: Address;
  hopTokens: Address[];
  fees: number[];
} {
  const hex = path.slice(2);

  /**
   * V3 path format:
   *
   * address (20 bytes)
   * fee     (3 bytes)
   * address (20 bytes)
   * fee     (3 bytes)
   * address (20 bytes)
   *
   * Therefore:
   *
   * minimum length = 43 bytes
   *
   * Each additional hop = 23 bytes.
   */
  if (hex.length < 86) {
    throw new Error("Invalid V3 path: path must contain at least two tokens.");
  }

  if ((hex.length - 40) % 46 !== 0) {
    throw new Error("Invalid V3 path length.");
  }

  const hopTokens: Address[] = [];
  const fees: number[] = [];

  let offset = 0;

  /**
   * First token.
   */
  const firstToken = getAddress(`0x${hex.slice(offset, offset + 40)}`);

  hopTokens.push(firstToken);

  offset += 40;

  while (offset < hex.length) {
    /**
     * Fee = 3 bytes = 6 hex characters.
     */
    const feeHex = hex.slice(offset, offset + 6);

    if (feeHex.length !== 6) {
      throw new Error("Invalid V3 path fee encoding.");
    }

    const fee = Number.parseInt(feeHex, 16);

    fees.push(fee);

    offset += 6;

    /**
     * Next token = 20 bytes.
     */
    const tokenHex = hex.slice(offset, offset + 40);

    if (tokenHex.length !== 40) {
      throw new Error("Invalid V3 path token encoding.");
    }

    const token = getAddress(`0x${tokenHex}`);

    hopTokens.push(token);

    offset += 40;
  }

  if (hopTokens.length < 2) {
    throw new Error("Invalid V3 path: missing output token.");
  }

  return {
    tokenIn: hopTokens[0]!,
    tokenOut: hopTokens[hopTokens.length - 1]!,
    hopTokens,
    fees,
  };
}

/**
 * Try the standard five-parameter V3_SWAP_EXACT_IN:
 *
 * (
 *   address recipient,
 *   uint256 amountIn,
 *   uint256 amountOutMin,
 *   bytes path,
 *   bool payerIsUser
 * )
 *
 * Some current Universal Router implementations
 * include an additional uint256[] parameter.
 */
export function decodeV3SwapExactIn(input: Hex): DecodedV3SwapExactIn {
  let decoded: readonly [Address, bigint, bigint, Hex, boolean] | readonly [Address, bigint, bigint, Hex, boolean, readonly bigint[]];

  try {
    decoded = decodeAbiParameters([{ type: "address" }, { type: "uint256" }, { type: "uint256" }, { type: "bytes" }, { type: "bool" }], input);
  } catch {
    try {
      decoded = decodeAbiParameters([{ type: "address" }, { type: "uint256" }, { type: "uint256" }, { type: "bytes" }, { type: "bool" }, { type: "uint256[]" }], input);
    } catch {
      throw new Error("Unable to decode V3_SWAP_EXACT_IN input.");
    }
  }

  const recipient = decoded[0];

  const amountIn = decoded[1];

  const amountOutMin = decoded[2];

  const path = decoded[3];

  const payerIsUser = decoded[4];

  const minHopPriceX36 = decoded.length === 6 ? decoded[5] : undefined;

  const pathInfo = decodeV3Path(path);

  return {
    command: "V3_SWAP_EXACT_IN",

    recipient,

    amountIn,

    amountOutMin,

    path,

    payerIsUser,

    tokenIn: pathInfo.tokenIn,

    tokenOut: pathInfo.tokenOut,

    fees: pathInfo.fees,

    hopTokens: pathInfo.hopTokens,

    ...(minHopPriceX36 ? { minHopPriceX36: [...minHopPriceX36] } : {}),
  };
}
