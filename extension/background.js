const BACKEND_URL = "http://localhost:3000";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "GET_PROTECTION_STATUS") {
    chrome.storage.local
      .get(["protectionEnabled"])
      .then((result) => {
        const enabled = result.protectionEnabled !== false;
        sendResponse({ enabled });
      })
      .catch((error) => {
        console.error("[Nalar] Failed to read protection status:", error);
        sendResponse({ enabled: false, error: "Unable to determine protection status." });
      });
    return true;
  }

  if (message?.type === "GET_INTENT") {
    getIntent(message.origin)
      .then((intent) => sendResponse({ intent }))
      .catch((error) => sendResponse({
        intent: null,
        error: error instanceof Error ? error.message : "Failed to get intent.",
      }));
    return true;
  }

  if (message?.type === "SET_INTENT") {
    saveIntent(message.origin, message.intent)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Failed to save intent.",
      }));
    return true;
  }

  if (message?.type === "CHECK_TRANSACTION") {
    handleSecurityCheck(message.transaction, message.chainId, message.origin)
      .then((security) => sendResponse({ security }))
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
  if (!origin) return null;
  const stored = await chrome.storage.local.get(["intents"]);
  return (stored.intents ?? {})[origin] ?? null;
}

async function saveIntent(origin, intent) {
  if (!origin) throw new Error("Origin is required.");
  if (typeof intent !== "string" || !intent.trim()) {
    throw new Error("Intent cannot be empty.");
  }

  const stored = await chrome.storage.local.get(["intents"]);
  const intents = stored.intents ?? {};
  intents[origin] = intent.trim();
  await chrome.storage.local.set({ intents });
}

async function handleSecurityCheck(transaction, chainId, origin) {
  if (typeof chainId !== "string" || !/^0x[0-9a-fA-F]+$/.test(chainId)) {
    throw new Error("Invalid wallet chain ID.");
  }

  const numericChainId = Number.parseInt(chainId, 16);

  if (numericChainId !== 97) {
    throw new Error(
      `[Nalar] Unsupported network. Expected BNB Testnet (97), received ${numericChainId}.`,
    );
  }

  if (typeof origin !== "string" || !origin) {
    throw new Error("Transaction origin is missing.");
  }

  const intent = await getIntent(origin);
  if (!intent) {
    throw new Error("Set your transaction intent in the Nalar extension popup first.");
  }

  if (!transaction || typeof transaction !== "object") {
    throw new Error("Transaction request is missing.");
  }

  const from = transaction.from;
  if (typeof from !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(from)) {
    throw new Error("Transaction does not include a valid wallet address.");
  }

  const to = transaction.to;
  if (typeof to !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(to)) {
    throw new Error("Transaction target is missing or invalid.");
  }

  const data = typeof transaction.data === "string" ? transaction.data : "0x";
  if (!/^0x([a-fA-F0-9]{2})*$/.test(data)) {
    throw new Error("Transaction calldata is invalid.");
  }

  const value = hexToDecimal(transaction.value ?? "0x0");

  const response = await fetch(`${BACKEND_URL}/api/transactions/security-check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      intent,
      transaction: { chainId: numericChainId, from, to, value, data },
    }),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`TxSentry returned ${response.status}: ${responseText}`);
  }

  try {
    return JSON.parse(responseText);
  } catch {
    throw new Error("TxSentry returned an invalid JSON response.");
  }
}

function hexToDecimal(value) {
  if (typeof value !== "string") return "0";
  if (value.startsWith("0x")) {
    try {
      return BigInt(value).toString();
    } catch {
      throw new Error("Transaction value is not a valid hexadecimal quantity.");
    }
  }
  if (/^\d+$/.test(value)) return value;
  throw new Error("Transaction value must be a hexadecimal or decimal quantity.");
}
