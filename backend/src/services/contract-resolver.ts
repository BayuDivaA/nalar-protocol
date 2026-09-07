import { getAddress, type Abi, type Address } from "viem";

const SOURCIFY_BASE_URL = "https://sourcify.dev/server/v2";

export interface ResolvedContractAbi {
  address: Address;
  chainId: number;
  abi: Abi;
  source: "sourcify";
  verified: boolean;
}

export interface ContractAbiResolution {
  found: boolean;
  contract?: ResolvedContractAbi;
  error?: string;
}

interface SourcifyResponse {
  abi?: unknown;
  match?: string;
  address?: string;
  chainId?: string;
}

export async function resolveContractAbi(input: { chainId: number; address: Address }): Promise<ContractAbiResolution> {
  const normalizedAddress = getAddress(input.address);

  const url = `${SOURCIFY_BASE_URL}/contract/` + `${input.chainId}/${normalizedAddress}?fields=abi`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (response.status === 404) {
      return {
        found: false,
        error: "Contract ABI was not found in Sourcify.",
      };
    }

    if (!response.ok) {
      return {
        found: false,
        error: `Sourcify returned HTTP ${response.status}.`,
      };
    }

    const data = (await response.json()) as SourcifyResponse;

    if (!Array.isArray(data.abi)) {
      return {
        found: false,
        error: "Sourcify returned a contract without a valid ABI.",
      };
    }

    return {
      found: true,
      contract: {
        address: normalizedAddress,
        chainId: input.chainId,
        abi: data.abi as Abi,
        source: "sourcify",
        verified: data.match === "exact_match" || data.match === "match",
      },
    };
  } catch (error) {
    return {
      found: false,
      error: error instanceof Error ? error.message : "Unknown Sourcify error.",
    };
  }
}
