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

  abiSource?: "local" | "sourcify" | "protocol" | "unknown";

  contractVerified?: boolean;
}

interface DecodeInput {
  chainId: number;
  to: Address;
  data: Hex;
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

export async function decodeTransactionData(input: DecodeInput): Promise<DecodedTransaction> {
  const { chainId, to, data } = input;

  /**
   * No calldata means native BNB transfer.
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

  const selector = data.slice(0, 10);

  /**
   * --------------------------------------------------
   * 1. Try local security ABI first.
   * --------------------------------------------------
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
   * --------------------------------------------------
   * 2. Fallback to Sourcify.
   * --------------------------------------------------
   */
  const resolved = await resolveContractAbi({
    chainId,
    address: to,
  });

  if (resolved.found && resolved.contract) {
    const externalDecoded = decodeWithAbi(resolved.contract.abi, data);

    if (externalDecoded) {
      const classification = classifyAction(externalDecoded.functionName, externalDecoded.args);

      return {
        decoded: true,
        functionName: externalDecoded.functionName,
        args: externalDecoded.args,
        selector,
        classification,
        abiSource: resolved.contract.source,
        contractVerified: resolved.contract.verified,
      };
    }
  }

  /**
   * --------------------------------------------------
   * 3. Unknown selector.
   * --------------------------------------------------
   */
  return {
    decoded: false,
    selector,

    classification: {
      action: "UNKNOWN",
      riskLevel: "MEDIUM",
      description: "Function selector is not recognized by the available ABI sources.",
    },

    abiSource: resolved.found ? (resolved.contract?.source ?? "unknown") : "unknown",

    contractVerified: resolved.contract?.verified ?? false,
  };
}
