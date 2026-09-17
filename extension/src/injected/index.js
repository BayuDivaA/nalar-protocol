import { installEip6963, installProviders } from "./providers.js";

import { LIMITS } from "./constants.js";

if (!window.__NALAR_TXSENTRY_INSTALLED__) {
  window.__NALAR_TXSENTRY_INSTALLED__ = true;

  installEip6963();
  installProviders();

  let attempts = 0;

  const timer = setInterval(() => {
    attempts += 1;

    installProviders();

    if (attempts >= LIMITS.PROVIDER_RESCAN_MAX_ATTEMPTS) {
      clearInterval(timer);

      if (!window.ethereum && !window.rabby) {
        console.warn("[Nalar] No known wallet provider detected.");
      }
    }
  }, LIMITS.PROVIDER_RESCAN_INTERVAL);

  console.info("[Nalar] TxSentry interceptor installed.");
}
