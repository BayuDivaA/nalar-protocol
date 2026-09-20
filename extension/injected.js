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

    banner: "__nalar_banner__",
  };

  const UI = {
    bg: "#0a0a09",
    surface: "#10100f",
    raised: "#151513",

    border: "rgba(255,255,255,.075)",

    borderStrong: "rgba(255,255,255,.14)",

    text: "#f2f1eb",

    soft: "#b7b5ad",

    muted: "#73736d",

    dim: "#4a4a45",

    danger: "#ef806f",

    warning: "#e0b76d",

    safe: "#9dbb9f",

    accent: "#f2f1eb",
  };

  const wrappedProviders = new WeakSet();

  const ANALYSIS_STEPS = ["Reading your intent", "Decoding the wallet request", "Simulating execution", "Inspecting contract rules", "Checking on-chain state", "Applying security policy"];

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

      @keyframes nalarModalIn {
        from {
          opacity: 0;
          transform: translateY(8px) scale(.985);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
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

      @keyframes nalarProgressFill {
        from { transform: scaleX(0); }
        to { transform: scaleX(1); }
      }

      @keyframes nalarPulse {
        0%, 100% { opacity: .4; }
        50% { opacity: 1; }
      }

      @keyframes nalarSweep {
        from { top: -4%; }
        to { top: 104%; }
      }

      @keyframes nalarRiskReveal {
        from {
          stroke-dashoffset: var(--nalar-ring-circumference, 220);
        }
        to {
          stroke-dashoffset: var(--nalar-ring-target, 220);
        }
      }

      @keyframes nalarNodeReveal {
        from {
          opacity: 0;
          transform: translateY(4px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .nalar-overlay {
        animation: nalarFadeIn 160ms ease-out;
      }

      .nalar-modal {
        isolation: isolate;
        animation: nalarModalIn 280ms cubic-bezier(.16,1,.3,1);
      }

      .nalar-modal::before {
        position: absolute;
        inset: 0 18px auto;
        height: 1px;
        content: "";
        background: rgba(255,255,255,.18);
        opacity: .65;
        pointer-events: none;
      }

      .nalar-button {
        transition:
          background 150ms ease,
          border-color 150ms ease,
          transform 100ms ease,
          box-shadow 150ms ease;
      }

      .nalar-button:hover {
        border-color: rgba(255,255,255,.24) !important;
      }

      .nalar-button:active {
        transform: translateY(1px);
      }

      .nalar-button:focus-visible {
        outline: 2px solid ${UI.safe};
        outline-offset: 2px;
      }

      .nalar-analysis-active {
        animation: nalarPulse 1.2s ease-in-out infinite;
      }

      .nalar-risk-fill {
        transition: transform 600ms cubic-bezier(.16,1,.3,1);
      }

      .nalar-analysis-modal::after {
        position: absolute;
        top: -4%;
        right: 0;
        left: 0;
        height: 1px;
        content: "";
        background: rgba(255,255,255,.2);
        box-shadow: 0 0 12px rgba(255,255,255,.1);
        pointer-events: none;
        animation: nalarSweep 3s linear infinite;
      }

      .nalar-step-progress {
        transform-origin: left center;
        transition: transform 400ms cubic-bezier(.16,1,.3,1);
      }

      .nalar-timeline-node {
        animation: nalarNodeReveal 300ms ease-out both;
      }

      @media (prefers-reduced-motion: reduce) {
        .nalar-overlay,
        .nalar-modal,
        .nalar-analysis-active,
        .nalar-timeline-node {
          animation: none !important;
        }

        .nalar-button {
          transition: none !important;
        }

        .nalar-risk-fill,
        .nalar-step-progress {
          transition: none !important;
        }

        .nalar-analysis-modal::after {
          animation: none !important;
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

  async function handleTransactionRequest({ originalRequest, args, providerLabel }) {
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
     * Resolve current chain
     */

    const chainId = await originalRequest({
      method: "eth_chainId",
    });

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
        chainId,
        transaction,
      });

      window.postMessage(
        {
          source: "NALAR_PAGE",

          type: "TX_REQUEST",

          id,

          chainId,

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

      header.style.padding = "28px 28px 22px";

      header.style.borderBottom = `1px solid ${UI.border}`;

      const eyebrow = createLabel("NALAR PROTOCOL");

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
      width: "min(480px, 100%)",
      padding: "28px",
    });

    const eyebrow = createLabel("NALAR PROTOCOL");

    const title = document.createElement("h2");

    title.textContent = "Analyzing transaction";

    Object.assign(title.style, {
      margin: "10px 0 0",
      fontSize: "22px",
      lineHeight: "1.08",
      letterSpacing: "-.03em",
      color: UI.text,
    });

    const subtitle = document.createElement("p");

    subtitle.textContent = "Checking the request before your wallet is asked to sign.";

    Object.assign(subtitle.style, {
      margin: "10px 0 0",
      fontSize: "13px",
      lineHeight: "1.6",
      color: UI.soft,
    });

    const counter = document.createElement("div");

    Object.assign(counter.style, {
      marginTop: "20px",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      fontSize: "10px",
      color: UI.muted,
    });

    counter.textContent = `01 / ${String(ANALYSIS_STEPS.length).padStart(2, "0")}`;

    const list = document.createElement("div");

    list.style.marginTop = "8px";

    const rows = ANALYSIS_STEPS.map((label, index) => {
      const row = document.createElement("div");

      row.setAttribute("data-state", index === 0 ? "active" : "pending");

      Object.assign(row.style, {
        display: "grid",
        gridTemplateColumns: "22px 1fr",
        alignItems: "center",
        gap: "10px",
        padding: "10px 0",
        borderBottom: `1px solid ${UI.border}`,
        opacity: index === 0 ? "1" : "0",
        animation: `nalarStepIn 200ms ease-out ${index * 80}ms both`,
      });

      if (index === ANALYSIS_STEPS.length - 1) {
        row.style.borderBottom = "none";
      }

      const indicator = document.createElement("div");

      indicator.className = "nalar-analysis-indicator";

      Object.assign(indicator.style, {
        width: "22px",
        height: "22px",
        display: "grid",
        placeItems: "center",
        fontSize: "10px",
        fontWeight: "600",
      });

      if (index === 0) {
        indicator.textContent = "●";
        indicator.style.color = UI.text;
        indicator.classList.add("nalar-analysis-active");
      } else {
        indicator.textContent = "○";
        indicator.style.color = UI.dim;
      }

      const textWrap = document.createElement("div");

      const text = document.createElement("div");

      text.textContent = label;

      text.style.fontSize = "12px";

      text.style.color = index === 0 ? UI.text : UI.dim;

      const progress = document.createElement("div");

      Object.assign(progress.style, {
        height: "2px",
        marginTop: "6px",
        background: UI.raised,
        overflow: "hidden",
        borderRadius: "1px",
      });

      const progressFill = document.createElement("div");

      progressFill.className = "nalar-step-progress";

      Object.assign(progressFill.style, {
        width: "100%",
        height: "100%",
        background: UI.safe,
        transform: "scaleX(0)",
      });

      progress.appendChild(progressFill);

      textWrap.appendChild(text);

      textWrap.appendChild(progress);

      row.appendChild(indicator);

      row.appendChild(textWrap);

      list.appendChild(row);

      return { indicator, text, row, progressFill };
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
          item.indicator.classList.remove("nalar-analysis-active");
          item.text.style.color = UI.soft;
          item.progressFill.style.transform = "scaleX(1)";
          item.row.setAttribute("data-state", "done");
        } else if (index === current) {
          item.indicator.textContent = "●";
          item.indicator.classList.add("nalar-analysis-active");
          item.indicator.style.color = UI.text;
          item.text.style.color = UI.text;
          item.progressFill.style.transform = "scaleX(0.6)";
          item.row.setAttribute("data-state", "active");
        } else {
          item.indicator.textContent = "○";
          item.indicator.classList.remove("nalar-analysis-active");
          item.indicator.style.color = UI.dim;
          item.text.style.color = UI.dim;
          item.progressFill.style.transform = "scaleX(0)";
          item.row.setAttribute("data-state", "pending");
        }
      });

      counter.textContent = `${String(current + 1).padStart(2, "0")} / ${String(ANALYSIS_STEPS.length).padStart(2, "0")}`;

      current += 1;

      // hold on last step until backend responds
      if (current >= rows.length) {
        current = rows.length - 1;
      }
    }, 520);

    return {
      remove() {
        clearInterval(timer);
        removeNalarElement(IDS.analysis);
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
        overlay.remove();
        if (onCancel) {
          onCancel();
        }
      }
    });
  }

  function createDecisionHeader(decision, status, riskLevel, riskScore) {
    const header = document.createElement("header");

    header.className = "nalar-decision-header";

    Object.assign(header.style, {
      display: "grid",
      gridTemplateColumns: "44px 1fr auto",
      gap: "14px",
      alignItems: "center",
      padding: "24px 26px 22px",
      borderBottom: `1px solid ${UI.border}`,
    });

    const mark = document.createElement("div");

    mark.className = "nalar-decision-mark";

    mark.textContent = decision === "BLOCK" ? "✕" : decision === "REVIEW" ? "?" : "✓";

    Object.assign(mark.style, {
      width: "44px",
      height: "44px",
      display: "grid",
      placeItems: "center",
      border: `1px solid ${UI.borderStrong}`,
      borderRadius: "10px",
      background: UI.surface,
      color: decision === "BLOCK" ? UI.danger : decision === "REVIEW" ? UI.warning : UI.safe,
      fontSize: "18px",
      fontWeight: "700",
    });

    const headingWrap = document.createElement("div");

    const eyebrow = createLabel("NALAR PROTOCOL · DECISION");

    const heading = document.createElement("h2");

    heading.textContent = status.title;

    Object.assign(heading.style, {
      margin: "4px 0 0",
      fontSize: "22px",
      lineHeight: "1.08",
      letterSpacing: "-.03em",
      color: UI.text,
      fontWeight: "700",
    });

    const subtitle = document.createElement("p");

    subtitle.textContent = status.subtitle;

    Object.assign(subtitle.style, {
      margin: "4px 0 0",
      fontSize: "12px",
      lineHeight: "1.4",
      color: UI.soft,
    });

    headingWrap.appendChild(eyebrow);

    headingWrap.appendChild(heading);

    headingWrap.appendChild(subtitle);

    const riskRing = createRiskRing(riskScore, riskLevel);

    header.appendChild(mark);

    header.appendChild(headingWrap);

    header.appendChild(riskRing);

    return header;
  }

  function createWhyStoppedCard(explanation, security, decision) {
    const isBlock = decision === "BLOCK";
    const isReview = decision === "REVIEW";

    const card = document.createElement("div");

    card.className = "nalar-why-stopped-card";

    Object.assign(card.style, {
      marginTop: "16px",
      padding: "18px 20px",
      border: `1px solid ${isBlock ? "rgba(239,128,111,.32)" : isReview ? "rgba(224,183,109,.32)" : UI.border}`,
      borderRadius: "10px",
      background: UI.surface,
    });

    const sectionLabel = createLabel(isBlock ? "WHY NALAR STOPPED THIS" : isReview ? "WHY REVIEW IS REQUIRED" : "SECURITY ASSESSMENT");

    card.appendChild(sectionLabel);

    const headlineText =
      explanation.headline ||
      explanation.whyStopped?.title ||
      explanation.title ||
      (isBlock ? "Potentially Malicious Transaction Blocked" : isReview ? "Transaction Requires Verification" : "Transaction Cleared");

    const headline = document.createElement("div");

    headline.className = "nalar-why-stopped-headline";

    headline.textContent = headlineText;

    Object.assign(headline.style, {
      marginTop: "8px",
      fontSize: "16px",
      fontWeight: "650",
      lineHeight: "1.35",
      letterSpacing: "-.01em",
      color: isBlock ? UI.danger : isReview ? UI.warning : UI.text,
    });

    card.appendChild(headline);

    const primaryReasonText =
      explanation.whyStopped?.primaryReason ||
      explanation.summary ||
      getFallbackSummary(security, decision);

    const primaryReason = document.createElement("div");

    primaryReason.className = "nalar-why-stopped-primary";

    primaryReason.textContent = primaryReasonText;

    Object.assign(primaryReason.style, {
      marginTop: "8px",
      fontSize: "13px",
      lineHeight: "1.6",
      color: UI.soft,
    });

    card.appendChild(primaryReason);

    const userImpactText = explanation.whyStopped?.userImpact || (isBlock ? explanation.recommendedAction : null);

    if (userImpactText) {
      const impactBox = document.createElement("div");

      impactBox.className = "nalar-why-stopped-impact";

      Object.assign(impactBox.style, {
        marginTop: "12px",
        padding: "10px 12px",
        borderRadius: "6px",
        border: `1px solid ${UI.border}`,
        background: UI.raised,
      });

      const impactLabel = document.createElement("div");

      impactLabel.className = "nalar-impact-label";

      impactLabel.textContent = "POTENTIAL IMPACT";

      Object.assign(impactLabel.style, {
        fontSize: "9px",
        fontWeight: "700",
        letterSpacing: ".12em",
        color: UI.muted,
      });

      const impactValue = document.createElement("div");

      impactValue.className = "nalar-impact-text";

      impactValue.textContent = userImpactText;

      Object.assign(impactValue.style, {
        marginTop: "4px",
        fontSize: "12px",
        lineHeight: "1.55",
        color: UI.soft,
      });

      impactBox.appendChild(impactLabel);

      impactBox.appendChild(impactValue);

      card.appendChild(impactBox);
    }

    const details = dedupe([
      ...(Array.isArray(explanation.details) ? explanation.details : []),
      ...(isBlock && Array.isArray(security?.reasons) ? security.reasons : []),
    ]).filter((item) => item !== primaryReasonText && item !== headlineText);

    if (details.length) {
      const list = document.createElement("div");

      list.style.marginTop = "12px";

      details.slice(0, 4).forEach((item) => {
        const row = document.createElement("div");

        row.textContent = `· ${item}`;

        Object.assign(row.style, {
          marginBottom: "4px",
          color: UI.muted,
          fontSize: "12px",
          lineHeight: "1.55",
        });

        list.appendChild(row);
      });

      card.appendChild(list);
    }

    return card;
  }

  function createIntentVsActualComparison(explanation, security, decision) {
    const card = document.createElement("div");

    card.className = "nalar-comparison-card";

    Object.assign(card.style, {
      marginTop: "14px",
      padding: "16px 18px",
      border: `1px solid ${UI.border}`,
      borderRadius: "10px",
      background: UI.surface,
    });

    const headerRow = document.createElement("div");

    headerRow.className = "nalar-comparison-header";

    Object.assign(headerRow.style, {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "12px",
    });

    const headerLabel = createLabel("INTENT VS ACTUAL TRANSACTION");

    headerRow.appendChild(headerLabel);

    const match = typeof explanation.comparison?.match === "boolean"
      ? explanation.comparison.match
      : typeof security?.intentMatch === "boolean"
        ? security.intentMatch
        : true;

    const matchBadge = document.createElement("div");

    matchBadge.className = "nalar-badge";

    matchBadge.setAttribute("data-match", String(match));

    matchBadge.textContent = match ? "✓ MATCH" : "✕ MISMATCH";

    Object.assign(matchBadge.style, {
      padding: "3px 8px",
      borderRadius: "4px",
      fontSize: "9px",
      fontWeight: "750",
      letterSpacing: ".08em",
      color: match ? UI.safe : UI.danger,
      background: match ? "rgba(157,187,159,.12)" : "rgba(239,128,111,.12)",
      border: `1px solid ${match ? "rgba(157,187,159,.25)" : "rgba(239,128,111,.25)"}`,
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

    const userIntentText = explanation.userIntent || security?.intent?.description || "Not specified";

    const actualTxText = explanation.actualTransaction || security?.transactionSummary?.title || humanizeAction(security?.actual?.action) || "Contract call";

    const intentBox = document.createElement("div");

    intentBox.className = "nalar-comparison-box";

    Object.assign(intentBox.style, {
      padding: "11px 12px",
      border: `1px solid ${UI.border}`,
      borderRadius: "8px",
      background: UI.raised,
    });

    const intentLabel = document.createElement("div");

    intentLabel.className = "nalar-comparison-label";

    intentLabel.textContent = "WHAT YOU INTENDED";

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
      fontSize: "12px",
      lineHeight: "1.55",
      color: UI.text,
      wordBreak: "break-word",
    });

    intentBox.appendChild(intentLabel);

    intentBox.appendChild(intentVal);

    grid.appendChild(intentBox);

    const actualBox = document.createElement("div");

    actualBox.className = "nalar-comparison-box";

    Object.assign(actualBox.style, {
      padding: "11px 12px",
      border: `1px solid ${match ? UI.border : "rgba(239,128,111,.35)"}`,
      borderRadius: "8px",
      background: UI.raised,
    });

    const actualLabel = document.createElement("div");

    actualLabel.className = "nalar-comparison-label";

    actualLabel.textContent = "WHAT THE TRANSACTION DOES";

    Object.assign(actualLabel.style, {
      fontSize: "9px",
      fontWeight: "700",
      letterSpacing: ".12em",
      color: match ? UI.muted : UI.danger,
    });

    const actualVal = document.createElement("div");

    actualVal.className = "nalar-comparison-value";

    actualVal.textContent = actualTxText;

    Object.assign(actualVal.style, {
      marginTop: "6px",
      fontSize: "12px",
      lineHeight: "1.55",
      color: match ? UI.text : UI.danger,
      wordBreak: "break-word",
    });

    actualBox.appendChild(actualLabel);

    actualBox.appendChild(actualVal);

    grid.appendChild(actualBox);

    card.appendChild(grid);

    const diffs = Array.isArray(explanation.comparison?.differences) ? explanation.comparison.differences : [];

    const comparisonSummary = explanation.comparison?.summary;

    if (!match || diffs.length || comparisonSummary) {
      const diffContainer = document.createElement("div");

      diffContainer.className = "nalar-comparison-diff";

      Object.assign(diffContainer.style, {
        marginTop: "12px",
        paddingTop: "11px",
        borderTop: `1px solid ${UI.border}`,
      });

      if (comparisonSummary) {
        const summaryEl = document.createElement("div");

        summaryEl.textContent = comparisonSummary;

        Object.assign(summaryEl.style, {
          fontSize: "12px",
          lineHeight: "1.55",
          color: match ? UI.soft : UI.danger,
        });

        diffContainer.appendChild(summaryEl);
      }

      diffs.forEach((diff) => {
        const diffRow = document.createElement("div");

        diffRow.textContent = `· ${diff}`;

        Object.assign(diffRow.style, {
          marginTop: "4px",
          fontSize: "11px",
          lineHeight: "1.5",
          color: UI.muted,
        });

        diffContainer.appendChild(diffRow);
      });

      card.appendChild(diffContainer);
    }

    return card;
  }

  function createWhatThisMeansSection(explanation, security, decision) {
    const isBlock = decision === "BLOCK";
    const isReview = decision === "REVIEW";

    const text =
      explanation.whatThisMeans ||
      (isBlock
        ? "Signing this transaction could result in irreversible loss of assets or unverified smart contract execution."
        : isReview
          ? "Proceeding will grant permissions or initiate actions that should be carefully verified."
          : "This transaction will execute with standard network confirmation and fees.");

    const card = document.createElement("div");

    card.className = "nalar-means-card";

    Object.assign(card.style, {
      marginTop: "14px",
      padding: "14px 16px",
      border: `1px solid ${UI.border}`,
      borderRadius: "8px",
      background: UI.surface,
      fontSize: "13px",
      lineHeight: "1.65",
      color: UI.text,
    });

    const label = createLabel("WHAT THIS MEANS FOR YOU");

    label.style.marginBottom = "8px";

    card.appendChild(label);

    const body = document.createElement("div");

    body.textContent = text;

    card.appendChild(body);

    return card;
  }

  function createEvidenceSection(explanation, security) {
    const evidenceItems = Array.isArray(explanation.evidence) && explanation.evidence.length > 0
      ? explanation.evidence
      : null;

    if (evidenceItems) {
      const card = document.createElement("div");

      card.className = "nalar-evidence-card";

      Object.assign(card.style, {
        marginTop: "14px",
        padding: "16px 18px",
        border: `1px solid ${UI.border}`,
        borderRadius: "10px",
        background: UI.surface,
      });

      const label = createLabel("OBSERVED SECURITY EVIDENCE");

      label.style.marginBottom = "12px";

      card.appendChild(label);

      evidenceItems.forEach((item, index) => {
        const row = document.createElement("div");

        Object.assign(row.style, {
          padding: "8px 0",
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
          fontSize: "12px",
          fontWeight: "600",
          color: UI.text,
        });

        const rightSide = document.createElement("div");

        Object.assign(rightSide.style, {
          display: "flex",
          alignItems: "center",
          gap: "8px",
        });

        const valEl = document.createElement("span");

        valEl.textContent = item.value;

        Object.assign(valEl.style, {
          fontSize: "12px",
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
            marginTop: "4px",
            fontSize: "11px",
            lineHeight: "1.55",
            color: UI.muted,
          });

          row.appendChild(expEl);
        }

        card.appendChild(row);
      });

      return card;
    }

    const reports = Array.isArray(security?.scamAnalyses)
      ? security.scamAnalyses
      : Array.isArray(security?.transactionScamContext?.analyses)
        ? security.transactionScamContext.analyses
        : [];

    if (!reports.length) {
      return null;
    }

    const wrapper = document.createElement("div");

    reports.forEach((analysis) => {
      const card = document.createElement("div");

      card.className = "nalar-evidence-card";

      Object.assign(card.style, {
        marginTop: "14px",
        padding: "16px",
        border: `1px solid ${UI.border}`,
        borderRadius: "10px",
        background: UI.surface,
      });

      const head = document.createElement("div");

      head.className = "nalar-evidence-heading";

      Object.assign(head.style, {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "12px",
      });

      const token = document.createElement("div");

      token.textContent = formatAddress(analysis?.token);

      token.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

      token.style.fontSize = "12px";

      token.style.color = UI.text;

      const badge = document.createElement("div");

      badge.textContent = `${analysis?.riskLevel ?? "UNKNOWN"} · ${analysis?.riskScore ?? 0}`;

      Object.assign(badge.style, {
        color: riskColor(analysis?.riskLevel),
        fontSize: "10px",
        fontWeight: "700",
        letterSpacing: ".04em",
      });

      head.appendChild(token);

      head.appendChild(badge);

      card.appendChild(head);

      const findings = Array.isArray(analysis?.findings) ? analysis.findings : [];

      if (findings.length) {
        const findingList = document.createElement("div");

        findingList.style.marginTop = "13px";

        findings.slice(0, 5).forEach((finding) => {
          const severity = String(finding?.severity ?? "INFO").toUpperCase();
          const isThreat = severity === "CRITICAL" || severity === "HIGH";

          const row = document.createElement("div");

          row.className = "nalar-finding";

          row.setAttribute("data-severity", severity.toLowerCase());

          Object.assign(row.style, {
            padding: "5px 0",
            fontSize: "12px",
            lineHeight: "1.55",
            color: isThreat ? UI.danger : severity === "MEDIUM" ? UI.warning : UI.muted,
          });

          const title = finding?.title ?? finding?.code ?? "Security finding";

          row.textContent = isThreat ? title : title;

          findingList.appendChild(row);
        });

        card.appendChild(findingList);
      }

      const stateEntries = Array.isArray(analysis?.contractPrivileges?.state) ? analysis.contractPrivileges.state : [];

      if (stateEntries.length) {
        const state = document.createElement("div");

        Object.assign(state.style, {
          marginTop: "12px",
          paddingTop: "12px",
          borderTop: `1px solid ${UI.border}`,
        });

        stateEntries.slice(0, 7).forEach((entry) => {
          const row = document.createElement("div");

          Object.assign(row.style, {
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            padding: "4px 0",
            fontSize: "11px",
          });

          const label = document.createElement("span");

          label.textContent = humanizeEvidenceLabel(entry?.label ?? entry?.code);

          label.style.color = UI.muted;

          const value = document.createElement("span");

          let displayValue = entry?.value ?? "Unknown";

          if (entry?.code === "CURRENT_SELL_TAX" && entry?.unit === "PERCENT") {
            const numeric = Number(displayValue);

            if (Number.isFinite(numeric)) {
              displayValue = `${(numeric / 100).toFixed(2)}%`;
            }
          }

          value.textContent = String(displayValue);

          value.style.color = UI.soft;

          value.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

          row.appendChild(label);

          row.appendChild(value);

          state.appendChild(row);
        });

        card.appendChild(state);
      }

      if (analysis?.agentAnalysis?.available === true) {
        const source = document.createElement("div");

        Object.assign(source.style, {
          marginTop: "12px",
          paddingTop: "11px",
          borderTop: `1px solid ${UI.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        });

        const label = document.createElement("span");

        label.textContent = "BNB MCP";

        label.style.color = UI.muted;

        label.style.fontSize = "10px";

        const evidence = document.createElement("span");

        evidence.textContent = "ON-CHAIN";

        Object.assign(evidence.style, {
          color: UI.safe,
          fontSize: "8px",
          letterSpacing: ".08em",
          fontWeight: "700",
        });

        source.appendChild(label);

        source.appendChild(evidence);

        card.appendChild(source);
      }

      wrapper.appendChild(card);
    });

    return wrapper;
  }

  function createTechnicalSection(explanation, security) {
    const wrapper = document.createElement("details");

    wrapper.className = "nalar-tech-details";

    Object.assign(wrapper.style, {
      marginTop: "14px",
      padding: "14px 0",
      borderBottom: `1px solid ${UI.border}`,
    });

    const summary = document.createElement("summary");

    summary.textContent = "Technical details (advanced)";

    Object.assign(summary.style, {
      cursor: "pointer",
      color: UI.muted,
      fontSize: "11px",
      fontWeight: "600",
      userSelect: "none",
    });

    wrapper.appendChild(summary);

    const content = document.createElement("div");

    content.style.marginTop = "10px";

    const actual = security?.actual ?? {};

    const tx = security?.transactionSummary ?? {};

    const sim = security?.simulation ?? {};

    const rows = [
      ["Network", "BNB Smart Chain Testnet (97)"],
      ["Target contract", tx.target ? formatAddress(tx.target) : (security?.transaction?.to ? formatAddress(security.transaction.to) : "N/A")],
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
      padding: "18px 26px 24px",
      borderTop: `1px solid ${UI.border}`,
      flex: "0 0 auto",
    });

    const note = document.createElement("div");

    note.className = "nalar-decision-note";

    note.textContent = getFooterNote(decision);

    Object.assign(note.style, {
      marginBottom: "13px",
      color: UI.muted,
      fontSize: "10px",
      lineHeight: "1.55",
    });

    const actions = document.createElement("div");

    Object.assign(actions.style, {
      display: "grid",
      gridTemplateColumns: isBlock ? "1fr" : "120px 1fr",
      gap: "8px",
    });

    const cancel = createButton(isBlock ? "Close" : "Cancel", isBlock);

    cancel.onclick = () => {
      overlay.remove();

      if (onCancel) {
        onCancel();
      }
    };

    actions.appendChild(cancel);

    if (!isBlock) {
      const continueButton = createButton(decision === "REVIEW" ? "Review & continue" : "Continue to wallet", true);

      continueButton.onclick = () => {
        overlay.remove();

        if (onContinue) {
          onContinue();
        }
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
      background: "rgba(4,4,4,.78)",
      backdropFilter: "blur(10px) saturate(.85)",
      WebkitBackdropFilter: "blur(10px) saturate(.85)",
      fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
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
      borderRadius: "14px",
      background: UI.bg,
      color: UI.text,
      boxShadow: "0 40px 120px rgba(0,0,0,.52), 0 1px 0 rgba(255,255,255,.035) inset",
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
      padding: "0 14px",
      border: `1px solid ${primary ? UI.text : UI.borderStrong}`,
      borderRadius: "8px",
      background: primary ? UI.text : UI.surface,
      color: primary ? UI.bg : UI.text,
      fontSize: "12px",
      fontWeight: "600",
      cursor: "pointer",
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
          subtitle: "No high-risk conditions detected.",
          label: "No high-risk conditions detected.",
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
      return "The transaction was not forwarded to your wallet.";
    }

    if (decision === "REVIEW") {
      return "Continuing will send the original request to your wallet for final confirmation.";
    }

    return "Nalar has completed the check. Your wallet will ask for final confirmation next.";
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
