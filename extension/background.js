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

  if (message?.type === "GET_NETWORK") {
    chrome.storage.local.get(["selectedNetwork"])
      .then(({ selectedNetwork }) => sendResponse({ chainId: selectedNetwork === undefined ? 97 : (Number.isInteger(selectedNetwork) ? NALAR_CONFIG.SUPPORTED_CHAINS[selectedNetwork]?.chainId ?? null : null) }))
      .catch(() => sendResponse({ chainId: null, error: "NETWORK_UNAVAILABLE" }));
    return true;
  }

  if (message?.type === "SET_NETWORK") {
    const chainId = parseNumericChainId(message.chainId);
    if (!NALAR_CONFIG.SUPPORTED_CHAINS[chainId]) {
      sendResponse({ ok: false, error: "NETWORK_NOT_SUPPORTED" });
      return false;
    }
    chrome.storage.local.set({ selectedNetwork: chainId })
      .then(() => sendResponse({ ok: true, chainId }))
      .catch(() => sendResponse({ ok: false, error: "NETWORK_UNAVAILABLE" }));
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
          errorCode: null,
          receivedChainId: null,
        });
      })
      .catch((error) => {
        console.error("[Nalar] Security check failed:", error);

        const isNetworkError =
          error?.code === "NETWORK_NOT_SUPPORTED" || error?.code === "UNSUPPORTED_CHAIN" || (typeof error?.message === "string" && (error.message.includes("BNB Testnet only") || error.message.includes("UNSUPPORTED_CHAIN")));

        sendResponse({
          security: null,
          error: error instanceof Error ? error.message : "Security check failed.",
          errorCode: isNetworkError ? "NETWORK_NOT_SUPPORTED" : (error?.code ?? null),
          receivedChainId: error?.receivedChainId ?? null,
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

function parseNumericChainId(chainId) {
  if (typeof chainId === "number" && Number.isFinite(chainId)) {
    return chainId;
  }
  if (typeof chainId === "string") {
    const trimmed = chainId.trim();
    if (/^0x[0-9a-fA-F]+$/i.test(trimmed)) {
      return Number.parseInt(trimmed, 16);
    }
    if (/^[0-9]+$/.test(trimmed)) {
      return Number.parseInt(trimmed, 10);
    }
  }
  return null;
}

async function handleSecurityCheck(transaction, chainId, origin) {
  const numericChainId = parseNumericChainId(chainId);

  if (numericChainId === null) {
    const err = new Error("Invalid wallet chain ID.");
    err.code = "NETWORK_UNAVAILABLE";
    throw err;
  }

  if (transaction?.chainId != null && parseNumericChainId(transaction.chainId) !== numericChainId) {
    const err = new Error("Transaction chain does not match wallet chain.");
    err.code = "NETWORK_MISMATCH";
    throw err;
  }

  if (!NALAR_CONFIG.SUPPORTED_CHAINS[numericChainId]) {
    const err = new Error(`Nalar does not support chain ${numericChainId}.`);
    err.code = "NETWORK_NOT_SUPPORTED";
    err.receivedChainId = numericChainId;
    throw err;
  }

  const { selectedNetwork } = await chrome.storage.local.get(["selectedNetwork"]);
  if (selectedNetwork !== undefined && (!Number.isInteger(selectedNetwork) || !NALAR_CONFIG.SUPPORTED_CHAINS[selectedNetwork])) {
    const err = new Error("Selected NALAR network is invalid.");
    err.code = "NETWORK_UNAVAILABLE";
    throw err;
  }
  if ((selectedNetwork === undefined ? 97 : selectedNetwork) !== numericChainId) {
    const err = new Error("Wallet network does not match the selected NALAR network.");
    err.code = "NETWORK_MISMATCH";
    err.receivedChainId = numericChainId;
    throw err;
  }

  if (typeof origin !== "string" || !origin) {
    throw new Error("Transaction origin is missing.");
  }

  const intent = await getIntent(origin);

  if (!intent) {
    throw new Error("No transaction intent is set for this website.");
  }

  const normalized = normalizeTransaction(transaction);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;
  let responseText;
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
    responseText = await response.text();
  } catch (error) {
    if (error && (error.name === "AbortError" || error.code === 20)) {
      const err = new Error("Security analysis timed out. The blockchain investigation took longer than expected.");
      err.code = "ANALYSIS_TIMEOUT";
      throw err;
    }
    console.error("[Nalar] Security check network error:", error);
    const err = new Error("Security service is unavailable. Please check your network connection.");
    err.code = "ANALYSIS_UNAVAILABLE";
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    if (response.status === 503) {
      let code = "ANALYSIS_UNAVAILABLE";
      try {
        const body = JSON.parse(responseText);
        if (body.error === "NETWORK_CONNECTION_FAILED") code = body.error;
      } catch {}
      const err = new Error(code === "NETWORK_CONNECTION_FAILED" ? "Unable to connect to the selected BNB network." : "Security analysis is unavailable.");
      err.code = code;
      throw err;
    }
    if (response.status === 400) {
      try {
        const errJson = JSON.parse(responseText);
        if (errJson.error === "UNSUPPORTED_CHAIN" || String(errJson.error).includes("BNB Testnet only")) {
          const err = new Error(`Nalar currently supports BNB Testnet only. Received chain ${errJson.receivedChainId ?? numericChainId}.`);
          err.code = "NETWORK_NOT_SUPPORTED";
          err.receivedChainId = errJson.receivedChainId ?? numericChainId;
          throw err;
        }
      } catch (parseErr) {
        if (parseErr.code === "NETWORK_NOT_SUPPORTED") {
          throw parseErr;
        }
      }
    }
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

  if (parsed.ok !== true || !["ALLOW", "REVIEW", "BLOCK"].includes(parsed.decision) ||
      !Number.isFinite(parsed.riskScore) || parsed.riskScore < 0 || parsed.riskScore > 100 ||
      typeof parsed.simulation?.success !== "boolean" || typeof parsed.intentMatch !== "boolean" ||
      parsed.comparison?.matches !== parsed.intentMatch ||
      (!["MATCH", "MISMATCH", "UNCERTAIN"].includes(parsed.comparison?.overall) &&
        !(parsed.decision === "BLOCK" && !parsed.simulation.success && parsed.comparison?.overall === undefined)) ||
      typeof parsed.explanation?.summary !== "string" || !parsed.explanation.summary.trim() ||
      parsed.bnbIntelligence?.available === false ||
      (parsed.decision === "ALLOW" && (!parsed.simulation.success || !parsed.intentMatch || parsed.comparison.overall !== "MATCH"))) {
    const err = new Error("Security analysis returned incomplete or inconsistent data.");
    err.code = "ANALYSIS_UNAVAILABLE";
    throw err;
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
