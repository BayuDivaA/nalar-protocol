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
    bg: "#090909",
    surface: "#10100f",
    raised: "#151514",

    border: "rgba(255,255,255,.085)",

    borderStrong: "rgba(255,255,255,.16)",

    text: "#F3F2ED",

    soft: "#B9B7AE",

    muted: "#77766F",

    dim: "#4F4E49",

    danger: "#F07868",

    warning: "#E1B66B",

    safe: "#9EBC9F",

    accent: "#D7D1C2",
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
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @keyframes nalarModalIn {
        from {
          opacity: 0;
          transform:
            translateY(8px)
            scale(.985);
        }

        to {
          opacity: 1;
          transform:
            translateY(0)
            scale(1);
        }
      }

      @keyframes nalarPulse {
        0%, 100% {
          opacity: .35;
        }

        50% {
          opacity: 1;
        }
      }

      .nalar-overlay {
        animation:
          nalarFadeIn
          160ms ease-out;
      }

      .nalar-modal {
        animation:
          nalarModalIn
          280ms
          cubic-bezier(.16,1,.3,1);
      }

      .nalar-button {
        transition:
          background 150ms ease,
          border-color 150ms ease,
          transform 100ms ease;
      }

      .nalar-button:hover {
        border-color:
          rgba(255,255,255,.26)
          !important;
      }

      .nalar-button:active {
        transform:
          translateY(1px);
      }

      .nalar-analysis-active {
        animation:
          nalarPulse
          1.2s
          ease-in-out
          infinite;
      }

      @media (
        prefers-reduced-motion: reduce
      ) {
        .nalar-overlay,
        .nalar-modal,
        .nalar-analysis-active {
          animation: none !important;
        }

        .nalar-button {
          transition: none !important;
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

      Object.assign(textarea.style, {
        display: "block",

        width: "100%",

        minHeight: "128px",

        marginTop: "8px",

        resize: "vertical",

        padding: "14px",

        border: `1px solid ${UI.borderStrong}`,

        borderRadius: "10px",

        outline: "none",

        background: UI.surface,

        color: UI.text,

        fontSize: "13px",

        lineHeight: "1.6",

        fontFamily: "inherit",
      });

      textarea.addEventListener("focus", () => {
        textarea.style.borderColor = "rgba(255,255,255,.32)";
      });

      textarea.addEventListener("blur", () => {
        textarea.style.borderColor = UI.borderStrong;
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

    Object.assign(modal.style, {
      width: "min(500px, 100%)",
      padding: "28px",
    });

    const eyebrow = createLabel("NALAR PROTOCOL");

    const title = document.createElement("h2");

    title.textContent = "Reading the transaction";

    Object.assign(title.style, {
      margin: "10px 0 0",

      fontSize: "24px",

      lineHeight: "1.08",

      letterSpacing: "-.035em",

      color: UI.text,
    });

    const subtitle = document.createElement("p");

    subtitle.textContent = "Nalar is checking the request before your wallet is asked to sign.";

    Object.assign(subtitle.style, {
      margin: "10px 0 0",

      fontSize: "13px",

      lineHeight: "1.6",

      color: UI.soft,
    });

    const list = document.createElement("div");

    list.style.marginTop = "24px";

    const rows = ANALYSIS_STEPS.map((label, index) => {
      const row = document.createElement("div");

      Object.assign(row.style, {
        display: "grid",

        gridTemplateColumns: "20px 1fr",

        alignItems: "center",

        gap: "10px",

        padding: "11px 0",

        borderBottom: `1px solid ${UI.border}`,
      });

      const dot = document.createElement("div");

      dot.textContent = index === 0 ? "●" : "○";

      dot.style.color = index === 0 ? UI.text : UI.dim;

      dot.style.fontSize = "10px";

      dot.style.textAlign = "center";

      const text = document.createElement("div");

      text.textContent = label;

      text.style.color = index === 0 ? UI.text : UI.dim;

      text.style.fontSize = "12px";

      row.appendChild(dot);

      row.appendChild(text);

      list.appendChild(row);

      return {
        dot,
        text,
        row,
      };
    });

    modal.appendChild(eyebrow);

    modal.appendChild(title);

    modal.appendChild(subtitle);

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
          item.dot.textContent = "✓";

          item.dot.style.color = UI.safe;

          item.text.style.color = UI.soft;
        } else if (index === current) {
          item.dot.textContent = "●";

          item.dot.classList.add("nalar-analysis-active");

          item.dot.style.color = UI.text;

          item.text.style.color = UI.text;
        } else {
          item.dot.textContent = "○";

          item.dot.classList.remove("nalar-analysis-active");

          item.dot.style.color = UI.dim;

          item.text.style.color = UI.dim;
        }
      });

      current += 1;

      if (current >= rows.length) {
        current = rows.length - 1;
      }
    }, 480);

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

    overlay.className = "nalar-overlay";

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

    /*
     * Header
     */

    const header = document.createElement("header");

    Object.assign(header.style, {
      display: "grid",

      gridTemplateColumns: "46px 1fr auto",

      gap: "14px",

      alignItems: "center",

      padding: "24px 26px 22px",

      borderBottom: `1px solid ${UI.border}`,
    });

    const mark = document.createElement("div");

    mark.textContent = decision === "BLOCK" ? "!" : decision === "REVIEW" ? "?" : "✓";

    Object.assign(mark.style, {
      width: "46px",

      height: "46px",

      display: "grid",

      placeItems: "center",

      border: `1px solid ${UI.borderStrong}`,

      borderRadius: "12px",

      background: UI.surface,

      color: decision === "BLOCK" ? UI.danger : decision === "REVIEW" ? UI.warning : UI.safe,

      fontSize: "20px",

      fontWeight: "700",
    });

    const headingWrap = document.createElement("div");

    const eyebrow = createLabel("NALAR · TXSENTRY");

    const heading = document.createElement("h2");

    heading.textContent = status.title;

    Object.assign(heading.style, {
      margin: "7px 0 0",

      fontSize: "24px",

      lineHeight: "1.05",

      letterSpacing: "-.035em",

      color: UI.text,
    });

    const stateText = document.createElement("div");

    stateText.textContent = status.label;

    Object.assign(stateText.style, {
      marginTop: "7px",

      fontSize: "11px",

      color: UI.soft,

      lineHeight: "1.45",
    });

    headingWrap.appendChild(eyebrow);

    headingWrap.appendChild(heading);

    headingWrap.appendChild(stateText);

    const risk = document.createElement("div");

    Object.assign(risk.style, {
      minWidth: "108px",

      padding: "11px 12px",

      border: `1px solid ${UI.border}`,

      borderRadius: "10px",

      background: UI.surface,
    });

    const riskLabel = createLabel("RISK");

    const riskValue = document.createElement("div");

    riskValue.textContent = riskLevel;

    Object.assign(riskValue.style, {
      marginTop: "5px",

      color: riskColor(riskLevel),

      fontSize: "12px",

      fontWeight: "700",
    });

    const riskScoreText = document.createElement("div");

    riskScoreText.textContent = `${riskScore}/100`;

    Object.assign(riskScoreText.style, {
      marginTop: "4px",

      color: UI.muted,

      fontSize: "10px",

      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    });

    risk.appendChild(riskLabel);

    risk.appendChild(riskValue);

    risk.appendChild(riskScoreText);

    header.appendChild(mark);

    header.appendChild(headingWrap);

    header.appendChild(risk);

    /*
     * Scroll body
     */

    const body = document.createElement("main");

    Object.assign(body.style, {
      overflowY: "auto",

      padding: "0 26px",

      flex: "1 1 auto",
    });

    /*
     * User intent
     */

    const intent = security?.intent?.description ?? "No intent description available.";

    body.appendChild(createSection("YOUR REQUEST", createText(intent)));

    /*
     * Actual transaction
     */

    const summary = security?.transactionSummary ?? {};

    const tx = document.createElement("div");

    const txTitle = document.createElement("div");

    txTitle.textContent = summary.title ?? humanizeAction(security?.actual?.action);

    Object.assign(txTitle.style, {
      fontSize: "17px",

      fontWeight: "650",

      letterSpacing: "-.02em",

      color: UI.text,
    });

    const txDescription = document.createElement("div");

    txDescription.textContent = summary.description ?? "Transaction details are available in the technical reference.";

    Object.assign(txDescription.style, {
      marginTop: "7px",

      fontSize: "13px",

      lineHeight: "1.6",

      color: UI.soft,
    });

    tx.appendChild(txTitle);

    tx.appendChild(txDescription);

    if (Array.isArray(summary.details) && summary.details.length) {
      const details = document.createElement("div");

      details.style.marginTop = "13px";

      summary.details.slice(0, 6).forEach((item) => {
        const row = document.createElement("div");

        row.textContent = item;

        Object.assign(row.style, {
          padding: "6px 0",

          fontSize: "11px",

          color: UI.muted,
        });

        details.appendChild(row);
      });

      tx.appendChild(details);
    }

    body.appendChild(createSection("WHAT WILL HAPPEN", tx));

    /*
     * Intent match
     */

    if (typeof security?.intentMatch === "boolean") {
      const match = document.createElement("div");

      Object.assign(match.style, {
        display: "flex",

        justifyContent: "space-between",

        gap: "12px",

        paddingTop: "13px",

        marginTop: "-1px",

        borderTop: `1px solid ${UI.border}`,

        fontSize: "11px",

        color: UI.muted,
      });

      const matchValue = document.createElement("strong");

      matchValue.textContent = security.intentMatch ? "Matches your request" : "Does not match your request";

      matchValue.style.color = security.intentMatch ? UI.safe : UI.danger;

      match.appendChild(document.createTextNode("Intent check"));

      match.appendChild(matchValue);

      tx.appendChild(match);
    }

    /*
     * Simulation
     */

    const simulation = security?.simulation;

    if (simulation && typeof simulation.success === "boolean") {
      const sim = document.createElement("div");

      Object.assign(sim.style, {
        padding: "13px 14px",

        border: `1px solid ${UI.border}`,

        borderRadius: "10px",

        background: UI.surface,
      });

      const simStatus = document.createElement("div");

      simStatus.textContent = simulation.success ? "Simulation completed." : "Simulation failed.";

      simStatus.style.color = simulation.success ? UI.safe : UI.danger;

      simStatus.style.fontSize = "12px";

      simStatus.style.fontWeight = "600";

      sim.appendChild(simStatus);

      if (simulation.gasEstimate) {
        const gas = document.createElement("div");

        gas.textContent = `Gas estimate: ${simulation.gasEstimate}`;

        Object.assign(gas.style, {
          marginTop: "7px",

          color: UI.muted,

          fontSize: "10px",

          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        });

        sim.appendChild(gas);
      }

      body.appendChild(createSection("SIMULATION", sim));
    }

    /*
     * Explanation
     */

    const explanation = security?.explanation ?? {};

    const primaryReason =
      typeof explanation.summary === "string" && explanation.summary.trim() ? explanation.summary.trim() : Array.isArray(security?.reasons) && security.reasons.length ? security.reasons[0] : getFallbackSummary(security, decision);

    const details = dedupe([
      ...(Array.isArray(explanation.details) ? explanation.details : []),

      ...(Array.isArray(explanation.reasons) ? explanation.reasons : []),

      ...(decision !== "ALLOW" && Array.isArray(security?.reasons) ? security.reasons : []),
    ]).filter((item) => item !== primaryReason);

    const explanationBox = document.createElement("div");

    const primary = document.createElement("div");

    primary.textContent = primaryReason;

    Object.assign(primary.style, {
      fontSize: "16px",

      lineHeight: "1.6",

      color: UI.text,

      letterSpacing: "-.01em",
    });

    explanationBox.appendChild(primary);

    if (details.length) {
      const list = document.createElement("div");

      list.style.marginTop = "14px";

      details.slice(0, 5).forEach((item) => {
        const row = document.createElement("div");

        row.textContent = `• ${item}`;

        Object.assign(row.style, {
          marginBottom: "7px",

          color: UI.soft,

          fontSize: "12px",

          lineHeight: "1.55",
        });

        list.appendChild(row);
      });

      explanationBox.appendChild(list);
    }

    body.appendChild(createSection(decision === "BLOCK" ? "WHY NALAR STOPPED IT" : "NALAR'S READING", explanationBox));

    /*
     * Scam intelligence
     */

    const reports = Array.isArray(security?.scamAnalyses) ? security.scamAnalyses : Array.isArray(security?.transactionScamContext?.analyses) ? security.transactionScamContext.analyses : [];

    if (reports.length) {
      body.appendChild(createScamSection(reports));
    }

    /*
     * Technical details
     */

    body.appendChild(createTechnicalSection(security));

    /*
     * Footer
     */

    const footer = document.createElement("footer");

    Object.assign(footer.style, {
      padding: "18px 26px 24px",

      borderTop: `1px solid ${UI.border}`,

      flex: "0 0 auto",
    });

    const note = document.createElement("div");

    note.textContent = getFooterNote(decision);

    Object.assign(note.style, {
      marginBottom: "13px",

      color: UI.muted,

      fontSize: "10px",

      lineHeight: "1.5",
    });

    const actions = document.createElement("div");

    Object.assign(actions.style, {
      display: "grid",

      gridTemplateColumns: decision === "BLOCK" ? "1fr" : "120px 1fr",

      gap: "8px",
    });

    const cancel = createButton(decision === "BLOCK" ? "Close" : "Cancel", false);

    cancel.onclick = () => {
      overlay.remove();

      if (onCancel) {
        onCancel();
      }
    };

    actions.appendChild(cancel);

    if (decision !== "BLOCK") {
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

    modal.appendChild(header);

    modal.appendChild(body);

    modal.appendChild(footer);

    overlay.appendChild(modal);

    document.documentElement.appendChild(overlay);
  }

  /*
  |--------------------------------------------------------------------------
  | Scam intelligence UI
  |--------------------------------------------------------------------------
  */

  function createScamSection(reports) {
    const wrapper = document.createElement("div");

    reports.forEach((analysis) => {
      const card = document.createElement("div");

      Object.assign(card.style, {
        marginTop: "10px",

        padding: "15px",

        border: `1px solid ${UI.border}`,

        borderRadius: "11px",

        background: UI.surface,
      });

      const head = document.createElement("div");

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
      });

      head.appendChild(token);

      head.appendChild(badge);

      card.appendChild(head);

      const findings = Array.isArray(analysis?.findings) ? analysis.findings : [];

      if (findings.length) {
        const findingList = document.createElement("div");

        findingList.style.marginTop = "13px";

        findings.slice(0, 5).forEach((finding) => {
          const row = document.createElement("div");

          const severity = String(finding?.severity ?? "INFO").toUpperCase();

          row.textContent = finding?.title ?? finding?.code ?? "Security finding";

          Object.assign(row.style, {
            padding: "6px 0",

            fontSize: "12px",

            lineHeight: "1.5",

            color: severity === "CRITICAL" || severity === "HIGH" ? UI.danger : severity === "MEDIUM" ? UI.warning : UI.soft,
          });

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

            padding: "5px 0",

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

          row.appendChild(label);

          row.appendChild(value);

          state.appendChild(row);
        });

        card.appendChild(state);
      }

      if (analysis?.agentAnalysis?.available === true) {
        const source = document.createElement("div");

        Object.assign(source.style, {
          marginTop: "13px",

          paddingTop: "11px",

          borderTop: `1px solid ${UI.border}`,

          display: "flex",

          justifyContent: "space-between",

          alignItems: "center",
        });

        const label = document.createElement("span");

        label.textContent = "BNB Intelligence";

        label.style.color = UI.muted;

        label.style.fontSize = "10px";

        const evidence = document.createElement("span");

        evidence.textContent = "ON-CHAIN EVIDENCE";

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

    return createSection("SCAM INTELLIGENCE", wrapper);
  }

  /*
  |--------------------------------------------------------------------------
  | Technical details
  |--------------------------------------------------------------------------
  */

  function createTechnicalSection(security) {
    const wrapper = document.createElement("details");

    Object.assign(wrapper.style, {
      padding: "17px 0",

      borderBottom: `1px solid ${UI.border}`,
    });

    const summary = document.createElement("summary");

    summary.textContent = "Technical details";

    Object.assign(summary.style, {
      cursor: "pointer",

      color: UI.soft,

      fontSize: "11px",

      userSelect: "none",
    });

    wrapper.appendChild(summary);

    const content = document.createElement("div");

    content.style.marginTop = "13px";

    const actual = security?.actual ?? {};

    const tx = security?.transactionSummary ?? {};

    const rows = [
      ["Action", humanizeAction(actual.action)],
      ["Function", actual.functionName ?? "N/A"],
      ["Intent match", typeof security?.intentMatch === "boolean" ? (security.intentMatch ? "Matched" : "Mismatch") : "Unknown"],
      ["Target", tx.target ? formatAddress(tx.target) : "N/A"],
    ];

    rows.forEach(([label, value]) => {
      const row = document.createElement("div");

      Object.assign(row.style, {
        display: "flex",

        justifyContent: "space-between",

        gap: "12px",

        padding: "5px 0",
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

      background: "rgba(0,0,0,.72)",

      backdropFilter: "blur(8px)",

      WebkitBackdropFilter: "blur(8px)",

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

      borderRadius: "16px",

      background: UI.bg,

      color: UI.text,

      boxShadow: "0 34px 110px rgba(0,0,0,.54), 0 1px 0 rgba(255,255,255,.035) inset",
    });

    return modal;
  }

  function createLabel(text) {
    const label = document.createElement("div");

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

    button.className = "nalar-button";

    button.type = "button";

    button.textContent = label;

    Object.assign(button.style, {
      minHeight: "44px",

      padding: "0 14px",

      border: `1px solid ${primary ? UI.text : UI.borderStrong}`,

      borderRadius: "9px",

      background: primary ? UI.text : UI.surface,

      color: primary ? UI.bg : UI.text,

      fontSize: "12px",

      fontWeight: "650",

      cursor: "pointer",
    });

    return button;
  }

  function getDecisionStatus(decision) {
    switch (decision) {
      case "BLOCK":
        return {
          title: "Transaction blocked",

          label: "Nalar stopped the request before signing.",
        };

      case "REVIEW":
        return {
          title: "Review transaction",

          label: "Nalar found conditions that deserve your attention.",
        };

      default:
        return {
          title: "Transaction cleared",

          label: "Nalar found no blocking security condition.",
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
