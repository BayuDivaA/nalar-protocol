import { LIMITS } from "./constants.js";

import { state } from "./state.js";

import { getProtectionStatus, getStoredIntent, saveIntent } from "./storage.js";

import { sendTransactionRequest, listenForTransactionResult } from "./messaging.js";

import { showIntentOverlay } from "./ui/intent.js";

import { showAnalysisOverlay } from "./ui/analysis.js";

import { showDecisionOverlay } from "./ui/decision.js";

export async function handleTransactionRequest({ originalRequest, args, providerLabel }) {
  console.log("[Nalar] Intercepted transaction from:", providerLabel);

  const protectionEnabled = await getProtectionStatus();

  console.log("[Nalar] Protection enabled:", protectionEnabled);

  if (!protectionEnabled) {
    console.log("[Nalar] Protection disabled. Forwarding.");

    return originalRequest(args);
  }

  const transaction = args?.params?.[0];

  if (!transaction) {
    throw new Error("[Nalar] Transaction object is missing.");
  }

  if (!transaction.to) {
    throw new Error("[Nalar] Contract target is missing.");
  }

  console.log("[Nalar] Transaction:", transaction);

  const storedIntent = await getStoredIntent();

  const confirmedIntent = await showIntentOverlay(storedIntent);

  if (!confirmedIntent) {
    throw new Error("[Nalar] Transaction cancelled by user.");
  }

  console.log("[Nalar] Confirmed intent:", confirmedIntent);

  await saveIntent(confirmedIntent);

  const chainId = await originalRequest({
    method: "eth_chainId",
  });

  console.log("[Nalar] Chain ID:", chainId);

  const id = ++state.requestId;

  console.log("[Nalar] Security request ID:", id);

  const analysisOverlay = showAnalysisOverlay();

  return new Promise((resolve, reject) => {
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;

      cleanup();

      analysisOverlay.remove();

      console.error("[Nalar] Security check timed out.", {
        id,
      });

      reject(new Error("[Nalar] Security check timed out."));
    }, LIMITS.SECURITY_TIMEOUT);

    let removeListener;

    function cleanup() {
      clearTimeout(timeout);

      if (removeListener) {
        removeListener();
      }
    }

    async function continueToWallet() {
      if (settled) {
        return;
      }

      settled = true;

      cleanup();
      analysisOverlay.remove();

      console.log("[Nalar] Forwarding transaction to wallet.");

      try {
        const result = await originalRequest(args);

        resolve(result);
      } catch (error) {
        reject(error);
      }
    }

    function cancelTransaction(message) {
      if (settled) {
        return;
      }

      settled = true;

      cleanup();
      analysisOverlay.remove();

      console.log("[Nalar] Transaction cancelled:", message);

      reject(new Error(message || "[Nalar] Transaction cancelled."));
    }

    removeListener = listenForTransactionResult((message) => {
      console.log("[Nalar] TX_RESULT received:", message);

      if (message.id !== id) {
        console.warn("[Nalar] Ignoring TX_RESULT with different ID:", message.id, id);

        return;
      }

      if (settled) {
        return;
      }

      const security = message.security;

      if (!security) {
        cancelTransaction("[Nalar] Security result missing.");

        return;
      }

      analysisOverlay.remove();

      const decision = security.decision;

      console.log("[Nalar] Final decision:", decision, security);

      if (decision === "BLOCK") {
        showDecisionOverlay(security, "BLOCK", null, cancelTransaction);

        return;
      }

      if (decision === "REVIEW") {
        showDecisionOverlay(security, "REVIEW", continueToWallet, cancelTransaction);

        return;
      }

      showDecisionOverlay(security, "ALLOW", continueToWallet, cancelTransaction);
    });

    console.log("[Nalar] Sending TX_REQUEST:", {
      id,
      chainId,
      transaction,
    });

    sendTransactionRequest({
      id,
      chainId,
      transaction,
    });
  });
}
