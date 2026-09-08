import { formatUnits } from "viem";

export function formatTokenAmount(amount: bigint, decimals: number | null): string {
  if (decimals === null) {
    return amount.toString();
  }

  return formatUnits(amount, decimals);
}
