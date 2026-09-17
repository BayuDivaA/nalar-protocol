import { state } from "./state.js";

import { handleTransactionRequest } from "./transaction.js";

export function getEthereum() {
  return window.ethereum;
}

export function wrapProvider(provider, label = "unknown") {
  if (!provider) {
    return;
  }

  if (typeof provider.request !== "function") {
    return;
  }

  if (state.wrappedProviders.has(provider)) {
    return;
  }

  state.wrappedProviders.add(provider);

  const originalRequest = provider.request.bind(provider);

  provider.request = async function (args) {
    try {
      if (args?.method !== "eth_sendTransaction") {
        return originalRequest(args);
      }

      return await handleTransactionRequest({
        originalRequest,
        args,
        providerLabel: label,
      });
    } catch (error) {
      throw error;
    }
  };

  console.info(`[Nalar] Provider wrapped: ${label}`);
}

export function handleEip6963Provider(event) {
  const detail = event.detail;

  if (!detail?.provider) {
    return;
  }

  const name = detail.info?.name || detail.info?.rdns || "EIP-6963 provider";

  wrapProvider(detail.provider, name);
}

export function installEip6963() {
  window.addEventListener("eip6963:announceProvider", handleEip6963Provider);

  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

export function installDirectProviders() {
  wrapProvider(window.ethereum, "window.ethereum");

  wrapProvider(window.rabby, "window.rabby");
}

export function installProviders() {
  installDirectProviders();
}
