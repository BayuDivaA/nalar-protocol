(() => {
  if (window.__NALAR_BRIDGE_INSTALLED__) {
    return;
  }

  window.__NALAR_BRIDGE_INSTALLED__ = true;

  window.addEventListener("message", async (event) => {
    if (event.source !== window) {
      return;
    }

    const message = event.data;

    if (!message || message.source !== "NALAR_PAGE") {
      return;
    }

    try {
      if (message.type === "GET_INTENT") {
        const response = await chrome.runtime.sendMessage({
          type: "GET_INTENT",
          origin: window.location.origin,
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

      if (message.type === "SET_INTENT") {
        const response = await chrome.runtime.sendMessage({
          type: "SET_INTENT",
          origin: window.location.origin,
          intent: message.intent,
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

      if (message.type === "TX_REQUEST") {
        const response = await chrome.runtime.sendMessage({
          type: "CHECK_TRANSACTION",
          id: message.id,
          origin: window.location.origin,
          chainId: message.chainId,
          transaction: message.transaction,
        });

        window.postMessage(
          {
            source: "NALAR_EXTENSION",
            type: "TX_RESULT",
            id: message.id,
            security: response?.security ?? null,
            error: response?.error ?? null,
          },
          "*",
        );

        return;
      }

      if (message.type === "GET_PROTECTION_STATUS") {
        const response = await chrome.runtime.sendMessage({
          type: "GET_PROTECTION_STATUS",
          id: message.id,
        });

        console.log("[Nalar] Protection response:", response);

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
    } catch (error) {
      console.error("[Nalar] Bridge error:", error);

      window.postMessage(
        {
          source: "NALAR_EXTENSION",
          type: "BRIDGE_ERROR",
          id: message.id,
          error:
            error instanceof Error
              ? error.message
              : "Extension bridge failed.",
        },
        "*",
      );
    }
  });
})();
