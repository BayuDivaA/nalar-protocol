const BACKEND_URL = "http://localhost:3001";

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(["nalarProtectionEnabled"]);

  if (typeof existing.nalarProtectionEnabled !== "boolean") {
    await chrome.storage.local.set({
      nalarProtectionEnabled: true,
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "NALAR_SECURITY_CHECK") {
    return;
  }

  handleSecurityCheck(message)
    .then((security) => {
      sendResponse({
        ok: true,
        security,
      });
    })
    .catch((error) => {
      console.error("[Nalar Background] Security check failed:", error);

      sendResponse({
        ok: false,
        error: error?.message || "Security check failed.",
      });
    });

  return true;
});

async function handleSecurityCheck(message) {
  const normalized = normalizeSecurityRequest(message);

  console.log("[Nalar Background] Normalized security payload:", normalized);

  const response = await fetch(`${BACKEND_URL}/api/transactions/security-check`, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(normalized),
  });

  const raw = await response.text();

  console.log("[Nalar Background] Backend status:", response.status);

  console.log("[Nalar Background] Backend response:", raw);

  if (!response.ok) {
    throw new Error(`Security API failed: ${response.status} ${raw}`);
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Backend returned invalid JSON.");
  }
}

/* ---------------------------------- */
/* Request normalization              */
/* ---------------------------------- */

function normalizeSecurityRequest(message) {
  const original = message?.transaction;

  if (!original || typeof original !== "object") {
    throw new Error("[Nalar] Invalid transaction object.");
  }

  const chainId = normalizeChainId(original.chainId ?? message.chainId);

  const from = normalizeAddress(original.from);

  const to = normalizeAddress(original.to);

  const value = normalizeQuantity(original.value);

  const data = normalizeData(original.data);

  const intent = typeof message.intent === "string" ? message.intent.trim() : "";

  if (!intent) {
    throw new Error("[Nalar] Transaction intent is empty.");
  }

  return {
    intent,

    transaction: {
      chainId,

      from,

      to,

      value,

      data,
    },
  };
}

/* ---------------------------------- */
/* Chain ID                            */
/* ---------------------------------- */

function normalizeChainId(value) {
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`[Nalar] Invalid numeric chain ID: ${value}`);
    }

    return value;
  }

  if (typeof value === "string") {
    if (value.startsWith("0x")) {
      const parsed = Number.parseInt(value, 16);

      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`[Nalar] Invalid hex chain ID: ${value}`);
      }

      return parsed;
    }

    if (/^\d+$/.test(value)) {
      const parsed = Number(value);

      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`[Nalar] Invalid decimal chain ID: ${value}`);
      }

      return parsed;
    }
  }

  throw new Error(`[Nalar] Unsupported chain ID: ${String(value)}`);
}

/* ---------------------------------- */
/* Address                            */
/* ---------------------------------- */

function normalizeAddress(value) {
  if (typeof value !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`[Nalar] Invalid address: ${String(value)}`);
  }

  return value;
}

/* ---------------------------------- */
/* Transaction value                  */
/* ---------------------------------- */

function normalizeQuantity(value) {
  if (value === undefined || value === null || value === "") {
    return "0";
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`[Nalar] Invalid transaction value: ${value}`);
    }

    return Math.trunc(value).toString();
  }

  if (typeof value !== "string") {
    throw new Error(`[Nalar] Invalid transaction value: ${String(value)}`);
  }

  if (value.startsWith("0x")) {
    try {
      return BigInt(value).toString();
    } catch {
      throw new Error(`[Nalar] Invalid hexadecimal transaction value: ${value}`);
    }
  }

  if (/^\d+$/.test(value)) {
    return value;
  }

  throw new Error(`[Nalar] Unsupported transaction value: ${value}`);
}

/* ---------------------------------- */
/* Calldata                           */
/* ---------------------------------- */

function normalizeData(value) {
  if (value === undefined || value === null || value === "") {
    return "0x";
  }

  if (typeof value !== "string") {
    throw new Error("[Nalar] Transaction data must be a string.");
  }

  if (!/^0x([a-fA-F0-9]{2})*$/.test(value)) {
    throw new Error(`[Nalar] Invalid transaction data: ${value}`);
  }

  return value;
}
