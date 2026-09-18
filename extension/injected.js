(() => {
  "use strict";

  /**
   * ============================================================
   * NALAR PROTOCOL / TXSENTRY
   * ============================================================
   *
   * Browser-side transaction security interceptor.
   *
   * Flow:
   *
   * DApp
   *   ↓
   * Wallet provider
   *   ↓
   * Nalar interception
   *   ↓
   * User intent
   *   ↓
   * Extension bridge
   *   ↓
   * Backend security-check
   *   ↓
   * ALLOW / REVIEW / BLOCK
   *   ↓
   * Wallet
   */

  if (window.__NALAR_TXSENTRY_INSTALLED__) {
    return;
  }

  window.__NALAR_TXSENTRY_INSTALLED__ = true;

  let requestId = 0;

  const IDS = {
    intent: "__nalar_intent_overlay__",
    decision: "__nalar_decision_overlay__",
    banner: "__nalar_banner__",
  };

  const UI = {
    background: "#121311",
    surface: "#191b18",
    surfaceRaised: "#20231f",

    border: "#30332f",
    borderStrong: "#454941",

    text: "#f1f0e9",
    textSecondary: "#b8b8ae",
    textMuted: "#7d8078",
    textDim: "#5c6059",

    white: "#f1f0e9",
    black: "#121311",
    accent: "#d47c5d",
    safe: "#a9c4a3",
    review: "#e0bb78",
    danger: "#dd806d",
  };

  function installOverlayStyles() {
    if (document.getElementById("__nalar_overlay_styles__")) {
      return;
    }

    const style = document.createElement("style");

    style.id = "__nalar_overlay_styles__";

    style.textContent = `
      @keyframes nalar-overlay-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes nalar-modal-in {
        from { opacity: 0; transform: translateY(12px) scale(.985); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      @keyframes nalar-scan {
        0%, 100% { opacity: .45; transform: scale(.9); }
        50% { opacity: 1; transform: scale(1); }
      }

      .nalar-overlay {
        animation: nalar-overlay-in 180ms ease-out both;
      }

      .nalar-modal {
        animation: nalar-modal-in 360ms cubic-bezier(.16, 1, .3, 1) both;
        border-radius: 14px !important;
        background: ${UI.background} !important;
        border-color: ${UI.borderStrong} !important;
        box-shadow: 0 28px 90px rgba(0, 0, 0, .48), 0 2px 0 rgba(255, 255, 255, .035) inset !important;
      }

      .nalar-decision-overlay,
      .nalar-intent-overlay,
      .nalar-analysis-overlay {
        padding: 18px !important;
        background: rgba(8, 9, 8, .78) !important;
        backdrop-filter: blur(8px) saturate(.8) !important;
        -webkit-backdrop-filter: blur(8px) saturate(.8) !important;
      }

      .nalar-decision-header {
        display: grid !important;
        grid-template-columns: 42px minmax(0, 1fr) auto !important;
        align-items: center !important;
        gap: 13px !important;
        padding: 22px 24px 20px !important;
        border-bottom-color: ${UI.border} !important;
      }

      .nalar-decision-mark {
        display: grid;
        place-items: center;
        width: 42px;
        height: 42px;
        border: 1px solid ${UI.borderStrong};
        border-radius: 10px;
        background: ${UI.surfaceRaised};
        color: ${UI.text};
        font-size: 19px;
        font-weight: 700;
      }

      .nalar-decision-header-text { min-width: 0; }
      .nalar-decision-header h2 { margin-top: 8px !important; font-size: 23px !important; }
      .nalar-decision-state { margin-top: 6px !important; color: ${UI.textSecondary} !important; }

      .nalar-decision-risk {
        min-width: 104px !important;
        padding: 10px 12px !important;
        border-radius: 9px !important;
        background: ${UI.surface} !important;
        text-align: left !important;
      }

      .nalar-decision-risk-value {
        margin-top: 5px;
        color: ${UI.text} !important;
        font-size: 14px !important;
        font-weight: 700 !important;
      }

      .nalar-decision-risk-score {
        margin-top: 4px;
        color: ${UI.textMuted} !important;
        font-size: 10px !important;
      }

      .nalar-decision-overlay[data-decision="block"] .nalar-decision-mark,
      .nalar-decision-overlay[data-decision="block"] .nalar-decision-risk-value { color: ${UI.danger} !important; }

      .nalar-decision-overlay[data-decision="review"] .nalar-decision-mark,
      .nalar-decision-overlay[data-decision="review"] .nalar-decision-risk-value { color: ${UI.review} !important; }

      .nalar-decision-overlay[data-decision="allow"] .nalar-decision-mark,
      .nalar-decision-overlay[data-decision="allow"] .nalar-decision-risk-value { color: ${UI.safe} !important; }

      .nalar-decision-body { padding: 0 24px !important; }

      .nalar-section {
        padding: 18px 0 !important;
        border-bottom-color: ${UI.border} !important;
      }

      .nalar-section-label {
        margin-bottom: 10px !important;
        color: ${UI.textMuted} !important;
        font-size: 9px !important;
        letter-spacing: .13em !important;
      }

      .nalar-text-block { color: ${UI.text} !important; font-size: 14px !important; }
      .nalar-decision-summary { color: ${UI.text} !important; font-size: 14px !important; }
      .nalar-decision-detail { color: ${UI.textSecondary} !important; }
      .nalar-finding[data-severity="critical"],
      .nalar-finding[data-severity="high"] { color: ${UI.danger} !important; }
      .nalar-finding[data-severity="medium"] { color: ${UI.review} !important; }
      .nalar-simulation-result { color: ${UI.text} !important; font-size: 13px !important; }
      .nalar-simulation-meta { margin-top: 7px; color: ${UI.textMuted}; font-size: 11px; }
      .nalar-simulation[data-success="false"] .nalar-simulation-result { color: ${UI.danger} !important; }
      .nalar-intent-match {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin-top: 14px;
        padding-top: 12px;
        border-top: 1px solid ${UI.border};
        color: ${UI.textMuted};
        font-size: 11px;
      }
      .nalar-intent-match strong { font-weight: 650; }
      .nalar-intent-match[data-match="true"] strong { color: ${UI.safe}; }
      .nalar-intent-match[data-match="false"] strong { color: ${UI.danger}; }
      .nalar-evidence-card {
        margin-top: 11px !important;
        padding: 15px !important;
        border-color: ${UI.border} !important;
        border-radius: 10px !important;
        background: ${UI.surface} !important;
      }

      .nalar-evidence-card > div { border-top-color: ${UI.border} !important; }
      .nalar-evidence-card .nalar-evidence-badge { color: ${UI.textSecondary} !important; border-color: ${UI.borderStrong} !important; }
      .nalar-evidence-heading { color: ${UI.text} !important; }

      .nalar-decision-footer { padding: 18px 24px 24px !important; }
      .nalar-decision-note { color: ${UI.textMuted} !important; }
      .nalar-decision-actions { gap: 9px !important; }

      .nalar-button {
        min-height: 44px !important;
        border-radius: 8px !important;
        border-color: ${UI.borderStrong} !important;
        background: ${UI.background} !important;
        color: ${UI.text} !important;
        transition: transform 150ms ease, border-color 150ms ease, background 150ms ease !important;
      }

      .nalar-button.nalar-button-primary {
        border-color: ${UI.text} !important;
        background: ${UI.text} !important;
        color: ${UI.black} !important;
      }

      .nalar-button:hover { border-color: ${UI.accent} !important; }
      .nalar-button:active { transform: translateY(1px); }
      .nalar-button:focus-visible { outline: 2px solid ${UI.accent}; outline-offset: 3px; }

      .nalar-intent-modal { width: min(540px, 100%) !important; }
      .nalar-intent-header { padding: 24px 24px 20px !important; border-bottom-color: ${UI.border} !important; }
      .nalar-intent-body { padding: 22px 24px 20px !important; }
      .nalar-intent-footer { padding: 0 24px 24px !important; }
      .nalar-intent-origin,
      .nalar-intent-textarea { background: ${UI.surface} !important; border-color: ${UI.border} !important; border-radius: 9px !important; }
      .nalar-intent-textarea:focus { border-color: ${UI.accent} !important; box-shadow: 0 0 0 3px rgba(212, 124, 93, .12); }

      .nalar-analysis-modal { width: min(480px, 100%) !important; padding: 25px !important; }
      .nalar-analysis-step { padding: 9px 0 !important; color: ${UI.textSecondary} !important; }
      .nalar-analysis-indicator { color: ${UI.textMuted} !important; transition: color 180ms ease, background 180ms ease; }
      .nalar-analysis-step[data-state="active"] .nalar-analysis-indicator { color: ${UI.accent} !important; animation: nalar-scan 1.1s ease-in-out infinite; }
      .nalar-analysis-step[data-state="done"] .nalar-analysis-indicator { color: ${UI.safe} !important; }

      @media (max-width: 640px) {
        .nalar-overlay { align-items: flex-end !important; padding: 10px !important; }
        .nalar-modal { width: 100% !important; max-height: calc(100vh - 20px) !important; border-radius: 14px 14px 10px 10px !important; }
        .nalar-decision-header { grid-template-columns: 38px minmax(0, 1fr) !important; padding: 20px !important; }
        .nalar-decision-mark { width: 38px; height: 38px; }
        .nalar-decision-risk { grid-column: 2; min-width: 0 !important; width: max-content; }
        .nalar-decision-body { padding: 0 20px !important; }
        .nalar-decision-footer { padding: 17px 20px 20px !important; }
        .nalar-decision-actions { grid-template-columns: 1fr !important; }
        .nalar-intent-header { padding: 21px 20px 18px !important; }
        .nalar-intent-body { padding: 20px 20px 18px !important; }
        .nalar-intent-footer { padding: 0 20px 20px !important; }
        .nalar-intent-actions { grid-template-columns: 1fr !important; }
      }

      @media (prefers-reduced-motion: reduce) {
        .nalar-overlay, .nalar-modal, .nalar-analysis-step[data-state="active"] .nalar-analysis-indicator { animation: none !important; }
        .nalar-button { transition: none !important; }
      }
    `;

    document.documentElement.appendChild(style);
  }

  const wrappedProviders = new WeakSet();

  /**
   * ============================================================
   * BASIC ACCESS
   * ============================================================
   */

  function getEthereum() {
    return window.ethereum;
  }

  function removeElement(id) {
    const element = document.getElementById(id);

    if (element) {
      element.remove();
    }
  }

  /**
   * ============================================================
   * STATUS BANNER
   * ============================================================
   */

  function showNalarMessage(message) {
    removeElement(IDS.banner);
    installOverlayStyles();

    const banner = document.createElement("div");

    banner.id = IDS.banner;
    banner.className = "nalar-status-banner";

    Object.assign(banner.style, {
      position: "fixed",
      left: "50%",
      bottom: "22px",
      transform: "translateX(-50%)",

      zIndex: "2147483647",

      width: "auto",
      maxWidth: "calc(100vw - 32px)",

      padding: "10px 14px",

      background: UI.surfaceRaised,
      color: UI.text,

      border: `1px solid ${UI.borderStrong}`,
      borderRadius: "7px",

      boxShadow: "0 16px 40px rgba(0,0,0,.35)",

      fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",

      fontSize: "12px",
      lineHeight: "1.4",
      fontWeight: "500",

      pointerEvents: "none",
    });

    banner.textContent = message;

    document.documentElement.appendChild(banner);

    setTimeout(() => {
      banner.remove();
    }, 2600);
  }

  /**
   * ============================================================
   * PROVIDER WRAPPER
   * ============================================================
   */

  function wrapProvider(provider, label = "unknown") {
    if (!provider || typeof provider.request !== "function") {
      return false;
    }

    if (wrappedProviders.has(provider)) {
      return true;
    }

    const originalRequest = provider.request.bind(provider);

    const wrappedRequest = async function (args) {
      console.log("[Nalar] PROVIDER REQUEST:", label, args?.method);

      if (!args || args.method !== "eth_sendTransaction") {
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

    try {
      if (provider.request !== wrappedRequest) {
        console.warn("[Nalar] Provider request could not be replaced:", label);

        return false;
      }
    } catch {
      return false;
    }

    wrappedProviders.add(provider);

    console.info(`[Nalar] Provider wrapped: ${label}`);

    return true;
  }

  /**
   * ============================================================
   * EIP-6963
   * ============================================================
   */

  function installEip6963() {
    window.addEventListener("eip6963:announceProvider", handleEip6963Provider);

    window.dispatchEvent(new Event("eip6963:requestProvider"));

    console.info("[Nalar] EIP-6963 provider discovery enabled.");
  }

  function handleEip6963Provider(event) {
    const detail = event?.detail;

    const provider = detail?.provider;

    if (!provider) {
      return;
    }

    const walletName = detail?.info?.name ?? detail?.info?.rdns ?? "Unknown Wallet";

    wrapProvider(provider, `EIP-6963:${walletName}`);
  }

  /**
   * ============================================================
   * DIRECT PROVIDERS
   * ============================================================
   */

  function installDirectProviders() {
    let wrapped = false;

    if (wrapProvider(window.ethereum, "window.ethereum")) {
      wrapped = true;
    }

    if (wrapProvider(window.rabby, "window.rabby")) {
      wrapped = true;
    }

    return wrapped;
  }

  /**
   * ============================================================
   * TRANSACTION INTERCEPTOR
   * ============================================================
   */

  async function handleTransactionRequest({ originalRequest, args, providerLabel }) {
    const protectionEnabled = await getProtectionStatus();

    console.info("[Nalar] Protection status:", {
      provider: providerLabel,
      enabled: protectionEnabled,
    });

    if (!protectionEnabled) {
      showNalarMessage("Nalar protection is paused. The transaction will be sent directly to your wallet.");

      console.warn(
        "[Nalar] Protection is PAUSED. Forwarding transaction directly.",
        providerLabel,
      );

      return originalRequest(args);
    }

    const transaction = args.params?.[0];

    if (!transaction) {
      throw new Error("[Nalar] Missing transaction request.");
    }

    if (!transaction.to) {
      throw new Error("[Nalar] Transaction target is missing.");
    }

    /**
     * ----------------------------------------------------------
     * INTENT
     * ----------------------------------------------------------
     */

    const storedIntent = await getStoredIntent();

    const confirmedIntent = await showIntentOverlay(storedIntent);

    if (typeof confirmedIntent !== "string" || !confirmedIntent.trim()) {
      throw new Error("[Nalar] Transaction cancelled because no intent was provided.");
    }

    const intent = confirmedIntent.trim();

    await saveIntent(intent);

    /**
     * ----------------------------------------------------------
     * CHAIN
     * ----------------------------------------------------------
     */

    const chainId = await originalRequest({
      method: "eth_chainId",
    });

    const id = ++requestId;

    const analysisOverlay = showAnalysisOverlay();

    /**
     * ----------------------------------------------------------
     * SECURITY CHECK
     * ----------------------------------------------------------
     */

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();

        reject(new Error("[Nalar] Security check timed out."));
      }, 30_000);

      function cleanup() {
        clearTimeout(timeout);

        window.removeEventListener("message", handleMessage);

        analysisOverlay?.remove();
      }

      /**
       * ------------------------------------------------------
       * CONTINUE TO WALLET
       * ------------------------------------------------------
       */

      async function continueToWallet() {
        showNalarMessage("Security check complete. Opening wallet.");

        try {
          const result = await originalRequest({
            ...args,

            params: [
              {
                ...transaction,
                from: transaction.from,
              },
            ],
          });

          resolve(result);
        } catch (error) {
          reject(error);
        }
      }

      /**
       * ------------------------------------------------------
       * CANCEL
       * ------------------------------------------------------
       */

      function cancelTransaction(message) {
        reject(new Error(message ?? "[Nalar] Transaction cancelled by user."));
      }

      /**
       * ------------------------------------------------------
       * SECURITY RESPONSE
       * ------------------------------------------------------
       */

      function handleMessage(event) {
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

        cleanup();

        const security = message.security;

        if (!security) {
          reject(new Error("[Nalar] Invalid security response."));

          return;
        }

        /**
         * BLOCK
         *
         * CRITICAL:
         * Never call wallet.
         */

        if (security.decision === "BLOCK") {
          showDecisionOverlay(security, "BLOCK", null, () => {
            cancelTransaction("[Nalar] Transaction blocked by the security policy.");
          });

          return;
        }

        /**
         * REVIEW
         */

        if (security.decision === "REVIEW") {
          showDecisionOverlay(security, "REVIEW", continueToWallet, () => {
            cancelTransaction("[Nalar] Transaction cancelled during review.");
          });

          return;
        }

        /**
         * ALLOW
         */

        showDecisionOverlay(security, "ALLOW", continueToWallet, () => {
          cancelTransaction("[Nalar] Transaction cancelled by user.");
        });
      }

      /**
       * Register listener before sending request.
       */

      window.addEventListener("message", handleMessage);

      window.postMessage(
        {
          source: "NALAR_PAGE",
          type: "TX_REQUEST",
          id,
          chainId,
          transaction,
        },
        "*",
      );
    });
  }

  /**
   * ============================================================
   * DECISION OVERLAY
   * ============================================================
   */

  function showDecisionOverlay(security, decision, onContinue, onCancel) {
    removeElement(IDS.decision);
    installOverlayStyles();

    const overlay = document.createElement("div");

    overlay.id = IDS.decision;
    overlay.className = "nalar-overlay nalar-decision-overlay";
    overlay.dataset.decision = decision.toLowerCase();

    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",

      zIndex: "2147483647",

      display: "flex",
      alignItems: "center",
      justifyContent: "center",

      padding: "20px",

      background: "rgba(0,0,0,.76)",

      backdropFilter: "blur(3px)",
      WebkitBackdropFilter: "blur(3px)",

      fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",

      boxSizing: "border-box",
    });

    const modal = document.createElement("div");
    modal.className = "nalar-modal nalar-decision-modal";

    Object.assign(modal.style, {
      width: "min(560px, 100%)",

      maxHeight: "calc(100vh - 40px)",

      overflowY: "auto",

      background: UI.background,
      color: UI.text,

      border: `1px solid ${UI.borderStrong}`,

      borderRadius: "10px",

      boxShadow: "0 26px 80px rgba(0,0,0,.5)",

      boxSizing: "border-box",
    });

    const explanation = security?.explanation ?? {};

    const txSummary = security?.transactionSummary ?? {};

    const intent = security?.intent?.description ?? "No intent description available.";

    const action = security?.actual?.action ?? "UNKNOWN";

    const functionName = security?.actual?.functionName ?? null;

    const riskLevel = security?.riskLevel ?? "UNKNOWN";

    const riskScore = security?.riskScore ?? 0;

    /**
     * IMPORTANT:
     * Single declaration only.
     *
     * Prefer scamAnalyses from backend.
     * Fallback to transactionScamContext.analyses.
     */

    const tokenReports = Array.isArray(security?.scamAnalyses) ? security.scamAnalyses : Array.isArray(security?.transactionScamContext?.analyses) ? security.transactionScamContext.analyses : [];

    const status = getDecisionStatus(decision);

    const title = decision === "BLOCK" ? "Transaction blocked" : decision === "REVIEW" ? "Review required" : decision === "ALLOW" ? "Transaction allowed" : (explanation.title ?? status.title);

    const explanationSummary = explanation.summary ?? getFallbackSummary(security, decision);

    const explanationDetails = Array.isArray(explanation.details) ? explanation.details : [];

    const reasons = dedupe([
      ...(Array.isArray(security?.reasons) ? security.reasons : []),

      ...(Array.isArray(security?.comparison?.mismatches) ? security.comparison.mismatches : []),

      ...(Array.isArray(security?.policy?.evaluation?.reasons) ? security.policy.evaluation.reasons : []),
    ]);

    const summaryTitle = txSummary.title ?? txSummary.action ?? humanizeAction(action);

    const summaryDescription = txSummary.description ?? "Nalar analyzed this transaction before signing.";

    const summaryDetails = Array.isArray(txSummary.details) ? txSummary.details : [];

    const valueNative = txSummary.valueNative ?? null;

    const target = txSummary.target ?? null;

    /**
     * ----------------------------------------------------------
     * HEADER
     * ----------------------------------------------------------
     */

    const header = document.createElement("header");
    header.className = "nalar-decision-header";

    Object.assign(header.style, {
      padding: "20px 22px 17px",

      borderBottom: "1px solid #222222",

      display: "flex",

      justifyContent: "space-between",

      alignItems: "flex-start",

      gap: "18px",
    });

    const headerText = document.createElement("div");
    headerText.className = "nalar-decision-header-text";

    const decisionMark = document.createElement("div");
    decisionMark.className = "nalar-decision-mark";
    decisionMark.textContent = decision === "BLOCK" ? "!" : decision === "REVIEW" ? "?" : "✓";
    decisionMark.setAttribute("aria-hidden", "true");

    const eyebrow = document.createElement("div");

    eyebrow.textContent = "NALAR PROTOCOL";

    Object.assign(eyebrow.style, {
      fontSize: "9px",

      letterSpacing: ".16em",

      color: UI.textMuted,

      fontWeight: "600",

      lineHeight: "1",
    });

    const heading = document.createElement("h2");

    heading.textContent = title;

    Object.assign(heading.style, {
      margin: "10px 0 0",

      fontSize: "24px",

      lineHeight: "1.15",

      letterSpacing: "-.025em",

      fontWeight: "600",

      color: UI.text,
    });

    const state = document.createElement("div");
    state.className = "nalar-decision-state";

    state.textContent = status.label;

    Object.assign(state.style, {
      marginTop: "7px",

      fontSize: "12px",

      lineHeight: "1.4",

      color: UI.textSecondary,
    });

    headerText.appendChild(eyebrow);

    headerText.appendChild(heading);

    headerText.appendChild(state);

    /**
     * ----------------------------------------------------------
     * RISK
     * ----------------------------------------------------------
     */

    const risk = document.createElement("div");
    risk.className = "nalar-decision-risk";

    Object.assign(risk.style, {
      flex: "0 0 auto",

      minWidth: "92px",

      padding: "9px 10px",

      border: `1px solid ${UI.border}`,

      borderRadius: "7px",

      textAlign: "right",
    });

    const riskLabel = document.createElement("div");

    riskLabel.textContent = "RISK";

    Object.assign(riskLabel.style, {
      fontSize: "8px",

      letterSpacing: ".12em",

      color: UI.textMuted,

      fontWeight: "600",
    });

    const riskValue = document.createElement("div");

    riskValue.className = "nalar-decision-risk-value";
    riskValue.textContent = riskLevel;

    Object.assign(riskValue.style, {
      marginTop: "5px",

      fontSize: "12px",

      lineHeight: "1",

      fontWeight: "650",

      color: UI.text,
    });

    risk.appendChild(riskLabel);

    risk.appendChild(riskValue);

    const riskScoreValue = document.createElement("div");
    riskScoreValue.className = "nalar-decision-risk-score";
    riskScoreValue.textContent = `${riskScore}/100`;
    risk.appendChild(riskScoreValue);

    header.appendChild(decisionMark);
    header.appendChild(headerText);

    header.appendChild(risk);

    /**
     * ----------------------------------------------------------
     * BODY
     * ----------------------------------------------------------
     */

    const body = document.createElement("main");
    body.className = "nalar-decision-body";

    Object.assign(body.style, {
      padding: "0 22px",
    });

    /**
     * USER REQUEST
     */

    body.appendChild(createSection("YOUR REQUEST", createTextBlock(intent)));

    /**
     * ACTUAL TRANSACTION
     */

    const actionContent = document.createElement("div");

    const actionName = document.createElement("div");

    actionName.textContent = summaryTitle;

    Object.assign(actionName.style, {
      fontSize: "16px",

      lineHeight: "1.3",

      fontWeight: "600",

      color: UI.text,
    });

    actionContent.appendChild(actionName);

    const actionBody = document.createElement("div");

    actionBody.textContent = summaryDescription;

    Object.assign(actionBody.style, {
      marginTop: "7px",

      fontSize: "13px",

      lineHeight: "1.6",

      color: UI.textSecondary,
    });

    actionContent.appendChild(actionBody);

    if (valueNative) {
      const value = document.createElement("div");

      value.textContent = `Value  ${valueNative} BNB`;

      Object.assign(value.style, {
        marginTop: "11px",

        paddingTop: "10px",

        borderTop: "1px solid #202020",

        fontSize: "11px",

        color: UI.textMuted,
      });

      actionContent.appendChild(value);
    }

    if (summaryDetails.length > 0) {
      const details = document.createElement("div");

      Object.assign(details.style, {
        marginTop: "12px",

        paddingTop: "11px",

        borderTop: "1px solid #202020",
      });

      summaryDetails.slice(0, 5).forEach((detail) => {
        const row = document.createElement("div");

        row.textContent = detail;

        Object.assign(row.style, {
          marginBottom: "6px",

          fontSize: "12px",

          lineHeight: "1.5",

          color: UI.textMuted,
        });

        details.appendChild(row);
      });

      actionContent.appendChild(details);
    }

    if (target) {
      const targetElement = document.createElement("div");

      targetElement.textContent = `Target  ${formatAddress(target)}`;

      Object.assign(targetElement.style, {
        marginTop: "12px",

        paddingTop: "11px",

        borderTop: "1px solid #202020",

        fontSize: "10px",

        lineHeight: "1.4",

        color: UI.textDim,

        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",

        wordBreak: "break-all",
      });

      actionContent.appendChild(targetElement);
    }

    if (typeof security?.intentMatch === "boolean") {
      const match = document.createElement("div");
      match.className = "nalar-intent-match";
      match.dataset.match = String(security.intentMatch);

      const matchLabel = document.createElement("span");
      matchLabel.textContent = "Intent check";

      const matchValue = document.createElement("strong");
      matchValue.textContent = security.intentMatch ? "Matches your request" : "Needs your attention";

      match.appendChild(matchLabel);
      match.appendChild(matchValue);
      actionContent.appendChild(match);
    }

    body.appendChild(createSection("WHAT WILL HAPPEN", actionContent));

    const simulation = security?.simulation;

    if (simulation && typeof simulation.success === "boolean") {
      const simulationContent = document.createElement("div");
      simulationContent.className = "nalar-simulation";
      simulationContent.dataset.success = String(simulation.success);

      const simulationResult = document.createElement("div");
      simulationResult.className = "nalar-simulation-result";
      simulationResult.textContent = simulation.success
        ? "The request completed in simulation."
        : "The request could not complete in simulation.";
      simulationContent.appendChild(simulationResult);

      if (simulation.gasEstimate) {
        const gas = document.createElement("div");
        gas.className = "nalar-simulation-meta";
        gas.textContent = `Estimated network fee: ${String(simulation.gasEstimate)}`;
        simulationContent.appendChild(gas);
      }

      body.appendChild(createSection("SIMULATION", simulationContent));
    }

    /**
     * ----------------------------------------------------------
     * EXPLANATION
     * ----------------------------------------------------------
     */

    const explanationContent = document.createElement("div");

    const explanationMain = document.createElement("div");

    explanationMain.className = "nalar-decision-summary";
    explanationMain.textContent = explanationSummary;

    Object.assign(explanationMain.style, {
      fontSize: "14px",

      lineHeight: "1.7",

      color: "#d5d5d5",
    });

    explanationContent.appendChild(explanationMain);

    const usefulDetails = dedupe([...explanationDetails, ...(decision !== "ALLOW" ? reasons : [])]);

    if (usefulDetails.length > 0) {
      const list = document.createElement("div");

      Object.assign(list.style, {
        marginTop: "13px",
      });

      usefulDetails.slice(0, 5).forEach((detail) => {
        const row = document.createElement("div");
        row.className = "nalar-decision-detail";

        row.textContent = `• ${detail}`;

        Object.assign(row.style, {
          marginBottom: "7px",

          fontSize: "12px",

          lineHeight: "1.55",

          color: UI.textSecondary,
        });

        list.appendChild(row);
      });

      explanationContent.appendChild(list);
    }

    body.appendChild(createSection(decision === "BLOCK" ? "WHY NALAR STOPPED IT" : "NALAR'S READING", explanationContent));

    /**
     * ----------------------------------------------------------
     * SCAM INTELLIGENCE
     * ----------------------------------------------------------
     */

    if (tokenReports.length > 0) {
      body.appendChild(createScamIntelligenceSection(tokenReports));
    }

    /**
     * ----------------------------------------------------------
     * TECHNICAL REFERENCE
     * ----------------------------------------------------------
     */

    if (functionName || action !== "UNKNOWN") {
      const technical = document.createElement("div");

      Object.assign(technical.style, {
        padding: "13px 0 16px",

        fontSize: "10px",

        lineHeight: "1.5",

        color: UI.textDim,
      });

      technical.textContent = functionName ? `Transaction type  ${humanizeAction(action)}  ·  ${functionName}` : `Transaction type  ${humanizeAction(action)}`;

      body.appendChild(technical);
    }

    /**
     * ----------------------------------------------------------
     * FOOTER
     * ----------------------------------------------------------
     */

    const footer = document.createElement("footer");
    footer.className = "nalar-decision-footer";

    Object.assign(footer.style, {
      padding: "0 22px 21px",
    });

    const note = document.createElement("div");
    note.className = "nalar-decision-note";

    note.textContent = getFooterNote(decision);

    Object.assign(note.style, {
      marginBottom: "14px",

      fontSize: "10px",

      lineHeight: "1.5",

      color: UI.textDim,
    });

    footer.appendChild(note);

    const actions = document.createElement("div");
    actions.className = "nalar-decision-actions";

    Object.assign(actions.style, {
      display: "grid",

      gridTemplateColumns: decision === "BLOCK" ? "1fr" : "130px 1fr",

      gap: "8px",
    });

    const cancel = document.createElement("button");

    cancel.textContent = decision === "BLOCK" ? "Close" : "Cancel";

    styleButton(cancel, false);

    cancel.addEventListener("click", () => {
      cleanupDecision();

      overlay.remove();

      if (onCancel) {
        onCancel();
      }
    });

    actions.appendChild(cancel);

    if (decision !== "BLOCK") {
      const continueButton = document.createElement("button");

      continueButton.textContent = decision === "ALLOW" ? "Continue to wallet" : "Continue anyway";

      styleButton(continueButton, true);

      continueButton.addEventListener("click", () => {
        cleanupDecision();

        overlay.remove();

        if (onContinue) {
          onContinue();
        }
      });

      actions.appendChild(continueButton);
    }

    footer.appendChild(actions);

    modal.appendChild(header);

    modal.appendChild(body);

    modal.appendChild(footer);

    overlay.appendChild(modal);

    document.documentElement.appendChild(overlay);

    function handleEscape(event) {
      if (event.key !== "Escape") {
        return;
      }

      cleanupDecision();

      overlay.remove();

      if (onCancel) {
        onCancel();
      }
    }

    function cleanupDecision() {
      document.removeEventListener("keydown", handleEscape);
    }

    document.addEventListener("keydown", handleEscape);
  }

  /**
   * ============================================================
   * SCAM INTELLIGENCE UI
   * ============================================================
   */

  function createScamIntelligenceSection(tokenReports) {
    const content = document.createElement("div");

    tokenReports.forEach((analysis) => {
      const card = document.createElement("div");
      card.className = "nalar-evidence-card";

      Object.assign(card.style, {
        marginTop: "10px",

        padding: "14px",

        border: `1px solid ${UI.border}`,

        borderRadius: "8px",

        background: "#070707",
      });

      /**
       * HEADER
       */

      const cardHeader = document.createElement("div");
      cardHeader.className = "nalar-evidence-heading";

      Object.assign(cardHeader.style, {
        display: "flex",

        justifyContent: "space-between",

        alignItems: "center",

        gap: "12px",
      });

      const tokenAddress = document.createElement("div");

      tokenAddress.textContent = formatAddress(analysis?.token ?? "Unknown token");

      Object.assign(tokenAddress.style, {
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",

        fontSize: "12px",

        fontWeight: "600",

        color: UI.text,
      });

      const risk = document.createElement("div");

      risk.textContent = `${analysis?.riskLevel ?? "UNKNOWN"} · ${analysis?.riskScore ?? 0}`;

      Object.assign(risk.style, {
        padding: "5px 7px",

        border: `1px solid ${UI.border}`,

        borderRadius: "6px",

        fontSize: "9px",

        fontWeight: "600",

        color: UI.textSecondary,

        whiteSpace: "nowrap",
      });

      cardHeader.appendChild(tokenAddress);

      cardHeader.appendChild(risk);

      card.appendChild(cardHeader);

      /**
       * FINDINGS
       */

      const findings = Array.isArray(analysis?.findings) ? analysis.findings : [];

      if (findings.length > 0) {
        const findingsContainer = document.createElement("div");

        Object.assign(findingsContainer.style, {
          marginTop: "13px",

          paddingTop: "12px",

          borderTop: "1px solid #202020",
        });

        findings.slice(0, 5).forEach((finding) => {
          const row = document.createElement("div");

          const severity = String(finding?.severity ?? "INFO").toUpperCase();

          row.className = "nalar-finding";
          row.dataset.severity = severity.toLowerCase();

          const marker = severity === "CRITICAL" || severity === "HIGH" ? "!" : "•";

          row.textContent = `${marker}  ${finding?.title ?? finding?.code ?? "Security finding"}`;

          Object.assign(row.style, {
            marginBottom: "7px",

            fontSize: "11px",

            lineHeight: "1.5",

            color: severity === "CRITICAL" ? UI.text : UI.textSecondary,
          });

          findingsContainer.appendChild(row);
        });

        card.appendChild(findingsContainer);
      }

      /**
       * ON-CHAIN STATE
       */

      const stateEntries = Array.isArray(analysis?.contractPrivileges?.state) ? analysis.contractPrivileges.state : [];

      if (stateEntries.length > 0) {
        const stateContainer = document.createElement("div");

        Object.assign(stateContainer.style, {
          marginTop: "13px",

          paddingTop: "12px",

          borderTop: "1px solid #202020",
        });

        const stateLabel = document.createElement("div");

        stateLabel.textContent = "ON-CHAIN STATE";

        Object.assign(stateLabel.style, {
          marginBottom: "9px",

          fontSize: "8px",

          letterSpacing: ".16em",

          color: UI.textMuted,

          fontWeight: "600",
        });

        stateContainer.appendChild(stateLabel);

        stateEntries.slice(0, 6).forEach((entry) => {
          const row = document.createElement("div");

          Object.assign(row.style, {
            display: "flex",

            justifyContent: "space-between",

            gap: "14px",

            marginBottom: "7px",

            fontSize: "11px",

            lineHeight: "1.45",
          });

          const label = document.createElement("span");

          label.textContent = entry?.label ?? entry?.code ?? "State";

          label.style.color = UI.textMuted;

          const value = document.createElement("span");

          value.style.color = UI.textSecondary;

          value.style.textAlign = "right";

          let displayValue = entry?.value ?? "Unknown";

          /**
           * Backend evidence stores
           * percent values in basis-like
           * integer form:
           *
           * 9800 => 98.00%
           */

          if (entry?.code === "CURRENT_SELL_TAX" && entry?.unit === "PERCENT") {
            const numeric = Number(displayValue);

            if (Number.isFinite(numeric)) {
              displayValue = `${(numeric / 100).toFixed(2)}%`;
            }
          }

          value.textContent = String(displayValue);

          row.appendChild(label);

          row.appendChild(value);

          stateContainer.appendChild(row);
        });

        card.appendChild(stateContainer);
      }

      /**
       * BNB INTELLIGENCE
       */

      if (analysis?.agentAnalysis?.available === true) {
        const source = document.createElement("div");

        Object.assign(source.style, {
          marginTop: "13px",

          paddingTop: "11px",

          borderTop: "1px solid #202020",

          display: "flex",

          justifyContent: "space-between",

          alignItems: "center",

          gap: "12px",
        });

        const label = document.createElement("div");

        label.textContent = "BNB Intelligence";

        Object.assign(label.style, {
          fontSize: "10px",

          color: UI.textMuted,
        });

      const badge = document.createElement("div");
        badge.className = "nalar-evidence-badge";

        badge.textContent = "ON-CHAIN EVIDENCE";

        Object.assign(badge.style, {
          padding: "5px 7px",

          border: `1px solid ${UI.border}`,

          borderRadius: "5px",

          fontSize: "8px",

          fontWeight: "600",

          letterSpacing: ".05em",

          color: UI.textSecondary,
        });

        source.appendChild(label);

        source.appendChild(badge);

        card.appendChild(source);
      }

      content.appendChild(card);
    });

    return createSection("ON-CHAIN EVIDENCE", content);
  }

  /**
   * ============================================================
   * INTENT OVERLAY
   * ============================================================
   */

  function showIntentOverlay(existingIntent = "") {
    return new Promise((resolve) => {
      removeElement(IDS.intent);
      installOverlayStyles();

      const overlay = document.createElement("div");

      overlay.id = IDS.intent;
      overlay.className = "nalar-overlay nalar-intent-overlay";

      Object.assign(overlay.style, {
        position: "fixed",

        inset: "0",

        zIndex: "2147483647",

        display: "flex",

        alignItems: "center",

        justifyContent: "center",

        padding: "20px",

        background: "rgba(0,0,0,.76)",

        backdropFilter: "blur(3px)",

        WebkitBackdropFilter: "blur(3px)",

        fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",

        boxSizing: "border-box",
      });

      const modal = document.createElement("div");
      modal.className = "nalar-modal nalar-intent-modal";

      Object.assign(modal.style, {
        width: "min(530px, 100%)",

        background: UI.background,

        color: UI.text,

        border: `1px solid ${UI.borderStrong}`,

        borderRadius: "10px",

        boxShadow: "0 26px 80px rgba(0,0,0,.5)",

        overflow: "hidden",

        boxSizing: "border-box",
      });

      const header = document.createElement("header");
      header.className = "nalar-intent-header";

      Object.assign(header.style, {
        padding: "20px 22px 18px",

        borderBottom: "1px solid #222222",
      });

      const eyebrow = document.createElement("div");

      eyebrow.textContent = "NALAR PROTOCOL";

      Object.assign(eyebrow.style, {
        fontSize: "9px",

        letterSpacing: ".16em",

        color: UI.textMuted,

        fontWeight: "600",

        lineHeight: "1",
      });

      const title = document.createElement("h2");

      title.textContent = "What are you trying to do?";

      Object.assign(title.style, {
        margin: "10px 0 0",

        fontSize: "25px",

        lineHeight: "1.15",

        letterSpacing: "-.025em",

        fontWeight: "600",

        color: UI.text,
      });

      const description = document.createElement("p");

      description.textContent = "Write what you expect this transaction to do.";

      Object.assign(description.style, {
        margin: "8px 0 0",

        fontSize: "13px",

        lineHeight: "1.55",

        color: UI.textSecondary,
      });

      header.appendChild(eyebrow);

      header.appendChild(title);

      header.appendChild(description);

      const body = document.createElement("div");
      body.className = "nalar-intent-body";

      Object.assign(body.style, {
        padding: "21px 22px 19px",
      });

      const originLabel = document.createElement("div");

      originLabel.textContent = "REQUEST FROM";

      Object.assign(originLabel.style, {
        fontSize: "9px",

        letterSpacing: ".16em",

        color: UI.textMuted,

        fontWeight: "600",
      });

      const origin = document.createElement("div");
      origin.className = "nalar-intent-origin";

      origin.textContent = window.location.hostname || "Current website";

      Object.assign(origin.style, {
        marginTop: "8px",

        padding: "10px 11px",

        background: "#050505",

        border: `1px solid ${UI.border}`,

        borderRadius: "7px",

        fontSize: "12px",

        color: UI.textSecondary,

        whiteSpace: "nowrap",

        overflow: "hidden",

        textOverflow: "ellipsis",
      });

      body.appendChild(originLabel);

      body.appendChild(origin);

      const intentLabel = document.createElement("div");

      intentLabel.textContent = "YOUR INTENT";

      Object.assign(intentLabel.style, {
        marginTop: "22px",

        marginBottom: "8px",

        fontSize: "9px",

        letterSpacing: ".16em",

        color: UI.textMuted,

        fontWeight: "600",
      });

      body.appendChild(intentLabel);

      const textarea = document.createElement("textarea");
      textarea.className = "nalar-intent-textarea";
      textarea.setAttribute("aria-label", "Your transaction intent");

      textarea.value = typeof existingIntent === "string" ? existingIntent : "";

      textarea.placeholder = "Example: Swap 1 USDT to BNB";

      Object.assign(textarea.style, {
        display: "block",

        width: "100%",

        minHeight: "122px",

        padding: "13px",

        resize: "vertical",

        background: "#050505",

        border: `1px solid ${UI.borderStrong}`,

        borderRadius: "8px",

        outline: "none",

        color: UI.text,

        caretColor: UI.white,

        fontFamily: "inherit",

        fontSize: "13px",

        lineHeight: "1.6",

        boxSizing: "border-box",
      });

      textarea.addEventListener("focus", () => {
        textarea.style.borderColor = "#5a5a5a";
      });

      textarea.addEventListener("blur", () => {
        textarea.style.borderColor = UI.borderStrong;
      });

      body.appendChild(textarea);

      const note = document.createElement("div");

      note.textContent = "Nalar will compare this statement with the transaction it receives.";

      Object.assign(note.style, {
        marginTop: "10px",

        fontSize: "11px",

        lineHeight: "1.5",

        color: UI.textDim,
      });

      body.appendChild(note);

      const footer = document.createElement("footer");
      footer.className = "nalar-intent-footer";

      Object.assign(footer.style, {
        padding: "0 22px 21px",
      });

      const actions = document.createElement("div");
      actions.className = "nalar-intent-actions";

      Object.assign(actions.style, {
        display: "grid",

        gridTemplateColumns: "130px 1fr",

        gap: "8px",
      });

      const cancel = document.createElement("button");

      cancel.textContent = "Cancel";

      styleButton(cancel, false);

      cancel.addEventListener("click", () => {
        cleanupIntent();

        overlay.remove();

        resolve(null);
      });

      const analyze = document.createElement("button");

      analyze.textContent = "Analyze transaction";

      styleButton(analyze, true);

      analyze.addEventListener("click", () => {
        const value = textarea.value.trim();

        if (!value) {
          note.textContent = "Describe what you want to do before continuing.";

          note.style.color = UI.textSecondary;

          textarea.style.borderColor = "#666666";

          textarea.focus();

          return;
        }

        cleanupIntent();

        overlay.remove();

        resolve(value);
      });

      actions.appendChild(cancel);

      actions.appendChild(analyze);

      footer.appendChild(actions);

      modal.appendChild(header);

      modal.appendChild(body);

      modal.appendChild(footer);

      overlay.appendChild(modal);

      document.documentElement.appendChild(overlay);

      function onKeydown(event) {
        if (event.key === "Escape") {
          cleanupIntent();

          overlay.remove();

          resolve(null);

          return;
        }

        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
          event.preventDefault();

          analyze.click();
        }
      }

      function cleanupIntent() {
        document.removeEventListener("keydown", onKeydown);
      }

      document.addEventListener("keydown", onKeydown);

      setTimeout(() => {
        textarea.focus();

        try {
          textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        } catch {
          // Ignore selection errors.
        }
      }, 0);
    });
  }

  /**
   * ============================================================
   * UI HELPERS
   * ============================================================
   */

  function createSection(label, content) {
    const section = document.createElement("section");
    section.className = "nalar-section";

    Object.assign(section.style, {
      padding: "16px 0",

      borderBottom: "1px solid #202020",
    });

    const heading = document.createElement("div");
    heading.className = "nalar-section-label";

    heading.textContent = label;

    Object.assign(heading.style, {
      marginBottom: "9px",

      fontSize: "9px",

      letterSpacing: ".16em",

      color: UI.textMuted,

      fontWeight: "600",
    });

    section.appendChild(heading);

    section.appendChild(content);

    return section;
  }

  function createTextBlock(text) {
    const element = document.createElement("div");
    element.className = "nalar-text-block";

    element.textContent = text;

    Object.assign(element.style, {
      fontSize: "14px",

      lineHeight: "1.65",

      color: "#d2d2d2",

      wordBreak: "break-word",
    });

    return element;
  }

  function styleButton(button, primary) {
    button.classList.add("nalar-button");
    button.classList.toggle("nalar-button-primary", primary);
    Object.assign(button.style, {
      minHeight: "43px",

      padding: "0 14px",

      borderRadius: "7px",

      border: primary ? `1px solid ${UI.white}` : `1px solid ${UI.borderStrong}`,

      background: primary ? UI.white : UI.background,

      color: primary ? UI.black : "#d8d8d8",

      fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",

      fontSize: "12px",

      fontWeight: "600",

      cursor: "pointer",

      transition: "border-color .12s ease, background .12s ease, color .12s ease",
    });

    button.addEventListener("mouseenter", () => {
      if (primary) {
        button.style.background = "#ffffff";
      } else {
        button.style.borderColor = "#555555";
      }
    });

    button.addEventListener("mouseleave", () => {
      if (primary) {
        button.style.background = UI.white;
      } else {
        button.style.borderColor = UI.borderStrong;
      }
    });
  }

  function getDecisionStatus(decision) {
    switch (decision) {
      case "ALLOW":
        return {
          title: "Transaction allowed",
          label: "The security policy allows this request",
        };

      case "REVIEW":
        return {
          title: "Review required",
          label: "Read the evidence before continuing",
        };

      case "BLOCK":
        return {
          title: "Transaction blocked",
          label: "Nalar stopped the request before signing",
        };

      default:
        return {
          title: "Transaction result",
          label: "Security analysis completed",
        };
    }
  }

  function getFallbackSummary(security, decision) {
    if (decision === "BLOCK") {
      if (security?.intentMatch === false) {
        return "This transaction does not match what you asked to do, so Nalar stopped it before signing.";
      }

      return "Nalar found a condition that does not allow this transaction to continue.";
    }

    if (decision === "REVIEW") {
      return "Nalar found something that should be checked before you sign the transaction.";
    }

    return "Nalar found that the transaction matches your requested action.";
  }

  function getFooterNote(decision) {
    if (decision === "BLOCK") {
      return "The transaction was stopped before your wallet was asked to sign it.";
    }

    if (decision === "REVIEW") {
      return "Continuing will send the original transaction to your wallet for final confirmation.";
    }

    return "Nalar has finished its check. Your wallet will ask for final confirmation next.";
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

      REGISTER: "Register",

      PAYMENT: "Payment",

      TRANSFER: "Transfer",

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

  function formatAddress(address) {
    if (typeof address !== "string") {
      return String(address);
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return address;
    }

    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  }

  /**
   * ============================================================
   * INTENT STORAGE
   * ============================================================
   */

  async function getStoredIntent() {
    const id = `intent-${Date.now()}-${Math.random()}`;

    return new Promise((resolve) => {
      let completed = false;

      const timeout = setTimeout(() => {
        if (completed) {
          return;
        }

        completed = true;

        window.removeEventListener("message", handleMessage);

        resolve(null);
      }, 3000);

      function handleMessage(event) {
        if (completed || event.source !== window) {
          return;
        }

        const message = event.data;

        if (!message || message.source !== "NALAR_EXTENSION") {
          return;
        }

        if (message.type !== "INTENT_RESULT" || message.id !== id) {
          return;
        }

        completed = true;

        clearTimeout(timeout);

        window.removeEventListener("message", handleMessage);

        resolve(typeof message.intent === "string" ? message.intent : null);
      }

      window.addEventListener("message", handleMessage);

      window.postMessage(
        {
          source: "NALAR_PAGE",

          type: "GET_INTENT",

          id,
        },
        "*",
      );
    });
  }

  async function saveIntent(intent) {
    const id = `save-intent-${Date.now()}-${Math.random()}`;

    return new Promise((resolve, reject) => {
      let completed = false;

      const timeout = setTimeout(() => {
        if (completed) {
          return;
        }

        completed = true;

        window.removeEventListener("message", handleMessage);

        reject(new Error("Saving intent timed out."));
      }, 3000);

      function handleMessage(event) {
        if (completed || event.source !== window) {
          return;
        }

        const message = event.data;

        if (!message || message.source !== "NALAR_EXTENSION") {
          return;
        }

        if (message.type !== "INTENT_SAVED" || message.id !== id) {
          return;
        }

        completed = true;

        clearTimeout(timeout);

        window.removeEventListener("message", handleMessage);

        if (message.ok) {
          resolve(true);

          return;
        }

        reject(new Error(message.error ?? "Failed to save intent."));
      }

      window.addEventListener("message", handleMessage);

      window.postMessage(
        {
          source: "NALAR_PAGE",

          type: "SET_INTENT",

          id,

          intent,
        },
        "*",
      );
    });
  }

  /**
   * ============================================================
   * PROTECTION STATUS
   * ============================================================
   */

  async function getProtectionStatus() {
    const id = `protection-${Date.now()}-${Math.random()}`;

    return new Promise((resolve, reject) => {
      let completed = false;

      const timeout = setTimeout(() => {
        if (completed) {
          return;
        }

        completed = true;

        window.removeEventListener("message", handleMessage);

        reject(new Error("[Nalar] Unable to determine protection status."));
      }, 5000);

      function handleMessage(event) {
        if (completed || event.source !== window) {
          return;
        }

        const message = event.data;

        if (!message || message.source !== "NALAR_EXTENSION") {
          return;
        }

        if (message.type !== "PROTECTION_STATUS" || message.id !== id) {
          return;
        }

        completed = true;

        clearTimeout(timeout);

        window.removeEventListener("message", handleMessage);

        if (message.error) {
          reject(new Error(message.error));

          return;
        }

        resolve(message.enabled === true);
      }

      window.addEventListener("message", handleMessage);

      window.postMessage(
        {
          source: "NALAR_PAGE",

          type: "GET_PROTECTION_STATUS",

          id,
        },
        "*",
      );
    });
  }

  /**
   * ============================================================
   * PROVIDER INITIALIZATION
   * ============================================================
   */

  function installProviders() {
    installDirectProviders();
  }

  installEip6963();

  installProviders();

  let attempts = 0;

  const maxAttempts = 200;

  const timer = setInterval(() => {
    attempts += 1;

    installProviders();

    if (attempts >= maxAttempts) {
      clearInterval(timer);

      if (!window.ethereum && !window.rabby) {
        console.warn("[Nalar] Wallet provider was not detected.");
      }
    }
  }, 50);

  console.info("[Nalar] TxSentry interceptor installed.");
})();

