export function removeElement(id) {
  const element = document.getElementById(id);

  if (element) {
    element.remove();
  }
}

export function formatAddress(address) {
  if (!address || typeof address !== "string") {
    return "Unknown";
  }

  if (address.length <= 14) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function humanizeAction(action) {
  if (!action) {
    return "UNKNOWN";
  }

  return String(action)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function dedupe(values) {
  return [...new Set(values.filter(Boolean))];
}

export function safeNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

export function humanizeStateCode(code) {
  if (!code || typeof code !== "string") {
    return "State";
  }

  return code
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatReason(reason) {
  if (!reason || typeof reason !== "string") {
    return "";
  }

  const trimmed = reason.trim();

  // Common enum dictionary to crisp editorial security statements
  const enumMap = {
    EXCESSIVE_SELL_TAX: "Excessive sell tax detected in contract parameters.",
    EXCESSIVE_BUY_TAX: "Excessive buy tax detected in contract parameters.",
    HONEYPOT_DETECTED: "Token exhibits honeypot transfer restrictions.",
    SIMULATION_REVERTED: "Transaction execution simulation reverted on-chain.",
    UNVERIFIED_CONTRACT: "Contract source code is unverified.",
    HIGH_RISK_RECIPIENT: "Recipient address flagged for suspicious behavior.",
    INTENT_MISMATCH: "Transaction effects do not match your declared intent.",
    DRAINER_DETECTED: "Contract pattern matches known phishing drainer signatures.",
    SUSPICIOUS_APPROVAL: "Unlimited approval granted to an untrusted contract.",
  };

  if (enumMap[trimmed]) {
    return enumMap[trimmed];
  }

  // If all-caps snake case like SOME_ERROR_CODE
  if (/^[A-Z0-9_]+$/.test(trimmed)) {
    const formatted = trimmed
      .replaceAll("_", " ")
      .toLowerCase();
    return formatted.charAt(0).toUpperCase() + formatted.slice(1) + ".";
  }

  return trimmed;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
