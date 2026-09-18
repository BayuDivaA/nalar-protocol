const BACKEND_URL = "http://localhost:3001";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "GET_PROTECTION_STATUS") {
    chrome.storage.local
      .get(["protectionEnabled"])
      .then((result) => {
        const enabled = result.protectionEnabled !== false;

        console.log("[Nalar] Protection status:", enabled ? "ACTIVE" : "PAUSED");

        sendResponse({
          enabled,
        });
      })
      .catch((error) => {
        console.error("[Nalar] Failed to read protection status:", error);

        sendResponse({
          enabled: false,
          error: "Unable to determine protection status.",
        });
      });

    return true;
  }

  if (message?.type === "GET_INTENT") {
    getIntent(message.origin)
      .then((intent) => {
        sendResponse({
          intent,
        });
      })
      .catch((error) => {
        sendResponse({
          intent: null,
          error: error instanceof Error ? error.message : "Failed to get intent.",
        });
      });

    return true;
  }

  if (message?.type === "SET_INTENT") {
    saveIntent(message.origin, message.intent)
      .then(() => {
        sendResponse({
          ok: true,
        });
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Failed to save intent.",
        });
      });

    return true;
  }

  if (message?.type === "CHECK_TRANSACTION") {
    handleSecurityCheck(message.transaction, message.chainId, message.origin)
      .then((security) => {
        sendResponse({
          security,
        });
      })
      .catch((error) => {
        console.error("[Nalar] Security check failed:", error);

        sendResponse({
          security: null,
          error: error instanceof Error ? error.message : "Security check failed.",
        });
      });

    return true;
  }

  return false;
});

async function getIntent(origin) {
  if (!origin) {
    return null;
  }

  const stored = await chrome.storage.local.get(["intents"]);

  const intents = stored.intents ?? {};

  return intents[origin] ?? null;
}

async function saveIntent(origin, intent) {
  if (!origin) {
    throw new Error("Origin is required.");
  }

  if (typeof intent !== "string" || !intent.trim()) {
    throw new Error("Intent cannot be empty.");
  }

  const stored = await chrome.storage.local.get(["intents"]);

  const intents = stored.intents ?? {};

  intents[origin] = intent.trim();

  await chrome.storage.local.set({
    intents,
  });
}

async function handleSecurityCheck(transaction, chainId, origin) {
  if (typeof chainId !== "string" || !/^0x[0-9a-fA-F]+$/.test(chainId)) {
    throw new Error("Invalid wallet chain ID.");
  }

  const numericChainId = Number.parseInt(chainId, 16);

  if (numericChainId !== 97) {
    throw new Error(`[Nalar] Unsupported network. Expected BNB Testnet (97), received ${numericChainId}.`);
  }

  if (typeof origin !== "string" || !origin) {
    throw new Error("Transaction origin is missing.");
  }

  /**
   * Get intent belonging to the
   * current dApp origin.
   */
  const intent = await getIntent(origin);

  if (!intent) {
    throw new Error("Set your transaction intent in the Nalar extension popup first.");
  }

  if (!transaction) {
    throw new Error("Transaction request is missing.");
  }

  const from = transaction.from;

  if (!from) {
    throw new Error("Transaction does not include a wallet address.");
  }

  const response = await fetch(`${BACKEND_URL}/api/transactions/security-check`, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      intent,

      transaction: {
        chainId: numericChainId,

        from: transaction.from,

        to: transaction.to,

        value: hexToDecimal(transaction.value ?? "0x0"),

        data: transaction.data ?? "0x",
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();

    throw new Error(`TxSentry returned ${response.status}: ${text}`);
  }

  return response.json();
}

async function getChainId() {
  try {
    const response = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    const tab = response[0];

    if (!tab?.id) {
      return 97;
    }

    return await chrome.tabs.sendMessage(tab.id, {
      type: "GET_CHAIN_ID",
    });
  } catch {
    return 97;
  }
}

function hexToDecimal(value) {
  if (typeof value !== "string") {
    return "0";
  }

  if (value.startsWith("0x")) {
    return BigInt(value).toString();
  }

  return value;
}
