import type { Address, Hex } from "viem";

import { securityCheck, type SecurityCheckResponse } from "@/src/lib/api";

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

interface EthereumTransaction {
  from?: Address;
  to?: Address;
  value?: string;
  data?: Hex;
}

let installed = false;

export function installNalarProviderGuard(getIntent: () => string, onSecurityResult?: (result: SecurityCheckResponse) => void) {
  if (typeof window === "undefined" || installed) {
    return;
  }

  const ethereum = (
    window as Window & {
      ethereum?: EthereumProvider;
    }
  ).ethereum;

  if (!ethereum) {
    console.warn("[Nalar] No injected wallet provider found.");

    return;
  }

  /**
   * Keep a reference to the ORIGINAL wallet request.
   *
   * This is critical because ethereum.request
   * will be replaced by our guarded wrapper.
   */
  const originalRequest = ethereum.request.bind(ethereum);

  ethereum.request = async ({ method, params }) => {
    /**
     * Only transaction signing is intercepted.
     *
     * Everything else continues directly
     * to the original wallet provider.
     */
    if (method !== "eth_sendTransaction") {
      return originalRequest({
        method,
        params,
      });
    }

    const transaction = params?.[0] as EthereumTransaction | undefined;

    if (!transaction) {
      throw new Error("[Nalar] Transaction request is missing.");
    }

    if (!transaction.to) {
      throw new Error("[Nalar] Transaction target is missing.");
    }

    const intent = getIntent().trim();

    if (!intent) {
      throw new Error("[Nalar] User intent is required before signing.");
    }

    /**
     * Read wallet state using the ORIGINAL
     * provider, not the guarded provider.
     */
    const chainId = await getChainId(originalRequest);

    const from = transaction.from ?? (await getCurrentAccount(originalRequest));

    const value = transaction.value ?? "0x0";

    const data = transaction.data ?? "0x";

    /**
     * Ask TxSentry to inspect the transaction.
     */
    const security = await securityCheck({
      intent,

      transaction: {
        chainId,

        from,

        to: transaction.to,

        value: hexToDecimal(value),

        data,
      },
    });

    onSecurityResult?.(security);

    /**
     * BLOCK:
     *
     * Do NOT forward the transaction
     * to the wallet provider.
     */
    if (security.decision === "BLOCK") {
      throw new Error("[Nalar] Transaction blocked by TxSentry.");
    }

    /**
     * REVIEW:
     *
     * Stop before wallet signing.
     * User confirmation is required.
     */
    if (security.decision === "REVIEW") {
      throw new Error("[Nalar] Transaction requires review.");
    }

    /**
     * ALLOW:
     *
     * Only this path reaches the original
     * wallet provider.
     */
    return originalRequest({
      method,
      params: [
        {
          ...transaction,
          from,
        },
      ],
    });
  };

  installed = true;

  console.info("[Nalar] TxSentry provider guard installed.");
}

/**
 * Read current chain from the ORIGINAL
 * wallet provider.
 */
async function getChainId(originalRequest: EthereumProvider["request"]): Promise<number> {
  const chainId = (await originalRequest({
    method: "eth_chainId",
  })) as string;

  return Number.parseInt(chainId, 16);
}

/**
 * Read current wallet account from the ORIGINAL
 * wallet provider.
 */
async function getCurrentAccount(originalRequest: EthereumProvider["request"]): Promise<Address> {
  const accounts = (await originalRequest({
    method: "eth_accounts",
  })) as string[];

  if (accounts.length === 0) {
    throw new Error("[Nalar] No connected wallet account.");
  }

  return accounts[0] as Address;
}

function hexToDecimal(value: string): string {
  if (value.startsWith("0x")) {
    return BigInt(value).toString();
  }

  return value;
}
