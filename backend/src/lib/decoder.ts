import { decodeFunctionData, type Hex } from "viem";

import { securityAbi } from "./abis";

import { classifyAction, type ClassifiedAction } from "./classifier";

export interface DecodedTransaction {
  decoded: boolean;

  functionName?: string;

  args?: readonly unknown[];

  selector?: string;

  classification: ClassifiedAction;
}

export function decodeTransactionData(data: Hex): DecodedTransaction {
  /**
   * No calldata means this is a native
   * BNB transfer.
   */
  if (data === "0x") {
    return {
      decoded: false,

      classification: {
        action: "UNKNOWN",
        riskLevel: "LOW",
        description: "Native BNB transfer with no contract calldata.",
      },
    };
  }

  /**
   * First 4 bytes = function selector.
   *
   * Example:
   * 0x095ea7b3 = approve(address,uint256)
   */
  const selector = data.slice(0, 10);

  try {
    const decoded = decodeFunctionData({
      abi: securityAbi,
      data,
    });

    const classification = classifyAction(decoded.functionName, decoded.args);

    return {
      decoded: true,

      functionName: decoded.functionName,

      args: decoded.args,

      selector,

      classification,
    };
  } catch (error) {
    /**
     * Unknown function selector.
     *
     * IMPORTANT:
     * Unknown does NOT mean safe.
     */
    return {
      decoded: false,

      selector,

      classification: {
        action: "UNKNOWN",

        riskLevel: "MEDIUM",

        description: "Function selector is not recognized by the current ABI registry.",
      },
    };
  }
}
