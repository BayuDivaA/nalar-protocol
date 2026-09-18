const BACKEND_URL = "http://localhost:3001";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "GET_PROTECTION_STATUS") {
    getProtectionStatus()
      .then((enabled) => {
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
          error: null,
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

/*
|--------------------------------------------------------------------------
| Protection status
|--------------------------------------------------------------------------
*/

async function getProtectionStatus() {
  const result = await chrome.storage.local.get(["protectionEnabled"]);

  return result.protectionEnabled !== false;
}

/*
|--------------------------------------------------------------------------
| Intent storage
|--------------------------------------------------------------------------
*/

async function getIntent(origin) {
  if (typeof origin !== "string" || !origin) {
    return null;
  }

  const result = await chrome.storage.local.get(["intents"]);

  const intents = result.intents ?? {};

  return typeof intents[origin] === "string" ? intents[origin] : null;
}

async function saveIntent(origin, intent) {
  if (typeof origin !== "string" || !origin) {
    throw new Error("Origin is required.");
  }

  if (typeof intent !== "string" || !intent.trim()) {
    throw new Error("Intent cannot be empty.");
  }

  const result = await chrome.storage.local.get(["intents"]);

  const intents = result.intents ?? {};

  intents[origin] = intent.trim();

  await chrome.storage.local.set({
    intents,
  });
}

/*
|--------------------------------------------------------------------------
| Security check
|--------------------------------------------------------------------------
*/

async function handleSecurityCheck(transaction, chainId, origin) {
  if (typeof chainId !== "string" || !/^0x[0-9a-fA-F]+$/.test(chainId)) {
    throw new Error("Invalid wallet chain ID.");
  }

  const numericChainId = Number.parseInt(chainId, 16);

  if (numericChainId !== 97) {
    throw new Error(`Nalar currently supports BNB Testnet only. Received chain ${numericChainId}.`);
  }

  if (typeof origin !== "string" || !origin) {
    throw new Error("Transaction origin is missing.");
  }

  const intent = await getIntent(origin);

  if (!intent) {
    throw new Error("No transaction intent is set for this website.");
  }

  const normalized = normalizeTransaction(transaction);

  console.log("[Nalar] Security request:", {
    chainId: numericChainId,
    origin,
    intent,
    transaction: normalized,
  });

  const response = await fetch(`${BACKEND_URL}/api/transactions/security-check`, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      intent,

      transaction: {
        chainId: numericChainId,

        from: normalized.from,

        to: normalized.to,

        value: normalized.value,

        data: normalized.data,
      },
    }),
  });

  const responseText = await response.text();

  console.log("[Nalar] Backend response:", response.status, responseText);

  if (!response.ok) {
    throw new Error(`Nalar security API returned ${response.status}.`);
  }

  try {
    return JSON.parse(responseText);
  } catch {
    throw new Error("Nalar returned an invalid security response.");
  }
}

/*
|--------------------------------------------------------------------------
| Transaction normalization
|--------------------------------------------------------------------------
*/

function normalizeTransaction(transaction) {
  if (!transaction || typeof transaction !== "object") {
    throw new Error("Transaction request is missing.");
  }

  const from = transaction.from;

  if (typeof from !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(from)) {
    throw new Error("Transaction sender is invalid.");
  }

  const to = transaction.to;

  if (typeof to !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(to)) {
    throw new Error("Transaction target is invalid.");
  }

  const data = typeof transaction.data === "string" ? transaction.data : "0x";

  if (!/^0x([a-fA-F0-9]{2})*$/.test(data)) {
    throw new Error("Transaction calldata is invalid.");
  }

  const value = normalizeQuantity(transaction.value);

  return {
    from,
    to,
    value,
    data,
  };
}

function normalizeQuantity(value) {
  if (value === undefined || value === null || value === "") {
    return "0";
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error("Transaction value is invalid.");
    }

    return Math.trunc(value).toString();
  }

  if (typeof value !== "string") {
    throw new Error("Transaction value is invalid.");
  }

  if (value.startsWith("0x")) {
    try {
      return BigInt(value).toString();
    } catch {
      throw new Error("Transaction value is not a valid hexadecimal quantity.");
    }
  }

  if (/^\d+$/.test(value)) {
    return value;
  }

  throw new Error("Transaction value must be a decimal or hexadecimal quantity.");
}
