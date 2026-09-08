import type { SwapEffect } from "./effect-analyzer";
import { resolveTokenMetadata } from "./token-resolver";

export async function enrichSwapEffect(swap: SwapEffect): Promise<SwapEffect> {
  const [tokenIn, tokenOut] = await Promise.all([resolveTokenMetadata(swap.tokenIn), resolveTokenMetadata(swap.tokenOut)]);

  return {
    ...swap,

    tokenInSymbol: tokenIn.symbol,

    tokenOutSymbol: tokenOut.symbol,

    tokenInDecimals: tokenIn.decimals,

    tokenOutDecimals: tokenOut.decimals,
  };
}
