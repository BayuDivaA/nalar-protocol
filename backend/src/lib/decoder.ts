import { decodeFunctionData, type Abi, type Address, type Hex } from "viem";

import { securityAbi } from "./abis";
import { classifyAction, type ClassifiedAction } from "./classifier";

import { resolveContractAbi } from "../services/contract-resolver";

export interface DecodedTransaction {
  decoded: boolean;

  functionName?: string;

  args?: readonly unknown[];

  selector?: string;

  classification: ClassifiedAction;

  abiSource?: "local" | "sourcify" | "unknown";

  contractVerified?: boolean;
}

function decodeWithAbi(
  abi: Abi,
  data: Hex,
): {
  functionName: string;
  args: readonly unknown[];
} | null {
  try {
    const decoded = decodeFunctionData({
      abi,
      data,
    });

    return {
      functionName: decoded.functionName,
      args: decoded.args ?? [],
    };
  } catch {
    return null;
  }
}

export async function decodeTransactionData(
  data: Hex,
  input?: {
    chainId: number;
    to: Address;
  },
): Promise<DecodedTransaction> {
  /**
   * Native BNB transfer.
   */
  if (data === "0x") {
    return {
      decoded: false,

      classification: {
        action: "UNKNOWN",
        riskLevel: "LOW",
        description: "Native BNB transfer with no contract calldata.",
      },

      abiSource: "unknown",
      contractVerified: false,
    };
  }

  /**
   * First 4 bytes = function selector.
   */
  const selector = data.slice(0, 10);

  /**
   * ----------------------------------------------------
   * 1. Try local ABI first
   * ----------------------------------------------------
   */
  const localDecoded = decodeWithAbi(securityAbi, data);

  if (localDecoded) {
    const classification = classifyAction(localDecoded.functionName, localDecoded.args);

    return {
      decoded: true,
      functionName: localDecoded.functionName,
      args: localDecoded.args,
      selector,
      classification,
      abiSource: "local",
      contractVerified: true,
    };
  }

  /**
   * ----------------------------------------------------
   * 2. Try external verified ABI
   * ----------------------------------------------------
   */
  if (input) {
    const resolution = await resolveContractAbi({
      chainId: input.chainId,
      address: input.to,
    });

    if (resolution.found && resolution.contract) {
      const externalDecoded = decodeWithAbi(resolution.contract.abi, data);

      if (externalDecoded) {
        const classification = classifyAction(externalDecoded.functionName, externalDecoded.args);

        return {
          decoded: true,
          functionName: externalDecoded.functionName,
          args: externalDecoded.args,
          selector,
          classification,
          abiSource: "sourcify",
          contractVerified: resolution.contract.verified,
        };
      }
    }
  }

  /**
   * ----------------------------------------------------
   * 3. Unknown function
   * ----------------------------------------------------
   */
  return {
    decoded: false,

    selector,

    classification: {
      action: "UNKNOWN",
      riskLevel: "MEDIUM",
      description: "Function selector is not recognized by the available ABI registries.",
    },

    abiSource: "unknown",
    contractVerified: false,
  };
}
