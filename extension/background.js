try {
  importScripts("config.js");
} catch (e) {
  console.warn("[Nalar] Failed to load config.js, using defaults:", e);
}

const BACKEND_URL = typeof NALAR_CONFIG !== "undefined" && NALAR_CONFIG.BACKEND_URL ? NALAR_CONFIG.BACKEND_URL : "https://nalar-protocol.vercel.app";

const TIMEOUT_MS = typeof NALAR_CONFIG !== "undefined" && NALAR_CONFIG.TIMEOUT_MS ? NALAR_CONFIG.TIMEOUT_MS : 30000;

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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${BACKEND_URL}/api/transactions/security-check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
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
  } catch (error) {
    clearTimeout(timeoutId);
    if (error && (error.name === "AbortError" || error.code === 20)) {
      throw new Error("Security analysis timed out. The blockchain investigation took longer than expected.");
    }
    console.error("[Nalar] Security check network error:", error);
    throw new Error("Security service is unavailable. Please check your network connection.");
  } finally {
    clearTimeout(timeoutId);
  }

  const responseText = await response.text();

  console.log("[Nalar] Backend response:", response.status, responseText);

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("Access to security service was unauthorized.");
    }
    if (response.status === 429) {
      throw new Error("Security service rate limit exceeded. Please try again shortly.");
    }
    if (response.status >= 500) {
      throw new Error("Security analysis could not be completed by the server.");
    }
    throw new Error(`Security service returned HTTP ${response.status}.`);
  }

  let parsed;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    throw new Error("Security service returned an invalid response.");
  }

  if (!parsed || parsed.ok === false) {
    throw new Error(parsed?.error ?? "Security analysis could not be completed.");
  }

  return parsed;
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
