(() => {
  "use strict";

  /**
   * ============================================================
   * NALAR PROTOCOL / TXSENTRY
   * ============================================================
   *
   * Browser-side transaction security interceptor.
   *
   * Supported provider paths:
   *
   * 1. Legacy window.ethereum
   * 2. window.rabby
   * 3. EIP-6963 announced providers
   *
   * Security flow:
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
    background: "#080808",
    surface: "#0d0d0d",
    surfaceRaised: "#111111",

    border: "#292929",
    borderStrong: "#3a3a3a",

    text: "#f2f2f2",
    textSecondary: "#a0a0a0",
    textMuted: "#686868",
    textDim: "#4e4e4e",

    white: "#ffffff",
    black: "#000000",
  };

  /**
   * ============================================================
   * PROVIDER REGISTRY
   * ============================================================
   */

  const wrappedProviders = new WeakSet();

  /**
   * Provider references can appear through:
   *
   * - window.ethereum
   * - window.rabby
   * - EIP-6963
   *
   * WeakSet prevents wrapping the same provider twice.
   */

  /**
   * ============================================================
   * BASIC PROVIDER ACCESS
   * ============================================================
   */

  function getEthereum() {
    return window.ethereum;
  }

  /**
   * ============================================================
   * SMALL TRANSITION MESSAGE
   * ============================================================
   */

  function showNalarMessage(message) {
    const existing = document.getElementById(IDS.banner);

    if (existing) {
      existing.remove();
    }

    const banner = document.createElement("div");

    banner.id = IDS.banner;

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

      fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",

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
   * GENERIC PROVIDER WRAPPER
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

      /**
       * Everything except transaction submission
       * continues untouched.
       */
      if (!args || args.method !== "eth_sendTransaction") {
        return originalRequest(args);
      }

      return handleTransactionRequest({
        provider,
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

    /**
     * Some providers can expose a getter/setter
     * that silently refuses replacement.
     *
     * Verify the wrapper actually stuck.
     */
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
   * EIP-6963 PROVIDER DISCOVERY
   * ============================================================
   */

  function installEip6963() {
    /**
     * Important:
     *
     * Listener must be registered before requesting
     * provider announcements.
     */
    window.addEventListener("eip6963:announceProvider", handleEip6963Provider);

    /**
     * Ask all injected wallets to announce themselves.
     */
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

    const rdns = detail?.info?.rdns ?? "";

    console.info("[Nalar] EIP-6963 provider announced:", {
      name: walletName,
      rdns,
    });

    wrapProvider(provider, `EIP-6963:${walletName}`);
  }

  /**
   * ============================================================
   * DIRECT PROVIDER DISCOVERY
   * ============================================================
   */

  function installDirectProviders() {
    let wrapped = false;

    /**
     * Legacy provider.
     */
    if (wrapProvider(window.ethereum, "window.ethereum")) {
      wrapped = true;
    }

    /**
     * Rabby may expose its own provider.
     */
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

  async function handleTransactionRequest({ provider, originalRequest, args, providerLabel }) {
    /**
     * ----------------------------------------------------------
     * Protection state
     * ----------------------------------------------------------
     */

    const protectionEnabled = await getProtectionStatus();

    if (!protectionEnabled) {
      console.info("[Nalar] Protection paused. Forwarding transaction directly.", providerLabel);

      return originalRequest(args);
    }

    /**
     * ----------------------------------------------------------
     * Transaction validation
     * ----------------------------------------------------------
     */

    const transaction = args.params?.[0];

    if (!transaction) {
      throw new Error("[Nalar] Missing transaction request.");
    }

    if (!transaction.to) {
      throw new Error("[Nalar] Transaction target is missing.");
    }

    /**
     * ----------------------------------------------------------
     * Intent
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
     * Chain
     * ----------------------------------------------------------
     */

    const chainId = await originalRequest({
      method: "eth_chainId",
    });

    const id = ++requestId;

    /**
     * ----------------------------------------------------------
     * Security request
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
      }

      /**
       * ------------------------------------------------------
       * Send approved transaction to wallet
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
       * Cancel
       * ------------------------------------------------------
       */

      function cancelTransaction(message) {
        reject(new Error(message ?? "[Nalar] Transaction cancelled by user."));
      }

      /**
       * ------------------------------------------------------
       * Security response
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

        /**
         * Each request has a unique id.
         */
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
         * ----------------------------------------------------
         * BLOCK
         * ----------------------------------------------------
         *
         * Never call originalRequest.
         */

        if (security.decision === "BLOCK") {
          showDecisionOverlay(security, "BLOCK", null, () => {
            cancelTransaction("[Nalar] Transaction blocked by TxSentry.");
          });

          return;
        }

        /**
         * ----------------------------------------------------
         * REVIEW
         * ----------------------------------------------------
         */

        if (security.decision === "REVIEW") {
          showDecisionOverlay(security, "REVIEW", continueToWallet, () => {
            cancelTransaction("[Nalar] Transaction cancelled during review.");
          });

          return;
        }

        /**
         * ----------------------------------------------------
         * ALLOW
         * ----------------------------------------------------
         */

        showDecisionOverlay(security, "ALLOW", continueToWallet, () => {
          cancelTransaction("[Nalar] Transaction cancelled by user.");
        });
      }

      /**
       * Register listener BEFORE requesting
       * the security result.
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
   * SCAM INTELLIGENCE UI
   * ============================================================
   */

  function createScamIntelligenceSection(security) {
    const analyses = Array.isArray(security?.scamAnalyses) ? security.scamAnalyses : [];

    if (analyses.length === 0) {
      return null;
    }

    const content = document.createElement("div");

    Object.assign(content.style, {
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    });

    analyses.slice(0, 4).forEach((analysis) => {
      const card = document.createElement("div");

      Object.assign(card.style, {
        padding: "13px 14px",
        border: `1px solid ${UI.border}`,
        borderRadius: "8px",
        background: UI.surface,
        boxSizing: "border-box",
      });

      // --------------------------------------------------------
      // Token header
      // --------------------------------------------------------

      const tokenHeader = document.createElement("div");

      Object.assign(tokenHeader.style, {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "10px",
      });

      const tokenName = document.createElement("div");

      tokenName.textContent = formatAddress(analysis.token ?? "");

      Object.assign(tokenName.style, {
        fontSize: "12px",
        color: UI.text,
        fontWeight: "600",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      });

      const riskBadge = document.createElement("div");

      const riskLevel = analysis.riskLevel ?? "UNKNOWN";

      const riskScore = typeof analysis.riskScore === "number" ? analysis.riskScore : null;

      riskBadge.textContent = riskScore === null ? riskLevel : `${riskLevel} · ${riskScore}`;

      Object.assign(riskBadge.style, {
        padding: "4px 7px",
        border: `1px solid ${UI.borderStrong}`,
        borderRadius: "5px",
        fontSize: "9px",
        letterSpacing: ".06em",
        fontWeight: "650",
        color: UI.textSecondary,
        whiteSpace: "nowrap",
      });

      tokenHeader.appendChild(tokenName);
      tokenHeader.appendChild(riskBadge);

      card.appendChild(tokenHeader);

      // --------------------------------------------------------
      // Findings
      // --------------------------------------------------------

      const findings = Array.isArray(analysis.findings) ? analysis.findings : [];

      if (findings.length > 0) {
        const findingsContainer = document.createElement("div");

        Object.assign(findingsContainer.style, {
          marginTop: "11px",
          paddingTop: "10px",
          borderTop: "1px solid #202020",
        });

        findings.slice(0, 5).forEach((finding) => {
          const row = document.createElement("div");

          Object.assign(row.style, {
            display: "flex",
            gap: "8px",
            marginBottom: "7px",
            fontSize: "11px",
            lineHeight: "1.5",
          });

          const marker = document.createElement("span");

          marker.textContent = finding.severity === "CRITICAL" || finding.severity === "HIGH" ? "!" : "·";

          Object.assign(marker.style, {
            width: "14px",
            flex: "0 0 14px",
            color: UI.text,
            fontWeight: "700",
          });

          const text = document.createElement("div");

          text.textContent = finding.title ?? finding.description ?? finding.code ?? "Security finding";

          Object.assign(text.style, {
            color: UI.textSecondary,
          });

          row.appendChild(marker);
          row.appendChild(text);

          findingsContainer.appendChild(row);
        });

        card.appendChild(findingsContainer);
      }

      // --------------------------------------------------------
      // BNB Intelligence
      // --------------------------------------------------------

      const agentAvailable = analysis.agentAnalysis?.available === true;

      if (agentAvailable) {
        const agentRow = document.createElement("div");

        Object.assign(agentRow.style, {
          marginTop: "10px",
          paddingTop: "10px",
          borderTop: "1px solid #202020",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "10px",
        });

        const agentLabel = document.createElement("div");

        agentLabel.textContent = "BNB Intelligence";

        Object.assign(agentLabel.style, {
          fontSize: "10px",
          color: UI.textMuted,
          letterSpacing: ".03em",
        });

        const agentBadge = document.createElement("div");

        agentBadge.textContent = "ON-CHAIN EVIDENCE";

        Object.assign(agentBadge.style, {
          padding: "4px 6px",
          border: `1px solid ${UI.border}`,
          borderRadius: "4px",
          fontSize: "8px",
          letterSpacing: ".08em",
          fontWeight: "650",
          color: UI.textSecondary,
        });

        agentRow.appendChild(agentLabel);
        agentRow.appendChild(agentBadge);

        card.appendChild(agentRow);
      }

      content.appendChild(card);
    });

    return createSection("SCAM INTELLIGENCE", content);
  }

  /**
   * ============================================================
   * DECISION OVERLAY
   * ============================================================
   */

  function showDecisionOverlay(security, decision, onContinue, onCancel) {
    removeElement(IDS.decision);

    const overlay = document.createElement("div");

    overlay.id = IDS.decision;

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

      fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",

      boxSizing: "border-box",
    });

    const modal = document.createElement("div");

    Object.assign(modal.style, {
      width: "min(540px, 100%)",

      maxHeight: "calc(100vh - 40px)",

      overflowY: "auto",

      background: UI.background,

      color: UI.text,

      border: `1px solid ${UI.borderStrong}`,

      borderRadius: "10px",

      boxShadow: "0 26px 80px rgba(0,0,0,.5)",

      boxSizing: "border-box",
    });

    const explanation = security.explanation ?? {};

    const summary = security.transactionSummary ?? {};

    const intent = security.intent?.description ?? "No intent description available.";

    const action = security.actual?.action ?? "UNKNOWN";

    const functionName = security.actual?.functionName ?? null;

    const riskScore = security.riskScore ?? 0;

    const scamAnalyses = Array.isArray(security.scamAnalyses) ? security.scamAnalyses : [];

    const status = getDecisionStatus(decision);

    const title = explanation.title ?? status.title;

    const explanationSummary = explanation.summary ?? getFallbackSummary(security, decision);

    const explanationDetails = Array.isArray(explanation.details) ? explanation.details : [];

    const reasons = dedupe([...(security.reasons ?? []), ...(security.comparison?.mismatches ?? []), ...(security.policy?.evaluation?.reasons ?? [])]);

    const summaryTitle = summary.title ?? summary.action ?? humanizeAction(action);

    const summaryDescription = summary.description ?? "Nalar analyzed this transaction before signing.";

    const summaryDetails = Array.isArray(summary.details) ? summary.details : [];

    const valueNative = summary.valueNative ?? null;

    const target = summary.target ?? null;

    /**
     * ----------------------------------------------------------
     * Header
     * ----------------------------------------------------------
     */

    const header = document.createElement("header");

    Object.assign(header.style, {
      padding: "20px 22px 17px",

      borderBottom: "1px solid #222222",

      display: "flex",

      justifyContent: "space-between",

      alignItems: "flex-start",

      gap: "18px",
    });

    const headerText = document.createElement("div");

    const eyebrow = document.createElement("div");

    eyebrow.textContent = "NALAR / TXSENTRY";

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
     * Risk
     * ----------------------------------------------------------
     */

    const risk = document.createElement("div");

    Object.assign(risk.style, {
      flex: "0 0 auto",

      minWidth: "74px",

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

    riskValue.textContent = `${riskScore}/100`;

    Object.assign(riskValue.style, {
      marginTop: "5px",

      fontSize: "13px",

      lineHeight: "1",

      fontWeight: "650",

      color: UI.text,
    });

    risk.appendChild(riskLabel);

    risk.appendChild(riskValue);

    header.appendChild(headerText);

    header.appendChild(risk);

    /**
     * ----------------------------------------------------------
     * Body
     * ----------------------------------------------------------
     */

    const body = document.createElement("main");

    Object.assign(body.style, {
      padding: "0 22px",
    });

    /**
     * User intent.
     */

    body.appendChild(createSection("YOUR REQUEST", createTextBlock(intent)));

    /**
     * Actual transaction.
     */

    const actionContent = document.createElement("div");

    const actionName = document.createElement("div");

    actionName.textContent = summaryTitle;

    Object.assign(actionName.style, {
      fontSize: "16px",

      lineHeight: "1.3",

      letterSpacing: "-.01em",

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

    body.appendChild(createSection("WHAT WILL HAPPEN", actionContent));

    /**
     * ----------------------------------------------------------
     * Explanation
     * ----------------------------------------------------------
     */

    const explanationContent = document.createElement("div");

    const explanationMain = document.createElement("div");

    explanationMain.textContent = explanationSummary;

    Object.assign(explanationMain.style, {
      fontSize: "14px",

      lineHeight: "1.7",

      color: "#d5d5d5",
    });

    explanationContent.appendChild(explanationMain);

    const usefulDetails = dedupe([...explanationDetails, ...(decision === "BLOCK" ? reasons : [])]);

    if (usefulDetails.length > 0) {
      const list = document.createElement("div");

      Object.assign(list.style, {
        marginTop: "13px",
      });

      usefulDetails.slice(0, 5).forEach((detail) => {
        const row = document.createElement("div");

        row.textContent = detail;

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

    body.appendChild(createSection(decision === "BLOCK" ? "WHY IT WAS STOPPED" : "NALAR'S READING", explanationContent));

    const scamIntelligence = createScamIntelligenceSection(security);

    if (scamIntelligence) {
      body.appendChild(scamIntelligence);
    }

    /**
     * ----------------------------------------------------------
     * Technical reference
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
     * Footer
     * ----------------------------------------------------------
     */

    const footer = document.createElement("footer");

    Object.assign(footer.style, {
      padding: "0 22px 21px",
    });

    const note = document.createElement("div");

    note.textContent = getFooterNote(decision);

    Object.assign(note.style, {
      marginBottom: "14px",

      fontSize: "10px",

      lineHeight: "1.5",

      color: UI.textDim,
    });

    footer.appendChild(note);

    const actions = document.createElement("div");

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
   * INTENT OVERLAY
   * ============================================================
   */

  function showIntentOverlay(existingIntent = "") {
    return new Promise((resolve) => {
      removeElement(IDS.intent);

      const overlay = document.createElement("div");

      overlay.id = IDS.intent;

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

        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",

        boxSizing: "border-box",
      });

      const modal = document.createElement("div");

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

      /**
       * Header
       */

      const header = document.createElement("header");

      Object.assign(header.style, {
        padding: "20px 22px 18px",

        borderBottom: "1px solid #222222",
      });

      const eyebrow = document.createElement("div");

      eyebrow.textContent = "NALAR / TXSENTRY";

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

      /**
       * Body
       */

      const body = document.createElement("div");

      Object.assign(body.style, {
        padding: "21px 22px 19px",
      });

      /**
       * Origin
       */

      const originLabel = document.createElement("div");

      originLabel.textContent = "REQUEST FROM";

      Object.assign(originLabel.style, {
        fontSize: "9px",

        letterSpacing: ".16em",

        color: UI.textMuted,

        fontWeight: "600",
      });

      const origin = document.createElement("div");

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

      /**
       * Intent label
       */

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

      /**
       * Input
       */

      const textarea = document.createElement("textarea");

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

      note.textContent = "Nalar uses this statement to compare your expectation with the transaction.";

      Object.assign(note.style, {
        marginTop: "10px",

        fontSize: "11px",

        lineHeight: "1.5",

        color: UI.textDim,
      });

      body.appendChild(note);

      /**
       * Footer
       */

      const footer = document.createElement("footer");

      Object.assign(footer.style, {
        padding: "0 22px 21px",
      });

      const actions = document.createElement("div");

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
          // Ignore selection failures.
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

    Object.assign(section.style, {
      padding: "16px 0",

      borderBottom: "1px solid #202020",
    });

    const heading = document.createElement("div");

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
    Object.assign(button.style, {
      minHeight: "43px",

      padding: "0 14px",

      borderRadius: "7px",

      border: primary ? `1px solid ${UI.white}` : `1px solid ${UI.borderStrong}`,

      background: primary ? UI.white : UI.background,

      color: primary ? UI.black : "#d8d8d8",

      fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",

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
          title: "Transaction looks safe",
          label: "Security check passed",
        };

      case "REVIEW":
        return {
          title: "Review required",
          label: "Manual confirmation required",
        };

      case "BLOCK":
        return {
          title: "Transaction blocked",
          label: "Nalar stopped the request",
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
      if (security.intentMatch === false) {
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

  function removeElement(id) {
    const element = document.getElementById(id);

    if (element) {
      element.remove();
    }
  }

  /**
   * ============================================================
   * EXTENSION COMMUNICATION
   * ============================================================
   */

  async function getStoredIntent() {
    const id = `intent-${Date.now()}-${Math.random()}`;

    console.log("[Nalar] Getting stored intent:", id);

    return new Promise((resolve) => {
      let completed = false;

      const timeout = setTimeout(() => {
        if (completed) {
          return;
        }

        completed = true;

        window.removeEventListener("message", handleMessage);

        console.error("[Nalar] Stored intent request timed out:", id);

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

        console.log("[Nalar] Received INTENT_RESULT:", message);

        completed = true;

        clearTimeout(timeout);

        window.removeEventListener("message", handleMessage);

        resolve(typeof message.intent === "string" ? message.intent : null);
      }

      window.addEventListener("message", handleMessage);

      console.log("[Nalar] Sending GET_INTENT:", id);

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

  async function getProtectionStatus() {
    const id = `protection-${Date.now()}-${Math.random()}`;

    console.log("[Nalar] Protection request:", id);

    return new Promise((resolve, reject) => {
      let completed = false;

      const timeout = setTimeout(() => {
        if (completed) {
          return;
        }

        completed = true;

        window.removeEventListener("message", handleMessage);

        console.error("[Nalar] Protection timeout:", id);

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

        console.log("[Nalar] Protection response:", message);

        if (message.error) {
          reject(new Error(message.error));

          return;
        }

        resolve(message.enabled === true);
      }

      window.addEventListener("message", handleMessage);

      console.log("[Nalar] Sending protection request:", id);

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
    let installed = false;

    if (installDirectProviders()) {
      installed = true;
    }

    return installed;
  }

  /**
   * Register EIP-6963 immediately.
   *
   * This must happen before the page requests
   * wallet providers.
   */
  installEip6963();

  /**
   * Try immediately.
   */
  installProviders();

  /**
   * Wallet providers can appear later.
   */
  let attempts = 0;

  const maxAttempts = 200;

  const timer = setInterval(() => {
    attempts += 1;

    installProviders();

    /**
     * Keep listening to EIP-6963 for the
     * lifetime of the page.
     *
     * Stop retrying direct providers after
     * the timeout.
     */
    if (attempts >= maxAttempts) {
      clearInterval(timer);

      if (!window.ethereum && !window.rabby) {
        console.warn("[Nalar] Wallet provider was not detected.");
      }
    }
  }, 50);

  console.info("[Nalar] TxSentry interceptor installed.");
})();