function showAnalysisOverlay() {
  removeElement("__nalar_analysis_overlay__");

  const analysisUI = {
    background: "#121311",
    borderStrong: "#454941",
    text: "#f1f0e9",
    textSecondary: "#b8b8ae",
    textMuted: "#7d8078",
    textDim: "#5c6059",
  };

  const overlay = document.createElement("div");

  overlay.id = "__nalar_analysis_overlay__";
  overlay.className = "nalar-overlay nalar-analysis-overlay";

  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483647",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    background: "rgba(0,0,0,.76)",
    backdropFilter: "blur(3px)",
    WebkitBackdropFilter: "blur(3px)",
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  });

  const modal = document.createElement("div");
  modal.className = "nalar-modal nalar-analysis-modal";

  Object.assign(modal.style, {
    width: "min(460px, 100%)",
    padding: "24px",
    background: analysisUI.background,
    border: `1px solid ${analysisUI.borderStrong}`,
    borderRadius: "10px",
    color: analysisUI.text,
    boxShadow: "0 26px 80px rgba(0,0,0,.5)",
  });

  const eyebrow = document.createElement("div");
  eyebrow.textContent = "NALAR PROTOCOL";

  Object.assign(eyebrow.style, {
    fontSize: "9px",
    letterSpacing: ".16em",
    color: analysisUI.textMuted,
    fontWeight: "600",
  });

  const title = document.createElement("h2");
  title.textContent = "Reading the transaction";

  Object.assign(title.style, {
    margin: "11px 0 0",
    fontSize: "23px",
    lineHeight: "1.2",
    fontWeight: "600",
    letterSpacing: "-.025em",
  });

  const subtitle = document.createElement("div");
  subtitle.textContent = "Nalar is checking the request before your wallet is asked to sign.";

  Object.assign(subtitle.style, {
    marginTop: "8px",
    fontSize: "12px",
    lineHeight: "1.55",
    color: analysisUI.textSecondary,
  });

  const list = document.createElement("div");

  Object.assign(list.style, {
    marginTop: "22px",
  });

  const steps = ["Reading your intent", "Decoding the wallet request", "Simulating execution", "Inspecting contract rules", "Checking on-chain state", "Applying security policy"];

  const rows = [];

  steps.forEach((label, index) => {
    const row = document.createElement("div");
    row.className = "nalar-analysis-step";
    row.dataset.state = index === 0 ? "active" : "pending";

    Object.assign(row.style, {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "8px 0",
      fontSize: "12px",
      color: analysisUI.textSecondary,
    });

    const indicator = document.createElement("div");
    indicator.className = "nalar-analysis-indicator";

    indicator.textContent = index === 0 ? "●" : "○";

    Object.assign(indicator.style, {
      width: "16px",
      textAlign: "center",
      fontSize: "9px",
      color: index === 0 ? analysisUI.text : analysisUI.textDim,
      flex: "0 0 16px",
    });

    const text = document.createElement("div");
    text.textContent = label;

    row.appendChild(indicator);
    row.appendChild(text);

    list.appendChild(row);

    rows.push({
      row,
      indicator,
      text,
    });
  });

  modal.appendChild(eyebrow);
  modal.appendChild(title);
  modal.appendChild(subtitle);
  modal.appendChild(list);

  overlay.appendChild(modal);

  document.documentElement.appendChild(overlay);

  let current = 0;

  const interval = setInterval(() => {
    if (!document.getElementById(overlay.id)) {
      clearInterval(interval);
      return;
    }

    if (current >= rows.length) {
      clearInterval(interval);
      return;
    }

    rows.forEach((item, index) => {
      if (index < current) {
        item.indicator.textContent = "✓";
        item.row.dataset.state = "done";
        item.indicator.style.color = analysisUI.text;
        item.text.style.color = analysisUI.textSecondary;
      } else if (index === current) {
        item.indicator.textContent = "●";
        item.row.dataset.state = "active";
        item.indicator.style.color = analysisUI.text;
        item.text.style.color = analysisUI.text;
      } else {
        item.indicator.textContent = "○";
        item.row.dataset.state = "pending";
        item.indicator.style.color = analysisUI.textDim;
        item.text.style.color = analysisUI.textDim;
      }
    });

    current += 1;
  }, 350);

  return {
    remove() {
      clearInterval(interval);
      overlay.remove();
    },
  };
}
