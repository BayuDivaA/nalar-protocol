(() => {
  // src/content/content.js
  var PAGE_SOURCE = "NALAR_PAGE";
  var EXTENSION_SOURCE = "NALAR_EXTENSION";
  console.log("[Nalar Content] Content bridge loaded.");
  window.addEventListener("message", async (event) => {
    if (event.source !== window) {
      return;
    }
    const message = event.data;
    if (!message || message.source !== PAGE_SOURCE) {
      return;
    }
    console.log("[Nalar Content] Received:", message.type);
    if (message.type === "GET_PROTECTION_STATUS") {
      await handleProtectionStatus();
      return;
    }
    if (message.type === "GET_INTENT") {
      await handleGetIntent();
      return;
    }
    if (message.type === "SAVE_INTENT") {
      await handleSaveIntent(message.intent);
      return;
    }
    if (message.type === "TX_REQUEST") {
      await handleTransactionRequest(message);
      return;
    }
  });
  async function handleProtectionStatus() {
    try {
      const result = await chrome.storage.local.get(["nalarProtectionEnabled"]);
      const enabled = result.nalarProtectionEnabled !== false;
      window.postMessage(
        {
          source: EXTENSION_SOURCE,
          type: "PROTECTION_STATUS",
          enabled
        },
        "*"
      );
    } catch (error) {
      console.error("[Nalar Content] Protection status error:", error);
      window.postMessage(
        {
          source: EXTENSION_SOURCE,
          type: "PROTECTION_STATUS",
          enabled: true
        },
        "*"
      );
    }
  }
  async function handleGetIntent() {
    try {
      const result = await chrome.storage.local.get(["nalarIntent"]);
      window.postMessage(
        {
          source: EXTENSION_SOURCE,
          type: "INTENT_RESULT",
          intent: result.nalarIntent || ""
        },
        "*"
      );
    } catch (error) {
      console.error("[Nalar Content] Get intent error:", error);
      window.postMessage(
        {
          source: EXTENSION_SOURCE,
          type: "INTENT_RESULT",
          intent: ""
        },
        "*"
      );
    }
  }
  async function handleSaveIntent(intent) {
    try {
      await chrome.storage.local.set({
        nalarIntent: typeof intent === "string" ? intent : ""
      });
      console.log("[Nalar Content] Intent saved.");
    } catch (error) {
      console.error("[Nalar Content] Save intent error:", error);
    }
  }
  async function handleTransactionRequest(message) {
    try {
      const stored = await chrome.storage.local.get(["nalarIntent"]);
      const intent = stored.nalarIntent || "";
      console.log("[Nalar Content] Sending security request to background.");
      const result = await chrome.runtime.sendMessage({
        type: "NALAR_SECURITY_CHECK",
        chainId: message.chainId,
        transaction: message.transaction,
        intent
      });
      console.log("[Nalar Content] Background result:", result);
      if (!result || result.ok !== true) {
        throw new Error(result?.error || "Security analysis failed.");
      }
      window.postMessage(
        {
          source: EXTENSION_SOURCE,
          type: "TX_RESULT",
          id: message.id,
          security: result.security
        },
        "*"
      );
      console.log("[Nalar Content] TX_RESULT delivered.");
    } catch (error) {
      console.error("[Nalar Content] Security request failed:", error);
      window.postMessage(
        {
          source: EXTENSION_SOURCE,
          type: "TX_RESULT",
          id: message.id,
          security: {
            decision: "BLOCK",
            riskScore: 100,
            riskLevel: "CRITICAL",
            reasons: ["Nalar could not complete the security analysis."],
            explanation: {
              summary: error?.message || "Nalar could not complete the security analysis."
            },
            intent: {
              description: ""
            },
            transactionSummary: {
              description: "Security analysis failed."
            },
            actual: {
              action: "UNKNOWN",
              functionName: null
            },
            intentMatch: false
          }
        },
        "*"
      );
    }
  }
})();
