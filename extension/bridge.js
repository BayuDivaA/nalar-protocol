(() => {
  "use strict";

  if (window.__NALAR_BRIDGE_INSTALLED__) {
    return;
  }

  window.__NALAR_BRIDGE_INSTALLED__ = true;

  console.info("[Nalar] Extension bridge installed.");

  // Presentation only: share the popup's existing preference with Nalar overlays.
  let theme;
  const systemTheme = window.matchMedia("(prefers-color-scheme: light)");
  const applyTheme = () => document.documentElement?.setAttribute("data-nalar-theme", theme ?? (systemTheme.matches ? "light" : "dark"));
  chrome.storage.local.get(["nalarTheme"]).then((result) => {
    theme = ["light", "dark"].includes(result.nalarTheme) ? result.nalarTheme : undefined;
    applyTheme();
  }).catch(applyTheme);
  document.addEventListener("DOMContentLoaded", applyTheme, { once: true });
  systemTheme.addEventListener("change", applyTheme);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.nalarTheme) return;
    theme = ["light", "dark"].includes(changes.nalarTheme.newValue) ? changes.nalarTheme.newValue : undefined;
    applyTheme();
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "TX_PROGRESS") return;
    window.postMessage({ source: "NALAR_EXTENSION", type: "TX_PROGRESS", id: message.id, chainId: message.chainId, progress: message.progress }, "*");
  });

  window.addEventListener("message", async (event) => {
    if (event.source !== window) {
      return;
    }

    const message = event.data;

    if (!message || message.source !== "NALAR_PAGE") {
      return;
    }

    try {
      switch (message.type) {
        case "GET_NETWORK": {
          const response = await chrome.runtime.sendMessage({ type: "GET_NETWORK" });
          window.postMessage({ source: "NALAR_EXTENSION", type: "NETWORK_RESULT", id: message.id, chainId: response?.chainId ?? null, error: response?.error ?? null }, "*");
          return;
        }

        case "SET_NETWORK": {
          const response = await chrome.runtime.sendMessage({ type: "SET_NETWORK", chainId: message.chainId });
          window.postMessage({ source: "NALAR_EXTENSION", type: "NETWORK_SAVED", id: message.id, ok: response?.ok === true, error: response?.error ?? null }, "*");
          return;
        }

        case "GET_PROTECTION_STATUS": {
          const response = await chrome.runtime.sendMessage({
            type: "GET_PROTECTION_STATUS",

            id: message.id,
          });

          window.postMessage(
            {
              source: "NALAR_EXTENSION",

              type: "PROTECTION_STATUS",

              id: message.id,

              enabled: response?.enabled === true,

              error: response?.error ?? null,
            },
            "*",
          );

          return;
        }

        case "GET_INTENT": {
          const response = await chrome.runtime.sendMessage({
            type: "GET_INTENT",

            origin: window.location.origin,

            id: message.id,
          });

          window.postMessage(
            {
              source: "NALAR_EXTENSION",

              type: "INTENT_RESULT",

              id: message.id,

              intent: response?.intent ?? null,

              error: response?.error ?? null,
            },
            "*",
          );

          return;
        }

        case "SET_INTENT": {
          const response = await chrome.runtime.sendMessage({
            type: "SET_INTENT",

            origin: window.location.origin,

            intent: message.intent,

            id: message.id,
          });

          window.postMessage(
            {
              source: "NALAR_EXTENSION",

              type: "INTENT_SAVED",

              id: message.id,

              ok: response?.ok === true,

              error: response?.error ?? null,
            },
            "*",
          );

          return;
        }

        case "TX_REQUEST": {
          console.info("[Nalar] TX_REQUEST → background", message.id);

          const response = await chrome.runtime.sendMessage({
            type: "CHECK_TRANSACTION",

            origin: window.location.origin,

            id: message.id,

            chainId: message.chainId,

            transaction: message.transaction,
          });

          console.info("[Nalar] Backend result received:", message.id);

          window.postMessage(
            {
              source: "NALAR_EXTENSION",

              type: "TX_RESULT",

              id: message.id,

              security: response?.security ?? null,

              error: response?.error ?? null,

              errorCode: response?.errorCode ?? null,

              receivedChainId: response?.receivedChainId ?? null,
            },
            "*",
          );

          return;
        }

        default:
          return;
      }
    } catch (error) {
      console.error("[Nalar] Bridge error:", error);

      window.postMessage(
        {
          source: "NALAR_EXTENSION",

          type: "BRIDGE_ERROR",

          id: message.id,

          error: error instanceof Error ? error.message : "Extension bridge failed.",
        },
        "*",
      );
    }
  });
})();
