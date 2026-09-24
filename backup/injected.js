(() => {
  "use strict";

  /*
  |--------------------------------------------------------------------------
  | NALAR PROTOCOL / TXSENTRY
  |--------------------------------------------------------------------------
  |
  | DApp
  |   ↓
  | Wallet provider
  |   ↓
  | Nalar interception
  |   ↓
  | Intent
  |   ↓
  | Bridge
  |   ↓
  | Backend
  |   ↓
  | ALLOW / REVIEW / BLOCK
  |   ↓
  | Wallet
  |
  */

  if (window.__NALAR_TXSENTRY_INSTALLED__) {
    return;
  }

  window.__NALAR_TXSENTRY_INSTALLED__ = true;

  let requestId = 0;

  const IDS = {
    intent: "__nalar_intent_overlay__",

    analysis: "__nalar_analysis_overlay__",

    decision: "__nalar_decision_overlay__",

    network: "__nalar_network_overlay__",

    banner: "__nalar_banner__",
  };

  const UI = {
    bg: "#0B132B",
    bgDeep: "#050811",
    surface: "#101A2E",
    raised: "#14213A",
    border: "#1E293B",
    borderStrong: "#334155",
    text: "#FFFFFF",
    soft: "#CBD5E1",
    muted: "#94A3B8",
    dim: "#64748B",
    danger: "#F87171",
    warning: "#FBBF24",
    safe: "#4ADE80",
    accent: "#0066FF",
    accentHover: "#2563EB",
    dangerBg: "rgba(248, 113, 113, 0.08)",
    warningBg: "rgba(251, 191, 36, 0.08)",
    safeBg: "rgba(74, 222, 128, 0.08)",
    accentBg: "#0D1B34",
  };

  const MOTION = {
    instant: 100,
    fast: 150,
    normal: 220,
    enter: 300,
    slow: 400,
    easeOut: "cubic-bezier(.16, 1, .3, 1)",
    easeStandard: "cubic-bezier(.2, 0, 0, 1)",
  };

  function createNalarMarkSvg(size = 12) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 560 560");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add("nalar-brand-mark-svg");
    svg.style.display = "inline-block";
    svg.style.verticalAlign = "middle";
    svg.style.flexShrink = "0";
    svg.innerHTML =
      '<rect fill="#fff" x="75.39" y="208.7" width="95.75" height="201.58"/><path fill="#fff" d="M484.8,209.73V410.59a289.14,289.14,0,0,1-95.91-16.24q-12.28-4.31-24-9.66A291.05,291.05,0,0,1,244.77,283.24a.07.07,0,0,1,0-.06,191.77,191.77,0,0,0-10.9-17.37s0,0,0-.05A194.59,194.59,0,0,0,171.48,209a2.9,2.9,0,0,0-.34-.19V103.88q12.3,4.32,24.07,9.66a290.94,290.94,0,0,1,116,95.47c1.41,2,2.77,3.91,4.11,5.91a187.43,187.43,0,0,0,11,17.5s0,0,0,0a194.47,194.47,0,0,0,62.73,57V209.73Z"/><path fill="#06f" d="M484.8,103.88H389.05v33.38l62.37,62.37H484.8Z"/>';
    return svg;
  }

  function createBrandEyebrow(text) {
    const wrap = document.createElement("div");
    wrap.className = "nalar-brand-eyebrow";
    wrap.appendChild(createNalarMarkSvg(12));
    const label = document.createElement("span");
    label.textContent = text;
    wrap.appendChild(label);
    return wrap;
  }

  const ANALYSIS_STEPS = ["Understanding your request", "Decoding transaction", "Simulating execution", "Checking contract", "Reviewing on-chain evidence", "Evaluating security", "Preparing recommendation"];

  const wrappedProviders = new WeakSet();

  /*
  |--------------------------------------------------------------------------
  | Utilities
  |--------------------------------------------------------------------------
  */

  function removeNalarElement(id) {
    const element = document.getElementById(id);

    if (element) {
      element.remove();
    }
  }

  function dismissNalarElement(id, onRemoved) {
    const element = document.getElementById(id);
    if (!element) {
      if (onRemoved) onRemoved();
      return;
    }
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.remove();
      if (onRemoved) onRemoved();
      return;
    }
    element.classList.add("nalar-closing");
    setTimeout(() => {
      element.remove();
      if (onRemoved) onRemoved();
    }, 180);
  }

  function formatAddress(address) {
    if (typeof address !== "string") {
      return "Unknown";
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return address;
    }

    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  }

  function humanizeAction(action) {
    const labels = {
      TOKEN_APPROVAL: "Token approval",

      NFT_APPROVAL: "NFT approval",

      TOKEN_TRANSFER: "Token transfer",

      TOKEN_TRANSFER_FROM: "Third-party token transfer",

      NFT_TRANSFER: "NFT transfer",

      MINT: "Mint NFT",

      SWAP: "Token swap",

      STAKE: "Stake assets",

      DEPOSIT: "Deposit",

      WITHDRAW: "Withdraw",

      CLAIM: "Claim",

      PAYMENT: "Payment",

      TRANSFER: "Transfer",

      REGISTER: "Register",

      UNKNOWN: "Unknown contract action",
    };

    return labels[action] ?? "Contract transaction";
  }

  const CHAIN_NAMES = {
    1: "Ethereum Mainnet",
    10: "Optimism",
    56: "BNB Smart Chain Mainnet",
    97: "BNB Smart Chain Testnet",
    137: "Polygon Mainnet",
    8453: "Base",
    42161: "Arbitrum One",
    11155111: "Sepolia Testnet",
  };

  function parseNumericChainId(chainId) {
    if (typeof chainId === "number" && Number.isFinite(chainId)) {
      return chainId;
    }
    if (typeof chainId === "string") {
      const trimmed = chainId.trim();
      if (/^0x[0-9a-fA-F]+$/i.test(trimmed)) {
        return Number.parseInt(trimmed, 16);
      }
      const dec = Number.parseInt(trimmed, 10);
      if (Number.isFinite(dec)) {
        return dec;
      }
    }
    return null;
  }

  function normalizeChainIdHex(chainId) {
    const num = parseNumericChainId(chainId);
    return num !== null ? `0x${num.toString(16)}` : null;
  }

  function getChainName(chainId) {
    if (chainId === null || chainId === undefined) {
      return "Unknown Network";
    }
    const numeric = typeof chainId === "number" ? chainId : parseNumericChainId(chainId);
    if (numeric !== null && CHAIN_NAMES[numeric]) {
      return CHAIN_NAMES[numeric];
    }
    return numeric ? `Chain ID ${numeric}` : "Unknown Network";
  }

  function dedupe(values) {
    return [
      ...new Set(
        values
          .filter((value) => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ];
  }

  function riskColor(level) {
    switch (String(level).toUpperCase()) {
      case "CRITICAL":
      case "HIGH":
        return UI.danger;

      case "MEDIUM":
        return UI.warning;

      default:
        return UI.safe;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Global style
  |--------------------------------------------------------------------------
  */

  function installStyles() {
    if (document.getElementById("__nalar_styles__")) {
      return;
    }

    const style = document.createElement("style");

    style.id = "__nalar_styles__";

    style.textContent = `
      @keyframes nalarFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes nalarFadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }

      @keyframes nalarModalIn {
        from {
          opacity: 0;
          transform: translateY(12px) scale(.985);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      @keyframes nalarModalOut {
        from {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        to {
          opacity: 0;
          transform: translateY(6px) scale(.99);
        }
      }

      @keyframes nalarFadeRise {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes nalarStepIn {
        from {
          opacity: 0;
          transform: translateX(-6px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }

      @keyframes nalarPulseBlock {
        0% { box-shadow: 0 0 0 0 rgba(248, 113, 113, 0.45); }
        70% { box-shadow: 0 0 0 6px rgba(248, 113, 113, 0); }
        100% { box-shadow: 0 0 0 0 rgba(248, 113, 113, 0); }
      }

      @keyframes nalarPulseReview {
        0% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.45); }
        70% { box-shadow: 0 0 0 6px rgba(251, 191, 36, 0); }
        100% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0); }
      }

      @keyframes nalarPulseAllow {
        0% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.45); }
        70% { box-shadow: 0 0 0 6px rgba(74, 222, 128, 0); }
        100% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0); }
      }

      .nalar-overlay {
        animation: nalarFadeIn 240ms cubic-bezier(.16, 1, .3, 1);
      }

      .nalar-overlay.nalar-closing {
        animation: nalarFadeOut 180ms ease-in forwards !important;
      }

      .nalar-modal {
        isolation: isolate;
        animation: nalarModalIn 300ms cubic-bezier(.16, 1, .3, 1);
      }

      .nalar-overlay.nalar-closing .nalar-modal {
        animation: nalarModalOut 180ms ease-in forwards !important;
      }

      .nalar-modal::before {
        position: absolute;
        inset: 0 0 auto 0;
        height: 1px;
        content: "";
        background: linear-gradient(90deg, transparent, rgba(255,255,255,.22), transparent);
        pointer-events: none;
      }

      .nalar-decision-overlay[data-decision="block"] .nalar-modal::before {
        background: linear-gradient(90deg, transparent, ${UI.danger}, transparent) !important;
      }
      .nalar-decision-overlay[data-decision="review"] .nalar-modal::before {
        background: linear-gradient(90deg, transparent, ${UI.warning}, transparent) !important;
      }
      .nalar-decision-overlay[data-decision="allow"] .nalar-modal::before {
        background: linear-gradient(90deg, transparent, ${UI.safe}, transparent) !important;
      }

      .nalar-stagger-1 { animation: nalarFadeRise 240ms cubic-bezier(.16,1,.3,1) 0ms both !important; }
      .nalar-stagger-2 { animation: nalarFadeRise 240ms cubic-bezier(.16,1,.3,1) 70ms both !important; }
      .nalar-stagger-3 { animation: nalarFadeRise 240ms cubic-bezier(.16,1,.3,1) 130ms both !important; }
      .nalar-stagger-4 { animation: nalarFadeRise 240ms cubic-bezier(.16,1,.3,1) 190ms both !important; }
      .nalar-stagger-5 { animation: nalarFadeRise 240ms cubic-bezier(.16,1,.3,1) 250ms both !important; }
      .nalar-stagger-6 { animation: nalarFadeRise 240ms cubic-bezier(.16,1,.3,1) 310ms both !important; }

      .nalar-button {
        transition:
          background-color 150ms ease,
          border-color 150ms ease,
          transform 120ms ease,
          box-shadow 150ms ease;
      }

      .nalar-button:hover {
        border-color: ${UI.accent} !important;
      }

      .nalar-button:active {
        transform: scale(0.98);
      }

      .nalar-button:focus-visible {
        outline: 2px solid ${UI.accent};
        outline-offset: 2px;
      }

      @media (prefers-reduced-motion: reduce) {
        .nalar-overlay,
        .nalar-modal,
        .nalar-stagger-1,
        .nalar-stagger-2,
        .nalar-stagger-3,
        .nalar-stagger-4,
        .nalar-stagger-5,
        .nalar-stagger-6 {
          animation: none !important;
        }

        .nalar-button {
          transition: none !important;
        }

        .nalar-modal::before {
          animation: none !important;
        }
      }
    `;

    document.documentElement.appendChild(style);
  }

  /*
  |--------------------------------------------------------------------------
  | Provider interception
  |--------------------------------------------------------------------------
  */

  function wrapProvider(provider, label) {
    if (!provider || typeof provider.request !== "function") {
      return false;
    }

    if (wrappedProviders.has(provider)) {
      return true;
    }

    const originalRequest = provider.request.bind(provider);

    const wrappedRequest = async function (args) {
      console.info("[Nalar] PROVIDER REQUEST:", label, args?.method);

      if (args?.method !== "eth_sendTransaction") {
        return originalRequest(args);
      }

      return handleTransactionRequest({
        originalRequest,
        provider,
        args,
        providerLabel: label,
      });
    };

    try {
      provider.request = wrappedRequest;
    } catch (error) {
      console.warn("[Nalar] Unable to wrap provider:", label, error);

      return false;
    }

    if (provider.request !== wrappedRequest) {
      console.warn("[Nalar] Provider request could not be replaced:", label);

      return false;
    }

    wrappedProviders.add(provider);

    console.info("[Nalar] Provider wrapped:", label);

    return true;
  }

  function installEip6963() {
    window.addEventListener("eip6963:announceProvider", (event) => {
      const provider = event?.detail?.provider;

      if (!provider) {
        return;
      }

      const name = event?.detail?.info?.name ?? event?.detail?.info?.rdns ?? "EIP-6963 provider";

      wrapProvider(provider, `EIP-6963:${name}`);
    });

    window.dispatchEvent(new Event("eip6963:requestProvider"));
  }

  function installDirectProviders() {
    wrapProvider(window.ethereum, "window.ethereum");

    wrapProvider(window.rabby, "window.rabby");
  }

  /*
  |--------------------------------------------------------------------------
  | Bridge requests
  |--------------------------------------------------------------------------
  */

  function requestBridge(type, payload = {}, timeoutMs = 5000) {
    const id = `nalar-${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    return new Promise((resolve, reject) => {
      let done = false;

      const timer = setTimeout(() => {
        if (done) {
          return;
        }

        done = true;

        window.removeEventListener("message", onMessage);

        reject(new Error(`Nalar bridge request timed out: ${type}`));
      }, timeoutMs);

      function cleanup() {
        clearTimeout(timer);

        window.removeEventListener("message", onMessage);
      }

      function onMessage(event) {
        if (done || event.source !== window) {
          return;
        }

        const message = event.data;

        if (!message || message.source !== "NALAR_EXTENSION") {
          return;
        }

        if (message.id !== id) {
          return;
        }

        done = true;
        cleanup();

        resolve(message);
      }

      window.addEventListener("message", onMessage);

      window.postMessage(
        {
          source: "NALAR_PAGE",

          type,

          id,

          ...payload,
        },
        "*",
      );
    });
  }

  async function getProtectionStatus() {
    const result = await requestBridge("GET_PROTECTION_STATUS");

    if (result.error) {
      throw new Error(result.error);
    }

    return result.enabled === true;
  }

  async function getStoredIntent() {
    const result = await requestBridge("GET_INTENT");

    return typeof result.intent === "string" ? result.intent : "";
  }

  async function saveIntent(intent) {
    const result = await requestBridge("SET_INTENT", {
      intent,
    });

    if (result.ok !== true) {
      throw new Error(result.error ?? "Unable to save intent.");
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Transaction flow
  |--------------------------------------------------------------------------
  */

  async function handleTransactionRequest({ originalRequest, provider, args, providerLabel }) {
    console.info("[Nalar] Intercepting transaction:", providerLabel);

    const protectionEnabled = await getProtectionStatus();

    console.info("[Nalar] Protection status:", {
      provider: providerLabel,
      enabled: protectionEnabled,
    });

    /*
     * Protection disabled
     */

    if (!protectionEnabled) {
      return originalRequest(args);
    }

    /*
     * Validate transaction
     */

    const transaction = args?.params?.[0];

    if (!transaction) {
      throw new Error("[Nalar] Missing transaction request.");
    }

    if (!transaction.to) {
      throw new Error("[Nalar] Transaction target is missing.");
    }

    /*
     * Resolve current chain before asking for intent or security check.
     */
    let rawChainId = null;
    try {
      rawChainId = await originalRequest({
        method: "eth_chainId",
      });
    } catch (err) {
      console.warn("[Nalar] Could not query eth_chainId:", err);
    }

    if (rawChainId === null || rawChainId === undefined) {
      rawChainId = transaction.chainId;
    }

    let numericChainId = parseNumericChainId(rawChainId);

    const explicitTxChainId = parseNumericChainId(transaction.chainId);
    if (explicitTxChainId !== null && explicitTxChainId !== 97) {
      numericChainId = explicitTxChainId;
    }

    if (numericChainId !== 97) {
      console.warn("[Nalar] Unsupported network detected before security check:", {
        chainId: numericChainId,
        rawChainId,
        provider: providerLabel,
      });

      return new Promise((resolve, reject) => {
        let overlayHandle = null;
        let chainChangedHandler = null;

        function cleanup() {
          if (overlayHandle) {
            overlayHandle.remove();
            overlayHandle = null;
          }
          if (chainChangedHandler && provider && typeof provider.removeListener === "function") {
            try {
              provider.removeListener("chainChanged", chainChangedHandler);
            } catch {}
            chainChangedHandler = null;
          }
        }

        async function doSwitch() {
          try {
            await originalRequest({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: "0x61" }],
            });

            if (transaction.chainId !== undefined && transaction.chainId !== null) {
              transaction.chainId = typeof transaction.chainId === "number" ? 97 : "0x61";
            }

            cleanup();

            resolve(
              handleTransactionRequest({
                originalRequest,
                provider,
                args,
                providerLabel,
              }),
            );
          } catch (switchError) {
            console.warn("[Nalar] wallet_switchEthereumChain failed or rejected:", switchError);
            throw switchError;
          }
        }

        function doCancel() {
          cleanup();
          reject(new Error("[Nalar] Transaction cancelled: network not supported."));
        }

        if (provider && typeof provider.on === "function") {
          chainChangedHandler = (newChainIdHex) => {
            const switched = parseNumericChainId(newChainIdHex);
            if (switched === 97) {
              if (transaction.chainId !== undefined && transaction.chainId !== null) {
                transaction.chainId = typeof transaction.chainId === "number" ? 97 : "0x61";
              }
              cleanup();
              resolve(
                handleTransactionRequest({
                  originalRequest,
                  provider,
                  args,
                  providerLabel,
                }),
              );
            }
          };
          try {
            provider.on("chainChanged", chainChangedHandler);
          } catch {}
        }

        overlayHandle = showNetworkNotSupportedOverlay({
          currentChainId: numericChainId,
          onSwitch: doSwitch,
          onCancel: doCancel,
        });
      });
    }

    const chainIdHex = normalizeChainIdHex(rawChainId) ?? "0x61";

    /*
     * Get previously stored intent
     */

    const existingIntent = await getStoredIntent();

    /*
     * Ask user for intent
     */

    const confirmedIntent = await showIntentOverlay(existingIntent);

    if (typeof confirmedIntent !== "string" || !confirmedIntent.trim()) {
      throw new Error("[Nalar] Transaction cancelled.");
    }

    const intent = confirmedIntent.trim();

    /*
     * Persist intent
     */

    try {
      await saveIntent(intent);
    } catch (error) {
      console.warn("[Nalar] Could not persist intent:", error);
    }

    /*
     * Security request ID
     */

    const id = ++requestId;

    /*
     * Loading UI
     */

    const analysis = showAnalysisOverlay();

    /*
     * Security promise
     */

    return new Promise((resolve, reject) => {
      let settled = false;

      /*
       * This timeout only protects
       * the BACKEND ANALYSIS phase.
       *
       * Once a security result has arrived,
       * this timeout must be cleared.
       */

      const analysisTimeout = setTimeout(() => {
        if (settled) {
          return;
        }

        settled = true;

        cleanupSecurityWait();

        reject(new Error("[Nalar] Security check timed out."));
      }, 60_000);

      /*
       * Remove backend wait listener
       * and analysis loader.
       *
       * IMPORTANT:
       * This does NOT close the decision UI.
       */

      function cleanupSecurityWait() {
        clearTimeout(analysisTimeout);

        window.removeEventListener("message", onSecurityResult);

        analysis?.remove();
      }

      /*
       * Continue to actual wallet.
       */

      async function continueToWallet() {
        if (settled) {
          return;
        }

        settled = true;

        console.info("[Nalar] Forwarding transaction to wallet.");

        try {
          const result = await originalRequest(args);

          resolve(result);
        } catch (error) {
          reject(error);
        }
      }

      /*
       * Cancel transaction.
       */

      function cancelTransaction(message) {
        if (settled) {
          return;
        }

        settled = true;

        reject(new Error(message ?? "[Nalar] Transaction cancelled."));
      }

      /*
       * Security result
       */

      function onSecurityResult(event) {
        if (event.source !== window) {
          return;
        }

        const message = event.data;

        if (!message || message.source !== "NALAR_EXTENSION") {
          return;
        }

        if (message.type !== "TX_RESULT") {
          return;
        }

        if (message.id !== id) {
          return;
        }

        console.info("[Nalar] Security result received:", securitySummary(message.security));

        /*
         * CRITICAL FIX:
         *
         * Backend already answered.
         * Stop the analysis timer now.
         *
         * Do NOT wait another 60 seconds.
         */

        cleanupSecurityWait();

        /*
         * Check for Network Not Supported error fallback
         */
        const isNetworkNotSupported =
          message.errorCode === "NETWORK_NOT_SUPPORTED" || message.errorCode === "UNSUPPORTED_CHAIN" || (typeof message.error === "string" && (message.error.includes("BNB Testnet only") || message.error.includes("UNSUPPORTED_CHAIN")));

        if (isNetworkNotSupported) {
          console.warn("[Nalar] Backend reported unsupported network:", message);

          const reportedChainId = parseNumericChainId(message.receivedChainId) ?? parseNumericChainId(chainIdHex) ?? numericChainId ?? 1;

          showNetworkNotSupportedOverlay({
            currentChainId: reportedChainId,
            onSwitch: async () => {
              try {
                await originalRequest({
                  method: "wallet_switchEthereumChain",
                  params: [{ chainId: "0x61" }],
                });
                removeNalarElement(IDS.network);
                resolve(
                  handleTransactionRequest({
                    originalRequest,
                    provider,
                    args,
                    providerLabel,
                  }),
                );
              } catch (switchErr) {
                console.warn("[Nalar] Failed switch from fallback overlay:", switchErr);
                throw switchErr;
              }
            },
            onCancel: () => {
              cancelTransaction("[Nalar] Transaction cancelled: network not supported.");
            },
          });
          return;
        }

        /*
         * Missing result
         */

        if (!message.security) {
          cancelTransaction(message.error ?? "[Nalar] Security response was missing.");

          return;
        }

        const security = message.security;

        /*
         * BLOCK
         *
         * Keep Promise pending until
         * user closes the decision UI.
         *
         * Never forward to wallet.
         */

        if (security.decision === "BLOCK") {
          showDecisionOverlay(security, "BLOCK", null, () => {
            cancelTransaction("[Nalar] Transaction blocked by security policy.");
          });

          return;
        }

        /*
         * REVIEW
         */

        if (security.decision === "REVIEW") {
          showDecisionOverlay(security, "REVIEW", continueToWallet, () => {
            cancelTransaction("[Nalar] Transaction cancelled during review.");
          });

          return;
        }

        /*
         * ALLOW
         */

        showDecisionOverlay(security, "ALLOW", continueToWallet, () => {
          cancelTransaction("[Nalar] Transaction cancelled by user.");
        });
      }

      /*
       * Listen BEFORE sending request.
       */

      window.addEventListener("message", onSecurityResult);

      /*
       * Send transaction to bridge.
       */

      console.info("[Nalar] Sending security request:", {
        id,
        chainId: chainIdHex,
        transaction,
      });

      window.postMessage(
        {
          source: "NALAR_PAGE",

          type: "TX_REQUEST",

          id,

          chainId: chainIdHex,

          transaction,

          intent,
        },
        "*",
      );
    });
  }

  function securitySummary(security) {
    if (!security) {
      return {
        decision: null,
        riskLevel: null,
        riskScore: null,
      };
    }

    return {
      decision: security.decision ?? null,

      riskLevel: security.riskLevel ?? null,

      riskScore: security.riskScore ?? null,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Intent overlay
  |--------------------------------------------------------------------------
  */

  function showIntentOverlay(existingIntent = "") {
    return new Promise((resolve) => {
      removeNalarElement(IDS.intent);

      installStyles();

      const overlay = document.createElement("div");

      overlay.id = IDS.intent;

      overlay.className = "nalar-overlay";

      applyOverlayStyle(overlay);

      const modal = createModal();

      const header = document.createElement("div");

      header.style.padding = "24px 26px 20px";
      header.style.borderBottom = `1px solid ${UI.border}`;

      const eyebrow = createBrandEyebrow("NALAR PROTOCOL");

      const title = document.createElement("h2");

      title.textContent = "What are you trying to do?";

      Object.assign(title.style, {
        margin: "10px 0 0",

        fontSize: "25px",

        lineHeight: "1.08",

        letterSpacing: "-.035em",

        color: UI.text,
      });

      const description = document.createElement("p");

      description.textContent = "Describe what you expect this transaction to do.";

      Object.assign(description.style, {
        margin: "10px 0 0",

        fontSize: "13px",

        lineHeight: "1.6",

        color: UI.soft,

        maxWidth: "420px",
      });

      header.appendChild(eyebrow);

      header.appendChild(title);

      header.appendChild(description);

      const body = document.createElement("div");

      Object.assign(body.style, {
        padding: "22px 28px 20px",
      });

      const siteLabel = createLabel("REQUEST FROM");

      const site = document.createElement("div");

      site.textContent = window.location.hostname || "Current website";

      Object.assign(site.style, {
        marginTop: "8px",

        padding: "11px 12px",

        border: `1px solid ${UI.border}`,

        borderRadius: "9px",

        background: UI.surface,

        color: UI.soft,

        fontSize: "12px",

        overflow: "hidden",

        whiteSpace: "nowrap",

        textOverflow: "ellipsis",
      });

      body.appendChild(siteLabel);

      body.appendChild(site);

      const intentLabel = createLabel("YOUR INTENT");

      intentLabel.style.marginTop = "22px";

      const textarea = document.createElement("textarea");

      textarea.value = typeof existingIntent === "string" ? existingIntent : "";

      textarea.placeholder = "Example: Swap 0.001 tBNB to NDEMO";

      textarea.className = "nalar-intent-textarea";

      Object.assign(textarea.style, {
        display: "block",
        width: "100%",
        minHeight: "128px",
        marginTop: "8px",
        resize: "vertical",
        padding: "14px",
        border: `1px solid ${UI.borderStrong}`,
        borderRadius: "8px",
        outline: "none",
        background: UI.surface,
        color: UI.text,
        fontSize: "13px",
        lineHeight: "1.6",
        fontFamily: "inherit",
      });

      textarea.addEventListener("focus", () => {
        textarea.style.borderColor = "rgba(255,255,255,.26)";
        textarea.style.boxShadow = "0 0 0 3px rgba(255,255,255,.045)";
      });

      textarea.addEventListener("blur", () => {
        textarea.style.borderColor = UI.borderStrong;
        textarea.style.boxShadow = "none";
      });

      body.appendChild(intentLabel);

      body.appendChild(textarea);

      const footer = document.createElement("div");

      Object.assign(footer.style, {
        display: "grid",

        gridTemplateColumns: "120px 1fr",

        gap: "8px",

        padding: "0 28px 26px",
      });

      const cancel = createButton("Cancel", false);

      const analyze = createButton("Analyze transaction", true);

      const close = () => {
        overlay.remove();
        resolve(null);
        dismissNalarElement(IDS.intent, () => resolve(null));
      };

      cancel.onclick = close;

      analyze.onclick = () => {
        const value = textarea.value.trim();

        if (!value) {
          textarea.focus();
          return;
        }

        overlay.remove();

        resolve(value);
        dismissNalarElement(IDS.intent, () => resolve(value));
      };

      footer.appendChild(cancel);

      footer.appendChild(analyze);

      modal.appendChild(header);

      modal.appendChild(body);

      modal.appendChild(footer);

      overlay.appendChild(modal);

      document.documentElement.appendChild(overlay);

      textarea.focus();

      document.addEventListener("keydown", function onKeydown(event) {
        if (!document.getElementById(IDS.intent)) {
          document.removeEventListener("keydown", onKeydown);

          return;
        }

        if (event.key === "Escape") {
          document.removeEventListener("keydown", onKeydown);

          close();
        }

        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
          event.preventDefault();
          analyze.click();
        }
      });
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Network Not Supported Overlay
  |--------------------------------------------------------------------------
  */

  function showNetworkNotSupportedOverlay({ currentChainId, onSwitch, onCancel }) {
    removeNalarElement(IDS.network);
    removeNalarElement(IDS.analysis);
    removeNalarElement(IDS.decision);
    removeNalarElement(IDS.intent);

    installStyles();

    const overlay = document.createElement("div");
    overlay.id = IDS.network;
    overlay.className = "nalar-overlay nalar-network-overlay";
    overlay.setAttribute("data-state", "NETWORK_NOT_SUPPORTED");
    applyOverlayStyle(overlay);

    const modal = createModal();
    modal.classList.add("nalar-network-modal");
    Object.assign(modal.style, {
      width: "min(480px, 100%)",
      overflow: "hidden",
    });

    const header = document.createElement("div");
    header.className = "nalar-network-header";
    Object.assign(header.style, {
      padding: "26px 26px 20px",
      borderBottom: `1px solid ${UI.border}`,
    });

    const eyebrow = createBrandEyebrow("NALAR PROTOCOL · NETWORK CHECK");
    header.appendChild(eyebrow);

    const title = document.createElement("h2");
    title.textContent = "NETWORK NOT SUPPORTED";
    Object.assign(title.style, {
      margin: "10px 0 0",
      fontSize: "20px",
      fontWeight: "700",
      lineHeight: "1.2",
      letterSpacing: "-.02em",
      color: UI.text,
    });
    header.appendChild(title);

    const subtitle = document.createElement("p");
    subtitle.textContent = "Nalar currently analyzes transactions on BNB Smart Chain Testnet.";
    Object.assign(subtitle.style, {
      margin: "8px 0 0",
      fontSize: "13px",
      lineHeight: "1.55",
      color: UI.soft,
    });
    header.appendChild(subtitle);

    modal.appendChild(header);

    const body = document.createElement("div");
    body.className = "nalar-network-body";
    Object.assign(body.style, {
      padding: "20px 26px",
    });

    const grid = document.createElement("div");
    grid.className = "nalar-network-grid";
    Object.assign(grid.style, {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "10px",
    });

    // Current network box
    const currentBox = document.createElement("div");
    currentBox.className = "nalar-network-box";
    currentBox.setAttribute("data-type", "current");
    Object.assign(currentBox.style, {
      padding: "12px 14px",
      borderRadius: "8px",
      border: `1px solid rgba(224,183,109,.35)`,
      background: UI.raised,
    });

    const currentLabel = createLabel("CURRENT NETWORK");
    currentLabel.style.color = UI.warning;
    currentBox.appendChild(currentLabel);

    const currentName = document.createElement("div");
    currentName.textContent = getChainName(currentChainId);
    Object.assign(currentName.style, {
      marginTop: "6px",
      fontSize: "13px",
      fontWeight: "600",
      color: UI.text,
      wordBreak: "break-word",
    });
    currentBox.appendChild(currentName);

    const currentId = document.createElement("div");
    currentId.textContent = currentChainId !== null && currentChainId !== undefined ? `Chain ID ${currentChainId}` : "Chain ID Unknown";
    Object.assign(currentId.style, {
      marginTop: "3px",
      fontSize: "11px",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      color: UI.muted,
    });
    currentBox.appendChild(currentId);

    grid.appendChild(currentBox);

    // Required network box
    const requiredBox = document.createElement("div");
    requiredBox.className = "nalar-network-box";
    requiredBox.setAttribute("data-type", "required");
    Object.assign(requiredBox.style, {
      padding: "12px 14px",
      borderRadius: "8px",
      border: `1px solid rgba(157,187,159,.35)`,
      background: UI.raised,
    });

    const requiredLabel = createLabel("REQUIRED NETWORK");
    requiredLabel.style.color = UI.safe;
    requiredBox.appendChild(requiredLabel);

    const requiredName = document.createElement("div");
    requiredName.textContent = "BNB Smart Chain Testnet";
    Object.assign(requiredName.style, {
      marginTop: "6px",
      fontSize: "13px",
      fontWeight: "600",
      color: UI.text,
    });
    requiredBox.appendChild(requiredName);

    const requiredId = document.createElement("div");
    requiredId.textContent = "Chain ID 97";
    Object.assign(requiredId.style, {
      marginTop: "3px",
      fontSize: "11px",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      color: UI.muted,
    });
    requiredBox.appendChild(requiredId);

    grid.appendChild(requiredBox);

    body.appendChild(grid);

    const messageText = document.createElement("div");
    messageText.textContent = "Switch your wallet to BNB Smart Chain Testnet before continuing.";
    Object.assign(messageText.style, {
      marginTop: "16px",
      fontSize: "12px",
      lineHeight: "1.55",
      color: UI.soft,
    });
    body.appendChild(messageText);

    const statusEl = document.createElement("div");
    statusEl.className = "nalar-network-status";
    Object.assign(statusEl.style, {
      minHeight: "16px",
      marginTop: "8px",
      fontSize: "11px",
      color: UI.warning,
      lineHeight: "1.5",
    });
    body.appendChild(statusEl);

    modal.appendChild(body);

    const footer = document.createElement("div");
    footer.className = "nalar-network-footer";
    Object.assign(footer.style, {
      display: "grid",
      gridTemplateColumns: "110px 1fr",
      gap: "10px",
      padding: "0 26px 24px",
    });

    const cancelBtn = createButton("Cancel", false);
    const switchBtn = createButton("Switch to BNB Testnet", true);

    cancelBtn.onclick = () => {
      overlay.remove();
      if (typeof onCancel === "function") {
        onCancel();
      }
      dismissNalarElement(IDS.network, () => {
        if (typeof onCancel === "function") {
          onCancel();
        }
      });
    };

    switchBtn.onclick = async () => {
      if (typeof onSwitch === "function") {
        switchBtn.disabled = true;
        switchBtn.textContent = "Switching...";
        statusEl.textContent = "Requesting network switch in wallet...";
        try {
          await onSwitch();
        } catch (err) {
          switchBtn.disabled = false;
          switchBtn.textContent = "Switch to BNB Testnet";
          statusEl.textContent = "Open your wallet and switch to BNB Smart Chain Testnet.";
        }
      }
    };

    footer.appendChild(cancelBtn);
    footer.appendChild(switchBtn);

    modal.appendChild(footer);
    overlay.appendChild(modal);
    document.documentElement.appendChild(overlay);

    return {
      overlay,
      setStatus: (msg) => {
        statusEl.textContent = msg;
      },
      remove: (cb) => {
        dismissNalarElement(IDS.network, cb);
      },
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Analysis overlay
  |--------------------------------------------------------------------------
  */

  function showAnalysisOverlay() {
    removeNalarElement(IDS.analysis);

    installStyles();

    const overlay = document.createElement("div");
    overlay.id = IDS.analysis;
    overlay.className = "nalar-overlay";
    applyOverlayStyle(overlay);

    const modal = createModal();
    modal.classList.add("nalar-analysis-modal");
    Object.assign(modal.style, {
      width: "min(460px, 100%)",
      padding: "26px",
    });

    const eyebrow = createBrandEyebrow("NALAR PROTOCOL · SECURITY");

    const title = document.createElement("h2");
    title.textContent = "Analyzing transaction";
    Object.assign(title.style, {
      margin: "10px 0 0",
      fontSize: "20px",
      lineHeight: "1.1",
      letterSpacing: "-.025em",
      color: UI.text,
      fontWeight: "700",
    });

    const subtitle = document.createElement("p");
    subtitle.textContent = "Checking the request before your wallet is asked to sign.";
    Object.assign(subtitle.style, {
      margin: "8px 0 0",
      fontSize: "12.5px",
      lineHeight: "1.55",
      color: UI.soft,
    });

    const counter = document.createElement("div");
    Object.assign(counter.style, {
      marginTop: "18px",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      fontSize: "10px",
      letterSpacing: ".08em",
      color: UI.muted,
      fontWeight: "700",
    });
    counter.textContent = `01 / ${String(ANALYSIS_STEPS.length).padStart(2, "0")}`;

    const list = document.createElement("div");
    list.style.marginTop = "8px";

    const rows = ANALYSIS_STEPS.map((label, index) => {
      const row = document.createElement("div");
      row.className = "nalar-analysis-step";
      row.setAttribute("data-state", index === 0 ? "active" : "pending");
      Object.assign(row.style, {
        display: "grid",
        gridTemplateColumns: "22px 18px 1fr",
        alignItems: "center",
        gap: "8px",
        padding: "9px 0",
        borderBottom: index === ANALYSIS_STEPS.length - 1 ? "none" : `1px solid ${UI.border}`,
        opacity: index === 0 ? "1" : "0.6",
      });

      const num = document.createElement("span");
      num.className = "nalar-step-num";
      num.textContent = String(index + 1).padStart(2, "0");
      num.style.color = index === 0 ? UI.accent : UI.dim;

      const indicator = document.createElement("div");
      indicator.className = "nalar-analysis-indicator";
      Object.assign(indicator.style, {
        width: "18px",
        height: "18px",
        display: "grid",
        placeItems: "center",
        fontSize: "11px",
        fontWeight: "600",
        color: index === 0 ? UI.accent : UI.dim,
      });
      indicator.textContent = index === 0 ? "●" : "○";

      const text = document.createElement("div");
      text.className = "nalar-step-text";
      text.textContent = label;
      text.style.fontSize = "12.5px";
      text.style.color = index === 0 ? UI.text : UI.dim;

      row.appendChild(num);
      row.appendChild(indicator);
      row.appendChild(text);

      list.appendChild(row);

      return { num, indicator, text, row };
    });

    modal.appendChild(eyebrow);
    modal.appendChild(title);
    modal.appendChild(subtitle);
    modal.appendChild(counter);
    modal.appendChild(list);

    overlay.appendChild(modal);
    document.documentElement.appendChild(overlay);

    let current = 0;

    const timer = setInterval(() => {
      if (!document.getElementById(IDS.analysis)) {
        clearInterval(timer);
        return;
      }

      rows.forEach((item, index) => {
        if (index < current) {
          item.indicator.textContent = "✓";
          item.indicator.style.color = UI.safe;
          item.text.style.color = UI.soft;
          item.num.style.color = UI.muted;
          item.row.setAttribute("data-state", "done");
          item.row.style.opacity = "0.75";
        } else if (index === current) {
          item.indicator.textContent = "●";
          item.indicator.style.color = UI.accent;
          item.text.style.color = UI.text;
          item.num.style.color = UI.accent;
          item.row.setAttribute("data-state", "active");
          item.row.style.opacity = "1";
        } else {
          item.indicator.textContent = "○";
          item.indicator.style.color = UI.dim;
          item.text.style.color = UI.dim;
          item.num.style.color = UI.dim;
          item.row.setAttribute("data-state", "pending");
          item.row.style.opacity = "0.45";
        }
      });

      counter.textContent = `${String(current + 1).padStart(2, "0")} / ${String(ANALYSIS_STEPS.length).padStart(2, "0")}`;

      current += 1;

      // hold on last step until backend responds
      if (current >= rows.length) {
        current = rows.length - 1;
      }
    }, 450);

    return {
      remove(callback) {
        clearInterval(timer);
        dismissNalarElement(IDS.analysis, callback);
      },
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Decision overlay
  |--------------------------------------------------------------------------
  */

  function showDecisionOverlay(security, decision, onContinue, onCancel) {
    removeNalarElement(IDS.decision);

    installStyles();

    const overlay = document.createElement("div");

    overlay.id = IDS.decision;

    overlay.className = "nalar-overlay nalar-decision-overlay";

    overlay.setAttribute("data-decision", decision.toLowerCase());

    applyOverlayStyle(overlay);

    const modal = createModal();

    Object.assign(modal.style, {
      width: "min(560px, 100%)",
      maxHeight: "calc(100vh - 32px)",
      display: "flex",
      flexDirection: "column",
    });

    const riskLevel = String(security?.riskLevel ?? "UNKNOWN");

    const riskScore = Number.isFinite(Number(security?.riskScore)) ? Number(security?.riskScore) : 0;

    const status = getDecisionStatus(decision);

    const explanation = security?.explanation ?? {};

    // 1. Decision Header
    const header = createDecisionHeader(decision, status, riskLevel, riskScore);

    // Body scrollable container
    const body = document.createElement("main");

    body.className = "nalar-decision-body";

    Object.assign(body.style, {
      overflowY: "auto",
      padding: "0 26px 20px",
      flex: "1 1 auto",
    });

    // 2. Why Nalar Stopped Card (prominent above fold)
    body.appendChild(createWhyStoppedCard(explanation, security, decision));

    // 3. Intent vs Actual Comparison
    body.appendChild(createIntentVsActualComparison(explanation, security, decision));

    // 4. What This Means For You
    const meansSection = createWhatThisMeansSection(explanation, security, decision);
    if (meansSection) {
      body.appendChild(meansSection);
    }

    // 5. Security Evidence (with context & source badges)
    const evidenceSection = createEvidenceSection(explanation, security);
    if (evidenceSection) {
      body.appendChild(evidenceSection);
    }

    // 6. Technical Details (Collapsible accordion, closed by default)
    body.appendChild(createTechnicalSection(explanation, security));

    // 7. Footer Actions
    const footer = createDecisionFooter(decision, onContinue, onCancel, overlay);

    modal.appendChild(header);

    modal.appendChild(body);

    modal.appendChild(footer);

    overlay.appendChild(modal);

    document.documentElement.appendChild(overlay);

    document.addEventListener("keydown", function onKeydown(event) {
      if (!document.getElementById(IDS.decision)) {
        document.removeEventListener("keydown", onKeydown);
        return;
      }

      if (event.key === "Escape") {
        document.removeEventListener("keydown", onKeydown);
        dismissNalarElement(IDS.decision, () => {
          if (onCancel) {
            onCancel();
          }
        });
      }
    });
  }

  function createDecisionHeader(decision, status, riskLevel, riskScore) {
    const header = document.createElement("header");

    header.className = "nalar-decision-header nalar-stagger-1";

    Object.assign(header.style, {
      display: "grid",
      gridTemplateColumns: "44px 1fr auto",
      gap: "14px",
      alignItems: "center",
      padding: "22px 24px 20px",
      borderBottom: `1px solid ${UI.border}`,
    });

    const mark = document.createElement("div");
    mark.className = "nalar-decision-mark";
    mark.setAttribute("data-decision", decision.toLowerCase());
    mark.textContent = decision === "BLOCK" ? "✕" : decision === "REVIEW" ? "?" : "✓";

    Object.assign(mark.style, {
      width: "44px",
      height: "44px",
      display: "grid",
      placeItems: "center",
      border: `1px solid ${UI.borderStrong}`,
      borderRadius: "8px",
      background: UI.surface,
      color: decision === "BLOCK" ? UI.danger : decision === "REVIEW" ? UI.warning : UI.safe,
      fontSize: "19px",
      fontWeight: "700",
    });

    const headingWrap = document.createElement("div");

    const eyebrow = createBrandEyebrow("NALAR PROTOCOL · SECURITY");

    const heading = document.createElement("h2");
    heading.textContent = status.title;
    Object.assign(heading.style, {
      margin: "4px 0 0",
      fontSize: "19px",
      lineHeight: "1.15",
      letterSpacing: "-.025em",
      color: UI.text,
      fontWeight: "700",
    });

    const subtitle = document.createElement("p");
    subtitle.textContent = status.subtitle;
    Object.assign(subtitle.style, {
      margin: "4px 0 0",
      fontSize: "12px",
      lineHeight: "1.45",
      color: UI.soft,
    });

    headingWrap.appendChild(eyebrow);
    headingWrap.appendChild(heading);
    headingWrap.appendChild(subtitle);

    const riskPill = document.createElement("div");
    riskPill.className = "nalar-risk-pill";
    riskPill.setAttribute("data-level", riskLevel.toLowerCase());
    riskPill.textContent = `Risk ${riskScore} · ${riskLevel}`;

    const pillColor = riskColor(riskLevel);
    Object.assign(riskPill.style, {
      padding: "5px 10px",
      borderRadius: "6px",
      fontSize: "11px",
      fontWeight: "700",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      letterSpacing: ".02em",
      color: pillColor,
      background: decision === "BLOCK" ? UI.dangerBg : decision === "REVIEW" ? UI.warningBg : UI.safeBg,
      border: `1px solid ${pillColor}44`,
      whiteSpace: "nowrap",
    });

    header.appendChild(mark);
    header.appendChild(headingWrap);
    header.appendChild(riskPill);

    return header;
  }

  function getPrimaryRootCause(explanation, security, decision) {
    const isMismatch = security?.intentMatch === false || security?.comparison?.overall === "MISMATCH" || explanation?.comparison?.status === "MISMATCH";
    const comp = security?.comparison || {};

    // 1. Intent mismatch (highest priority)
    if (isMismatch) {
      if (typeof explanation?.whyStopped?.primaryReason === "string" && explanation.whyStopped.primaryReason.trim()) {
        return explanation.whyStopped.primaryReason.trim();
      }
      if (typeof explanation?.comparison?.summary === "string" && explanation.comparison.summary.trim()) {
        return explanation.comparison.summary.trim();
      }
      if (comp?.summary) {
        return comp.summary;
      }

      let userIntent = "complete your transaction";
      if (typeof explanation?.userIntent === "string" && explanation.userIntent.trim()) {
        userIntent = explanation.userIntent.trim();
      } else if (explanation?.userIntent?.description) {
        userIntent = explanation.userIntent.description;
      } else if (security?.intent?.description) {
        userIntent = security.intent.description;
      }

      let actualAction = "perform a different action";
      if (typeof explanation?.actualTransaction === "string" && explanation.actualTransaction.trim()) {
        actualAction = explanation.actualTransaction.trim();
      } else if (explanation?.actualTransaction?.summary) {
        actualAction = explanation.actualTransaction.summary;
      } else if (security?.transactionSummary?.title) {
        actualAction = security.transactionSummary.title;
      } else if (security?.actual?.action) {
        actualAction = humanizeAction(security.actual.action);
      }

      return `You asked to ${userIntent}, but this transaction asks for ${actualAction} instead.`;
    }

    // 2. Critical security finding (e.g. excessive sell tax >= 20%, honeypot, blacklisting)
    const analyses = Array.isArray(security?.scamAnalyses) ? security.scamAnalyses : Array.isArray(security?.transactionScamContext?.analyses) ? security.transactionScamContext.analyses : [];
    for (const a of analyses) {
      const state = Array.isArray(a?.contractPrivileges?.state) ? a.contractPrivileges.state : [];
      const sellTax = state.find((s) => s?.code === "CURRENT_SELL_TAX");
      if (sellTax && Number(sellTax.value) >= 2000) {
        const pct = (Number(sellTax.value) / 100).toFixed(0);
        return `Contract charges an excessive ${pct}% sell tax, preventing you from recovering funds.`;
      }

      const findings = Array.isArray(a?.findings) ? a.findings : [];
      const criticalFinding = findings.find((f) => String(f?.severity).toUpperCase() === "CRITICAL" || String(f?.severity).toUpperCase() === "HIGH");
      if (criticalFinding?.title) {
        return criticalFinding.title;
      }
    }

    // 3. Simulation failure
    if (security?.simulation && security.simulation.success === false) {
      return "Transaction failed during simulation and would revert on-chain.";
    }

    // 4. Policy restriction or primary reason from backend explanation
    if (typeof explanation?.whyStopped?.primaryReason === "string" && explanation.whyStopped.primaryReason.trim()) {
      return explanation.whyStopped.primaryReason.trim();
    }

    if (typeof explanation?.summary === "string" && explanation.summary.trim()) {
      return explanation.summary.trim();
    }

    // 5. Review / insufficient evidence / default
    return getFallbackSummary(security, decision);
  }

  function createWhyStoppedCard(explanation, security, decision) {
    const isBlock = decision === "BLOCK";
    const isReview = decision === "REVIEW";

    const card = document.createElement("section");
    card.className = "nalar-why-stopped-card nalar-stagger-2";

    Object.assign(card.style, {
      marginTop: "14px",
      padding: "14px 18px",
      borderRadius: "8px",
      border: `1px solid ${isBlock ? "rgba(248, 113, 113, 0.28)" : isReview ? "rgba(251, 191, 36, 0.28)" : UI.border}`,
      background: isBlock ? UI.dangerBg : isReview ? UI.warningBg : UI.surface,
      borderLeft: `3px solid ${isBlock ? UI.danger : isReview ? UI.warning : UI.safe}`,
    });

    const labelText = isBlock ? "WHY THIS WAS STOPPED" : isReview ? "WHY REVIEW IS REQUIRED" : "SECURITY ASSESSMENT";
    const sectionLabel = createLabel(labelText);
    sectionLabel.style.color = isBlock ? UI.danger : isReview ? UI.warning : UI.muted;

    card.appendChild(sectionLabel);

    const primaryReasonText = getPrimaryRootCause(explanation, security, decision);

    const reasonEl = document.createElement("div");
    reasonEl.className = "nalar-why-stopped-primary";
    reasonEl.textContent = primaryReasonText;

    Object.assign(reasonEl.style, {
      marginTop: "8px",
      fontSize: "13.5px",
      fontWeight: "500",
      lineHeight: "1.55",
      color: UI.text,
    });

    card.appendChild(reasonEl);

    const impactText = typeof explanation?.whyStopped?.userImpact === "string" && explanation.whyStopped.userImpact.trim() ? explanation.whyStopped.userImpact.trim() : null;

    if (impactText && impactText !== primaryReasonText) {
      const impactEl = document.createElement("div");
      impactEl.className = "nalar-why-stopped-impact";
      impactEl.textContent = impactText;
      Object.assign(impactEl.style, {
        marginTop: "6px",
        fontSize: "12px",
        lineHeight: "1.5",
        color: UI.soft,
      });
      card.appendChild(impactEl);
    }

    return card;
  }

  function createIntentVsActualComparison(explanation, security, decision) {
    const card = document.createElement("section");
    card.className = "nalar-comparison-card nalar-stagger-3";

    Object.assign(card.style, {
      marginTop: "12px",
      padding: "16px 18px",
      border: `1px solid ${UI.border}`,
      borderRadius: "8px",
      background: UI.surface,
    });

    const comp = security?.comparison || {};
    const isMismatch = comp.overall === "MISMATCH" || explanation?.comparison?.status === "MISMATCH" || security?.intentMatch === false;
    const isUncertain = comp.overall === "UNCERTAIN" || explanation?.comparison?.status === "UNKNOWN";
    const isMatch = !isMismatch && !isUncertain && (explanation?.comparison?.status === "MATCH" || security?.intentMatch === true || comp.overall === "MATCH");

    const headerRow = document.createElement("div");
    headerRow.className = "nalar-comparison-header";

    Object.assign(headerRow.style, {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "12px",
    });

    const headerLabel = createLabel("YOUR REQUEST VS ACTUAL");
    headerRow.appendChild(headerLabel);

    let badgeText = "✓ MATCHES";
    let badgeColor = UI.safe;
    let badgeBg = UI.safeBg;
    let badgeBorder = "rgba(74, 222, 128, 0.28)";

    if (isMismatch) {
      badgeText = "✕ DOESN'T MATCH";
      badgeColor = UI.danger;
      badgeBg = UI.dangerBg;
      badgeBorder = "rgba(248, 113, 113, 0.28)";
    } else if (isUncertain) {
      badgeText = "? UNVERIFIED";
      badgeColor = UI.warning;
      badgeBg = UI.warningBg;
      badgeBorder = "rgba(251, 191, 36, 0.28)";
    }

    const matchBadge = document.createElement("div");
    matchBadge.className = "nalar-badge";
    matchBadge.setAttribute("data-match", String(isMatch));
    matchBadge.textContent = badgeText;

    Object.assign(matchBadge.style, {
      padding: "3px 8px",
      borderRadius: "4px",
      fontSize: "9px",
      fontWeight: "750",
      letterSpacing: ".06em",
      color: badgeColor,
      background: badgeBg,
      border: `1px solid ${badgeBorder}`,
    });

    headerRow.appendChild(matchBadge);
    card.appendChild(headerRow);

    const grid = document.createElement("div");
    grid.className = "nalar-comparison-grid";

    Object.assign(grid.style, {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "10px",
    });

    let userIntentText = "Not specified";
    if (typeof explanation?.userIntent === "string" && explanation.userIntent.trim()) {
      userIntentText = explanation.userIntent.trim();
    } else if (explanation?.userIntent?.summary && typeof explanation.userIntent.summary === "string") {
      userIntentText = explanation.userIntent.summary.trim();
    } else if (explanation?.userIntent?.description && typeof explanation.userIntent.description === "string") {
      userIntentText = explanation.userIntent.description.trim();
    } else if (security?.intent?.description) {
      userIntentText = security.intent.description;
    }

    let actualTxText = "Contract call";
    if (typeof explanation?.actualTransaction === "string" && explanation.actualTransaction.trim()) {
      actualTxText = explanation.actualTransaction.trim();
    } else if (explanation?.actualTransaction?.summary && typeof explanation.actualTransaction.summary === "string") {
      actualTxText = explanation.actualTransaction.summary.trim();
    } else if (security?.transactionSummary?.title) {
      actualTxText = security.transactionSummary.title;
    } else if (security?.transactionSummary?.summary) {
      actualTxText = security.transactionSummary.summary;
    } else if (security?.actual?.action) {
      actualTxText = humanizeAction(security.actual.action);
    }

    const intentBox = document.createElement("div");
    intentBox.className = "nalar-comparison-box nalar-comp-expected";
    Object.assign(intentBox.style, {
      padding: "12px 14px",
      border: `1px solid ${UI.border}`,
      borderRadius: "6px",
      background: UI.raised,
    });

    const intentLabel = document.createElement("div");
    intentLabel.className = "nalar-comparison-label";
    intentLabel.textContent = "YOUR REQUEST";
    Object.assign(intentLabel.style, {
      fontSize: "9px",
      fontWeight: "700",
      letterSpacing: ".12em",
      color: UI.muted,
    });

    const intentVal = document.createElement("div");
    intentVal.className = "nalar-comparison-value";
    intentVal.textContent = userIntentText;
    Object.assign(intentVal.style, {
      marginTop: "6px",
      fontSize: "12.5px",
      fontWeight: "600",
      lineHeight: "1.45",
      color: UI.text,
      wordBreak: "break-word",
    });

    intentBox.appendChild(intentLabel);
    intentBox.appendChild(intentVal);
    grid.appendChild(intentBox);

    const actualBox = document.createElement("div");
    actualBox.className = "nalar-comparison-box nalar-comp-actual";
    actualBox.setAttribute("data-mismatch", String(isMismatch));
    Object.assign(actualBox.style, {
      padding: "12px 14px",
      border: `1px solid ${isMismatch ? "rgba(248, 113, 113, 0.32)" : UI.border}`,
      borderRadius: "6px",
      background: isMismatch ? UI.dangerBg : UI.raised,
    });

    const actualLabel = document.createElement("div");
    actualLabel.className = "nalar-comparison-label";
    actualLabel.textContent = "ACTUAL TRANSACTION";
    Object.assign(actualLabel.style, {
      fontSize: "9px",
      fontWeight: "700",
      letterSpacing: ".12em",
      color: isMismatch ? UI.danger : UI.muted,
    });

    const actualVal = document.createElement("div");
    actualVal.className = "nalar-comparison-value";
    actualVal.textContent = actualTxText;
    Object.assign(actualVal.style, {
      marginTop: "6px",
      fontSize: "12.5px",
      fontWeight: "600",
      lineHeight: "1.45",
      color: isMismatch ? UI.danger : UI.text,
      wordBreak: "break-word",
    });

    actualBox.appendChild(actualLabel);
    actualBox.appendChild(actualVal);
    grid.appendChild(actualBox);

    card.appendChild(grid);

    if (isMismatch) {
      const mismatchesList = [];

      if (comp.quantity && comp.quantity.status === "MISMATCH") {
        const itemType = comp.action?.expected === "MINT" || comp.action?.actual === "MINT" ? "NFT quantity" : "Quantity";
        mismatchesList.push(`${itemType}: Expected ${comp.quantity.expected}, Actual ${comp.quantity.actual}`);
      }
      if (comp.amount && comp.amount.status === "MISMATCH") {
        const amountLabel = comp.action?.expected === "MINT" || comp.action?.actual === "MINT" ? "Payment" : "Amount";
        mismatchesList.push(`${amountLabel}: Expected ${comp.amount.expected}, Actual ${comp.amount.actual}`);
      }
      if (comp.outputToken && comp.outputToken.status === "MISMATCH") {
        mismatchesList.push(`Receive token: Expected ${comp.outputToken.expected || "token"}, Actual ${comp.outputToken.actual || "token"}`);
      }
      if (comp.inputToken && comp.inputToken.status === "MISMATCH") {
        mismatchesList.push(`Send token: Expected ${comp.inputToken.expected || "token"}, Actual ${comp.inputToken.actual || "token"}`);
      }
      if (comp.action && comp.action.status === "MISMATCH") {
        mismatchesList.push(`Action: Expected ${humanizeAction(comp.action.expected)}, Actual ${humanizeAction(comp.action.actual)}`);
      }
      if (comp.recipient && comp.recipient.status === "MISMATCH") {
        mismatchesList.push(`Recipient: Expected ${formatAddress(comp.recipient.expected)}, Actual ${formatAddress(comp.recipient.actual)}`);
      }

      if (Array.isArray(comp.mismatches)) {
        comp.mismatches.forEach((m) => {
          if (m && m.toLowerCase().includes("not a smart contract") && !mismatchesList.some((item) => item.toLowerCase().includes("smart contract"))) {
            mismatchesList.push("Target: Destination is not a smart contract");
          }
        });
      }

      if (mismatchesList.length === 0 && Array.isArray(comp.mismatches) && comp.mismatches.length > 0) {
        comp.mismatches.forEach((m) => mismatchesList.push(m));
      }

      if (mismatchesList.length > 0) {
        const diffContainer = document.createElement("div");
        diffContainer.className = "nalar-field-mismatch";
        Object.assign(diffContainer.style, {
          marginTop: "10px",
          padding: "8px 12px",
          borderRadius: "6px",
          border: "1px solid rgba(248, 113, 113, 0.28)",
          background: UI.dangerBg,
        });

        mismatchesList.forEach((diff) => {
          const diffRow = document.createElement("div");
          diffRow.textContent = `✕ ${diff}`;
          Object.assign(diffRow.style, {
            marginTop: "3px",
            fontSize: "11px",
            lineHeight: "1.5",
            color: UI.danger,
            fontWeight: "500",
          });
          diffContainer.appendChild(diffRow);
        });

        card.appendChild(diffContainer);
      }
    }

    return card;
  }

  function createWhatThisMeansSection(explanation, security, decision) {
    const isBlock = decision === "BLOCK";
    const isReview = decision === "REVIEW";
    const isMismatch = security?.intentMatch === false || security?.comparison?.overall === "MISMATCH";

    let text = "";
    if (typeof explanation?.whatThisMeans === "string" && explanation.whatThisMeans.trim().length > 0) {
      text = explanation.whatThisMeans.trim();
    } else if (typeof explanation?.whyStopped?.userImpact === "string" && explanation.whyStopped.userImpact.trim().length > 0) {
      text = explanation.whyStopped.userImpact.trim();
    } else if (isBlock && isMismatch) {
      text = "Signing this request would execute an action different from what you intended, potentially transferring permissions or assets unexpectedly.";
    } else if (isBlock) {
      text = "Signing this transaction could result in irreversible loss of assets or unverified contract execution.";
    } else if (isReview) {
      text = "This transaction interacts with contract functions or addresses that require careful verification before signing.";
    } else {
      text = "This transaction matches your requested parameters and will execute with standard network confirmation.";
    }

    const callout = document.createElement("section");
    callout.className = "nalar-means-callout nalar-stagger-4";
    Object.assign(callout.style, {
      marginTop: "12px",
      padding: "12px 16px",
      border: `1px solid ${UI.border}`,
      borderLeft: `3px solid ${UI.accent}`,
      borderRadius: "8px",
      background: UI.surface,
    });

    const label = document.createElement("div");
    label.className = "nalar-means-label";
    label.textContent = "WHAT THIS MEANS";
    Object.assign(label.style, {
      fontSize: "9px",
      fontWeight: "700",
      letterSpacing: ".12em",
      color: UI.muted,
      marginBottom: "5px",
    });
    callout.appendChild(label);

    const body = document.createElement("div");
    body.className = "nalar-means-text";
    body.textContent = text;
    Object.assign(body.style, {
      fontSize: "12px",
      lineHeight: "1.55",
      color: UI.soft,
    });
    callout.appendChild(body);

    return callout;
  }

  function createEvidenceSection(explanation, security) {
    const evidenceItems = Array.isArray(explanation?.evidence) && explanation.evidence.length > 0 ? explanation.evidence : null;
    const reports = Array.isArray(security?.scamAnalyses) ? security.scamAnalyses : Array.isArray(security?.transactionScamContext?.analyses) ? security.transactionScamContext.analyses : [];

    if (!evidenceItems && !reports.length) {
      return null;
    }

    const count = evidenceItems ? evidenceItems.length : reports.reduce((acc, r) => acc + (Array.isArray(r?.findings) ? r.findings.length : 0), 0);

    const wrapper = document.createElement("details");
    wrapper.className = "nalar-evidence-details nalar-stagger-5";

    Object.assign(wrapper.style, {
      marginTop: "12px",
      padding: "12px 0 0",
      borderTop: `1px solid ${UI.border}`,
    });

    const summary = document.createElement("summary");
    summary.textContent = `Security evidence (${count > 0 ? `${count} items` : "verified"})`;

    Object.assign(summary.style, {
      cursor: "pointer",
      color: UI.muted,
      fontSize: "11px",
      fontWeight: "600",
      userSelect: "none",
      padding: "4px 0",
    });

    wrapper.appendChild(summary);

    const content = document.createElement("div");
    content.className = "nalar-evidence-content";
    Object.assign(content.style, {
      marginTop: "10px",
      padding: "12px 14px",
      borderRadius: "8px",
      border: `1px solid ${UI.border}`,
      background: UI.surface,
    });

    if (evidenceItems) {
      evidenceItems.forEach((item, index) => {
        const row = document.createElement("div");
        Object.assign(row.style, {
          padding: "7px 0",
          borderTop: index > 0 ? `1px solid ${UI.border}` : "none",
        });

        const topLine = document.createElement("div");
        Object.assign(topLine.style, {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "8px",
        });

        const labelEl = document.createElement("span");
        labelEl.textContent = item.label;
        Object.assign(labelEl.style, {
          fontSize: "11px",
          fontWeight: "600",
          color: UI.text,
        });

        const rightSide = document.createElement("div");
        Object.assign(rightSide.style, {
          display: "flex",
          alignItems: "center",
          gap: "6px",
        });

        const valEl = document.createElement("span");
        valEl.textContent = item.value;
        Object.assign(valEl.style, {
          fontSize: "11px",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          color: UI.soft,
        });

        const badge = document.createElement("span");
        badge.className = "nalar-badge-source";
        badge.setAttribute("data-source", item.source);
        badge.textContent = item.source;

        rightSide.appendChild(valEl);
        rightSide.appendChild(badge);
        topLine.appendChild(labelEl);
        topLine.appendChild(rightSide);
        row.appendChild(topLine);

        if (item.explanation) {
          const expEl = document.createElement("div");
          expEl.textContent = item.explanation;
          Object.assign(expEl.style, {
            marginTop: "3px",
            fontSize: "11px",
            lineHeight: "1.5",
            color: UI.muted,
          });
          row.appendChild(expEl);
        }

        content.appendChild(row);
      });
    } else {
      reports.forEach((analysis, rIdx) => {
        const sub = document.createElement("div");
        if (rIdx > 0) {
          sub.style.marginTop = "10px";
          sub.style.paddingTop = "10px";
          sub.style.borderTop = `1px solid ${UI.border}`;
        }

        const head = document.createElement("div");
        Object.assign(head.style, {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "8px",
        });

        const token = document.createElement("div");
        token.textContent = formatAddress(analysis?.token);
        token.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        token.style.fontSize = "11px";
        token.style.color = UI.text;

        const badge = document.createElement("div");
        badge.textContent = `${analysis?.riskLevel ?? "UNKNOWN"} · ${analysis?.riskScore ?? 0}`;
        Object.assign(badge.style, {
          color: riskColor(analysis?.riskLevel),
          fontSize: "10px",
          fontWeight: "700",
        });

        head.appendChild(token);
        head.appendChild(badge);
        sub.appendChild(head);

        const findings = Array.isArray(analysis?.findings) ? analysis.findings : [];
        findings.forEach((finding) => {
          const severity = String(finding?.severity ?? "INFO").toUpperCase();
          const isThreat = severity === "CRITICAL" || severity === "HIGH";
          const fRow = document.createElement("div");
          fRow.className = "nalar-finding";
          fRow.setAttribute("data-severity", severity.toLowerCase());
          Object.assign(fRow.style, {
            padding: "3px 0",
            fontSize: "11px",
            lineHeight: "1.5",
            color: isThreat ? UI.danger : severity === "MEDIUM" ? UI.warning : UI.muted,
          });
          fRow.textContent = `· ${finding?.title ?? finding?.code ?? "Security finding"}`;
          sub.appendChild(fRow);
        });

        const stateEntries = Array.isArray(analysis?.contractPrivileges?.state) ? analysis.contractPrivileges.state : [];
        stateEntries.slice(0, 5).forEach((entry) => {
          const sRow = document.createElement("div");
          Object.assign(sRow.style, {
            display: "flex",
            justifyContent: "space-between",
            padding: "3px 0",
            fontSize: "10px",
          });
          const sLabel = document.createElement("span");
          sLabel.textContent = humanizeEvidenceLabel(entry?.label ?? entry?.code);
          sLabel.style.color = UI.muted;

          const sVal = document.createElement("span");
          let displayVal = entry?.value ?? "Unknown";
          if (entry?.code === "CURRENT_SELL_TAX" && entry?.unit === "PERCENT") {
            const numeric = Number(displayVal);
            if (Number.isFinite(numeric)) {
              displayVal = `${(numeric / 100).toFixed(2)}%`;
            }
          }
          sVal.textContent = String(displayVal);
          sVal.style.color = UI.soft;
          sVal.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

          sRow.appendChild(sLabel);
          sRow.appendChild(sVal);
          sub.appendChild(sRow);
        });

        content.appendChild(sub);
      });
    }

    wrapper.appendChild(content);
    return wrapper;
  }

  function createTechnicalSection(explanation, security) {
    const wrapper = document.createElement("details");

    wrapper.className = "nalar-tech-details nalar-stagger-6";

    Object.assign(wrapper.style, {
      marginTop: "8px",
      padding: "10px 0 14px",
      borderBottom: `1px solid ${UI.border}`,
    });

    const summary = document.createElement("summary");

    summary.textContent = "Technical details";

    Object.assign(summary.style, {
      cursor: "pointer",
      color: UI.muted,
      fontSize: "11px",
      fontWeight: "600",
      userSelect: "none",
      padding: "4px 0",
    });

    wrapper.appendChild(summary);

    const content = document.createElement("div");
    content.className = "nalar-tech-content";

    Object.assign(content.style, {
      marginTop: "8px",
      padding: "10px 12px",
      borderRadius: "8px",
      border: `1px solid ${UI.border}`,
      background: UI.surface,
    });

    const actual = security?.actual ?? {};
    const tx = security?.transactionSummary ?? {};
    const sim = security?.simulation ?? {};

    const rows = [
      ["Network", "BNB Smart Chain Testnet (97)"],
      ["Target contract", tx.target ? formatAddress(tx.target) : security?.transaction?.to ? formatAddress(security.transaction.to) : "N/A"],
      ["Action", humanizeAction(actual.action)],
      ["Function name", actual.functionName ?? "N/A"],
      ["Simulation status", sim.success === true ? "Success" : sim.success === false ? "Reverted / Failed" : "Not simulated"],
      ["Risk score", `${security?.riskScore ?? 0} / 100 (${security?.riskLevel ?? "UNKNOWN"})`],
    ];

    rows.forEach(([label, value]) => {
      const row = document.createElement("div");

      Object.assign(row.style, {
        display: "flex",
        justifyContent: "space-between",
        gap: "12px",
        padding: "3px 0",
      });

      const left = document.createElement("span");
      left.textContent = label;
      left.style.color = UI.muted;
      left.style.fontSize = "10px";

      const right = document.createElement("span");
      right.textContent = String(value);
      right.style.color = UI.soft;
      right.style.fontSize = "10px";
      right.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

      row.appendChild(left);
      row.appendChild(right);
      content.appendChild(row);
    });

    wrapper.appendChild(content);

    return wrapper;
  }

  function createDecisionFooter(decision, onContinue, onCancel, overlay) {
    const isBlock = decision === "BLOCK";

    const footer = document.createElement("footer");

    footer.className = "nalar-decision-footer";

    Object.assign(footer.style, {
      padding: "16px 26px 22px",
      borderTop: `1px solid ${UI.border}`,
      flex: "0 0 auto",
    });

    const note = document.createElement("div");

    note.className = "nalar-decision-note";

    note.textContent = getFooterNote(decision);

    Object.assign(note.style, {
      marginBottom: "12px",
      color: UI.muted,
      fontSize: "11px",
      lineHeight: "1.5",
    });

    const actions = document.createElement("div");

    Object.assign(actions.style, {
      display: "grid",
      gridTemplateColumns: isBlock ? "1fr" : "120px 1fr",
      gap: "8px",
    });

    const cancel = createButton(isBlock ? "Close" : "Cancel", isBlock);

    cancel.onclick = () => {
      dismissNalarElement(IDS.decision, () => {
        if (onCancel) {
          onCancel();
        }
      });
    };

    actions.appendChild(cancel);

    if (!isBlock) {
      const continueButton = createButton(decision === "REVIEW" ? "Review & Continue" : "Continue", true);

      continueButton.onclick = () => {
        dismissNalarElement(IDS.decision, () => {
          if (onContinue) {
            onContinue();
          }
        });
      };

      actions.appendChild(continueButton);
    }

    footer.appendChild(note);

    footer.appendChild(actions);

    return footer;
  }

  /*
  |--------------------------------------------------------------------------
  | UI helpers
  |--------------------------------------------------------------------------
  */

  function applyOverlayStyle(overlay) {
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483647",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "16px",
      background: "rgba(5, 8, 17, 0.82)",
      backdropFilter: "blur(12px) saturate(0.9)",
      WebkitBackdropFilter: "blur(12px) saturate(0.9)",
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      boxSizing: "border-box",
    });
  }

  function createModal() {
    const modal = document.createElement("div");

    modal.className = "nalar-modal";

    Object.assign(modal.style, {
      position: "relative",
      width: "min(520px, 100%)",
      overflow: "hidden",
      border: `1px solid ${UI.borderStrong}`,
      borderRadius: "12px",
      background: UI.bg,
      color: UI.text,
      boxShadow: "0 32px 80px rgba(0, 0, 0, 0.55), 0 1px 0 rgba(255, 255, 255, 0.06) inset",
    });

    return modal;
  }

  function createLabel(text) {
    const label = document.createElement("div");

    label.className = "nalar-section-label";

    label.textContent = text;

    Object.assign(label.style, {
      fontSize: "9px",
      letterSpacing: ".16em",
      fontWeight: "700",
      color: UI.muted,
    });

    return label;
  }

  function createText(text) {
    const element = document.createElement("div");

    element.className = "nalar-text-block";

    element.textContent = text;

    Object.assign(element.style, {
      color: UI.text,
      fontSize: "13px",
      lineHeight: "1.7",
    });

    return element;
  }

  function createSection(label, content) {
    const section = document.createElement("section");

    section.className = "nalar-section";

    Object.assign(section.style, {
      padding: "18px 0",
      borderBottom: `1px solid ${UI.border}`,
    });

    const heading = createLabel(label);

    heading.style.marginBottom = "10px";

    section.appendChild(heading);

    section.appendChild(content);

    return section;
  }

  function createButton(label, primary) {
    const button = document.createElement("button");

    button.className = primary ? "nalar-button nalar-button-primary" : "nalar-button";

    button.type = "button";

    button.textContent = label;

    Object.assign(button.style, {
      minHeight: "44px",
      padding: "0 18px",
      border: `1px solid ${primary ? UI.accent : UI.borderStrong}`,
      borderRadius: "8px",
      background: primary ? UI.accent : UI.surface,
      color: primary ? "#FFFFFF" : UI.text,
      fontSize: "12.5px",
      fontWeight: "600",
      letterSpacing: "-0.01em",
      cursor: "pointer",
      boxShadow: primary ? "0 2px 10px rgba(0, 102, 255, 0.28)" : "none",
    });

    return button;
  }

  function createRiskRing(score, level) {
    const container = document.createElement("div");

    container.className = "nalar-risk-ring";

    Object.assign(container.style, {
      minWidth: "110px",
      padding: "12px 13px",
      border: `1px solid ${UI.border}`,
      borderRadius: "10px",
      background: UI.surface,
      textAlign: "center",
    });

    const size = 48;
    const stroke = 3;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const clampedScore = Math.max(0, Math.min(100, score));
    const target = circumference - (clampedScore / 100) * circumference;
    const color = riskColor(level);

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
    svg.style.display = "block";
    svg.style.margin = "0 auto";

    const trackCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");

    trackCircle.setAttribute("cx", String(size / 2));
    trackCircle.setAttribute("cy", String(size / 2));
    trackCircle.setAttribute("r", String(radius));
    trackCircle.setAttribute("fill", "none");
    trackCircle.setAttribute("stroke", UI.raised);
    trackCircle.setAttribute("stroke-width", String(stroke));

    const fillCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");

    fillCircle.setAttribute("cx", String(size / 2));
    fillCircle.setAttribute("cy", String(size / 2));
    fillCircle.setAttribute("r", String(radius));
    fillCircle.setAttribute("fill", "none");
    fillCircle.setAttribute("stroke", color);
    fillCircle.setAttribute("stroke-width", String(stroke));
    fillCircle.setAttribute("stroke-dasharray", String(circumference));
    fillCircle.setAttribute("stroke-dashoffset", String(circumference));
    fillCircle.setAttribute("stroke-linecap", "round");
    fillCircle.setAttribute("transform", `rotate(-90 ${size / 2} ${size / 2})`);

    fillCircle.style.setProperty("--nalar-ring-circumference", String(circumference));
    fillCircle.style.setProperty("--nalar-ring-target", String(target));
    fillCircle.style.transition = "stroke-dashoffset 800ms cubic-bezier(.16,1,.3,1)";

    // animated reveal after mount
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fillCircle.setAttribute("stroke-dashoffset", String(target));
      });
    });

    const scoreLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");

    scoreLabel.setAttribute("x", String(size / 2));
    scoreLabel.setAttribute("y", String(size / 2 + 1));
    scoreLabel.setAttribute("text-anchor", "middle");
    scoreLabel.setAttribute("dominant-baseline", "central");
    scoreLabel.setAttribute("fill", color);
    scoreLabel.setAttribute("font-size", "12");
    scoreLabel.setAttribute("font-weight", "700");
    scoreLabel.setAttribute("font-family", "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace");
    scoreLabel.textContent = String(clampedScore);

    svg.appendChild(trackCircle);
    svg.appendChild(fillCircle);
    svg.appendChild(scoreLabel);

    container.appendChild(svg);

    const riskLabel = document.createElement("div");

    riskLabel.textContent = level;

    Object.assign(riskLabel.style, {
      marginTop: "6px",
      fontSize: "9px",
      fontWeight: "700",
      letterSpacing: ".06em",
      color,
    });

    container.appendChild(riskLabel);

    return container;
  }

  function createSecuritySummary(rows) {
    const wrapper = document.createElement("div");

    wrapper.className = "nalar-security-summary";

    Object.assign(wrapper.style, {
      padding: "14px",
      border: `1px solid ${UI.border}`,
      borderRadius: "8px",
      background: UI.surface,
    });

    rows.forEach((item, index) => {
      const row = document.createElement("div");

      row.className = "nalar-summary-row";

      Object.assign(row.style, {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: "12px",
        padding: "5px 0",
        fontSize: "11px",
      });

      if (index > 0) {
        row.style.borderTop = `1px solid ${UI.border}`;
      }

      const label = document.createElement("span");

      label.textContent = item.label;

      label.style.color = UI.muted;

      const value = document.createElement("span");

      value.textContent = item.value;

      value.style.color = item.color ?? UI.soft;

      if (item.mono) {
        value.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
      }

      row.appendChild(label);

      row.appendChild(value);

      wrapper.appendChild(row);
    });

    return wrapper;
  }

  function buildSecuritySummary(security, decision) {
    const rows = [];

    const intent = security?.intent?.description;

    if (intent) {
      rows.push({ label: "Intent", value: intent });
    }

    const summary = security?.transactionSummary;

    if (summary?.title) {
      rows.push({ label: "Actual transaction", value: summary.title });
    }

    const sim = security?.simulation;

    if (sim && typeof sim.success === "boolean") {
      rows.push({
        label: "Simulation",
        value: sim.success ? "Completed" : "Failed",
        color: sim.success ? UI.safe : UI.danger,
      });
    }

    if (typeof security?.intentMatch === "boolean") {
      rows.push({
        label: "Intent match",
        value: security.intentMatch ? "Match" : "Mismatch",
        color: security.intentMatch ? UI.safe : UI.danger,
      });
    }

    rows.push({
      label: "Decision",
      value: decision,
      color: decision === "BLOCK" ? UI.danger : decision === "REVIEW" ? UI.warning : UI.safe,
    });

    return rows;
  }

  function createEvidenceTimeline(nodes) {
    const wrapper = document.createElement("div");

    wrapper.className = "nalar-timeline";

    Object.assign(wrapper.style, {
      position: "relative",
      paddingLeft: "20px",
    });

    // vertical connector line
    const line = document.createElement("div");

    Object.assign(line.style, {
      position: "absolute",
      left: "5px",
      top: "4px",
      bottom: "4px",
      width: "1px",
      background: UI.borderStrong,
    });

    wrapper.appendChild(line);

    nodes.forEach((node, index) => {
      const el = document.createElement("div");

      el.className = "nalar-timeline-node";

      el.setAttribute("data-type", node.type ?? "data");

      Object.assign(el.style, {
        position: "relative",
        padding: "5px 0",
        fontSize: "11px",
        animationDelay: `${index * 100}ms`,
      });

      // node dot via pseudo-element positioning
      const dot = document.createElement("div");

      const isDecision = node.type === "decision";
      const isThreat = node.type === "threat";
      const dotSize = isDecision ? 7 : 5;

      Object.assign(dot.style, {
        position: "absolute",
        left: `-${18 + (isDecision ? 1 : 0)}px`,
        top: "50%",
        transform: "translateY(-50%)",
        width: `${dotSize}px`,
        height: `${dotSize}px`,
        borderRadius: "50%",
        background: isThreat || isDecision ? UI.danger : UI.muted,
      });

      el.appendChild(dot);

      const text = document.createElement("span");

      text.textContent = node.label;

      text.style.color = isThreat || isDecision ? UI.danger : node.type === "interpretation" ? UI.soft : UI.muted;

      if (node.mono) {
        text.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
      }

      el.appendChild(text);

      wrapper.appendChild(el);
    });

    return wrapper;
  }

  function buildTimelineData(security, decision) {
    const nodes = [];

    const reports = Array.isArray(security?.scamAnalyses) ? security.scamAnalyses : Array.isArray(security?.transactionScamContext?.analyses) ? security.transactionScamContext.analyses : [];

    reports.forEach((analysis) => {
      const stateEntries = Array.isArray(analysis?.contractPrivileges?.state) ? analysis.contractPrivileges.state : [];

      stateEntries.forEach((entry) => {
        let displayValue = entry?.value ?? "Unknown";

        if (entry?.code === "CURRENT_SELL_TAX" && entry?.unit === "PERCENT") {
          const numeric = Number(displayValue);

          if (Number.isFinite(numeric)) {
            displayValue = `${(numeric / 100).toFixed(2)}%`;
          }
        }

        nodes.push({
          label: `${humanizeEvidenceLabel(entry?.label ?? entry?.code)} = ${displayValue}`,
          type: "data",
          mono: true,
        });
      });

      const findings = Array.isArray(analysis?.findings) ? analysis.findings : [];

      findings.forEach((finding) => {
        const severity = String(finding?.severity ?? "INFO").toUpperCase();

        nodes.push({
          label: finding?.title ?? finding?.code ?? "Finding",
          type: severity === "CRITICAL" || severity === "HIGH" ? "threat" : "interpretation",
        });
      });
    });

    if (security?.riskLevel) {
      nodes.push({
        label: security.riskLevel,
        type: "threat",
      });
    }

    if (decision) {
      nodes.push({
        label: decision,
        type: "decision",
      });
    }

    return nodes;
  }

  function createIntentMatchSection(security) {
    const wrapper = document.createElement("div");

    wrapper.className = "nalar-intent-match";

    wrapper.setAttribute("data-match", String(security.intentMatch));

    Object.assign(wrapper.style, {
      padding: "18px 0",
      borderBottom: `1px solid ${UI.border}`,
    });

    const heading = createLabel("INTENT CHECK");

    heading.style.marginBottom = "10px";

    wrapper.appendChild(heading);

    const content = document.createElement("div");

    Object.assign(content.style, {
      fontSize: "13px",
      lineHeight: "1.6",
    });

    if (security.intentMatch) {
      content.style.color = UI.safe;

      content.textContent = "\u2713 Your request matches the transaction.";
    } else {
      content.style.color = UI.danger;

      const mismatchText = "\u2717 Your request does not match the transaction.";

      content.textContent = mismatchText;

      // show specific mismatch details from backend if available
      const intentDesc = security?.intent?.description;
      const txTitle = security?.transactionSummary?.title;

      if (intentDesc && txTitle && intentDesc !== txTitle) {
        const detail = document.createElement("div");

        Object.assign(detail.style, {
          marginTop: "8px",
          fontSize: "11px",
          lineHeight: "1.5",
          color: UI.soft,
        });

        const requested = document.createElement("div");

        requested.textContent = `Requested: ${intentDesc}`;

        const actual = document.createElement("div");

        actual.textContent = `Transaction: ${txTitle}`;

        actual.style.marginTop = "2px";

        detail.appendChild(requested);

        detail.appendChild(actual);

        content.appendChild(detail);
      }
    }

    wrapper.appendChild(content);

    return wrapper;
  }

  function getDecisionStatus(decision) {
    switch (decision) {
      case "BLOCK":
        return {
          title: "BLOCKED",
          subtitle: "Nalar stopped this transaction before your wallet signed it.",
          label: "Nalar stopped this transaction before your wallet signed it.",
        };

      case "REVIEW":
        return {
          title: "REVIEW REQUIRED",
          subtitle: "Nalar recommends reviewing this transaction before proceeding.",
          label: "Nalar recommends reviewing this transaction before proceeding.",
        };

      default:
        return {
          title: "SAFE TO CONTINUE",
          subtitle: "Transaction appears consistent with your intent.",
          label: "Transaction appears consistent with your intent.",
        };
    }
  }

  function getFallbackSummary(security, decision) {
    if (decision === "BLOCK") {
      if (security?.intentMatch === false) {
        return "This transaction does not match what you asked to do.";
      }

      return "Nalar found a security condition that does not allow this transaction to continue.";
    }

    if (decision === "REVIEW") {
      return "Nalar found conditions that should be reviewed before you sign.";
    }

    return "Nalar did not detect a blocking security condition.";
  }

  function getFooterNote(decision) {
    if (decision === "BLOCK") {
      return "Transaction was not forwarded to your wallet.";
    }

    if (decision === "REVIEW") {
      return "Continuing will send the original request to your wallet.";
    }

    return "Your wallet will ask for final confirmation.";
  }

  function humanizeEvidenceLabel(value) {
    if (!value) {
      return "State";
    }

    const map = {
      CURRENT_SELL_TAX: "Current sell tax",

      CURRENT_BUY_TAX: "Current buy tax",

      PAUSED: "Paused",

      TRADING_ENABLED: "Trading enabled",

      MAX_TX: "Maximum transaction",

      MAX_WALLET: "Maximum wallet",

      OWNER: "Owner",
    };

    if (map[value]) {
      return map[value];
    }

    return String(value)
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  /*
  |--------------------------------------------------------------------------
  | Initialize
  |--------------------------------------------------------------------------
  */

  installEip6963();

  installDirectProviders();

  let attempts = 0;

  const providerTimer = setInterval(() => {
    attempts += 1;

    installDirectProviders();

    if (attempts >= 200) {
      clearInterval(providerTimer);
    }
  }, 50);

  console.info("[Nalar] TxSentry interceptor installed.");
})();
