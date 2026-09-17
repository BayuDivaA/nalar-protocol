export const IDS = {
  intent: "__nalar_intent_overlay__",
  analysis: "__nalar_analysis_overlay__",
  decision: "__nalar_decision_overlay__",
};

export const UI = {
  /* base dark monochrome surfaces */
  bg0: "#070707",
  bg1: "#0B0B0B",
  bg2: "#101010",
  bg3: "#151515",
  panelBg: "#090909",
  overlayBg: "rgba(0, 0, 0, 0.72)",

  /* borders */
  border: "#242424",
  borderStrong: "#303030",
  borderAccent: "#3A3A3A",
  borderMuted: "#1B1B1B",

  /* text */
  text: "#F5F5F5",
  textSecondary: "#D0D0D0",
  textMuted: "#9A9A9A",
  textDim: "#686868",

  /* semantic state colors (sparingly used for state only) */
  block: "#FF5B5B",
  review: "#EAC45A",
  allow: "#35D58A",

  /* subtle semantic tints */
  blockTint: "rgba(255, 91, 91, 0.08)",
  reviewTint: "rgba(234, 196, 90, 0.08)",
  allowTint: "rgba(53, 213, 138, 0.08)",

  /* typography */
  fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  monoFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
};

export const PROTOCOL = {
  PAGE_SOURCE: "NALAR_PAGE",
  EXTENSION_SOURCE: "NALAR_EXTENSION",

  TX_REQUEST: "TX_REQUEST",
  TX_RESULT: "TX_RESULT",

  GET_PROTECTION_STATUS: "GET_PROTECTION_STATUS",
  PROTECTION_STATUS: "PROTECTION_STATUS",

  GET_INTENT: "GET_INTENT",
  INTENT_RESULT: "INTENT_RESULT",

  SAVE_INTENT: "SAVE_INTENT",
};

export const LIMITS = {
  SECURITY_TIMEOUT: 60_000,
  PROVIDER_RESCAN_INTERVAL: 50,
  PROVIDER_RESCAN_MAX_ATTEMPTS: 200,
  ANALYSIS_STEP_DURATION: 380,
};
