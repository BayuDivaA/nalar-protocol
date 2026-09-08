(() => {
  if (window.__NALAR_TXSENTRY_INSTALLED__) {
    return;
  }

  window.__NALAR_TXSENTRY_INSTALLED__ = true;

  let requestId = 0;

  function getEthereum() {
    return window.ethereum;
  }

  function showNalarMessage(message, type = "info") {
    const existing = document.getElementById("__nalar_banner");

    if (existing) {
      existing.remove();
    }

    const banner = document.createElement("div");

    banner.id = "__nalar_banner";

    banner.textContent = message;

    banner.style.position = "fixed";
    banner.style.top = "20px";
    banner.style.right = "20px";
    banner.style.zIndex = "2147483647";
    banner.style.padding = "14px 18px";
    banner.style.borderRadius = "12px";
    banner.style.fontFamily = "system-ui, sans-serif";
    banner.style.fontSize = "14px";
    banner.style.fontWeight = "600";
    banner.style.maxWidth = "360px";
    banner.style.boxShadow = "0 10px 30px rgba(0,0,0,.35)";

    if (type === "block") {
      banner.style.background = "#3b0a0a";
      banner.style.color = "#fecaca";
      banner.style.border = "1px solid #7f1d1d";
    } else {
      banner.style.background = "#111827";
      banner.style.color = "#e5e7eb";
      banner.style.border = "1px solid #374151";
    }

    document.documentElement.appendChild(banner);

    setTimeout(() => {
      banner.remove();
    }, 5000);
  }

  function install() {
    const ethereum = getEthereum();

    if (!ethereum) {
      return false;
    }

    const originalRequest = ethereum.request?.bind(ethereum);

    const pendingRequests = new Map();

    if (!originalRequest) {
      return false;
    }

    ethereum.request = async function (args) {
      if (!args || args.method !== "eth_sendTransaction") {
        return originalRequest(args);
      }

      const protectionEnabled = await getProtectionStatus();

      if (!protectionEnabled) {
        console.info("[Nalar] Protection paused. Forwarding transaction directly.");

        return originalRequest(args);
      }

      const transaction = args.params?.[0];

      let intent = await getStoredIntent();

      /**
       * Always let the user confirm or edit
       * the intent before a transaction is analyzed.
       *
       * This prevents a previous intent from
       * silently being reused for a different
       * transaction.
       */
      const confirmedIntent = await showIntentOverlay(intent);

      if (!confirmedIntent) {
        throw new Error("[Nalar] Transaction cancelled because no intent was provided.");
      }

      intent = confirmedIntent;

      await saveIntent(intent);

      if (!transaction) {
        throw new Error("[Nalar] Missing transaction request.");
      }

      if (!transaction.to) {
        throw new Error("[Nalar] Transaction target is missing.");
      }

      const id = ++requestId;

      const chainId = await originalRequest({
        method: "eth_chainId",
      });

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pendingRequests.delete(id);

          window.removeEventListener("message", handleMessage);

          reject(new Error("[Nalar] Security check timed out."));
        }, 30_000);

        function cleanup() {
          clearTimeout(timeout);

          pendingRequests.delete(id);

          window.removeEventListener("message", handleMessage);
        }

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
           * CRITICAL:
           *
           * The response must belong to
           * the exact pending transaction.
           */
          if (message.id !== id || !pendingRequests.has(id)) {
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
           */
          if (security.decision === "BLOCK") {
            showSecurityExplanationOverlay(security);

            reject(new Error("[Nalar] Transaction blocked by TxSentry."));

            return;
          }

          /**
           * REVIEW
           */
          if (security.decision === "REVIEW") {
            showReviewOverlay(
              security,

              () => {
                showNalarMessage("Review confirmed. Opening wallet...");

                originalRequest({
                  ...args,

                  params: [
                    {
                      ...transaction,
                      from: transaction.from,
                    },
                  ],
                })
                  .then(resolve)
                  .catch(reject);
              },

              () => {
                reject(new Error("[Nalar] Transaction cancelled during review."));
              },
            );

            return;
          }

          /**
           * ALLOW
           */
          /**
           * ALLOW
           */
          showAllowOverlay(
            security,

            () => {
              showNalarMessage("Nalar approved the transaction. Opening wallet...");

              originalRequest({
                ...args,

                params: [
                  {
                    ...transaction,
                    from: transaction.from,
                  },
                ],
              })
                .then(resolve)
                .catch(reject);
            },

            () => {
              reject(new Error("[Nalar] Transaction cancelled by user."));
            },
          );
        }

        /**
         * Register request BEFORE sending
         * the message to the extension.
         *
         * This prevents a fast response from
         * being missed.
         */
        pendingRequests.set(id, {
          transaction,
          chainId,
        });

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
    };

    console.info("[Nalar] TxSentry interceptor installed.");

    return true;
  }

  function showSecurityExplanationOverlay(security) {
    const existing = document.getElementById("__nalar_explanation_overlay__");

    if (existing) {
      existing.remove();
    }

    const overlay = document.createElement("div");

    overlay.id = "__nalar_explanation_overlay__";

    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483647",
      background: "rgba(0,0,0,.68)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      boxSizing: "border-box",
    });

    const modal = document.createElement("div");

    Object.assign(modal.style, {
      width: "min(520px, 100%)",
      background: "#09090b",
      color: "#fff",
      border: "1px solid #3f3f46",
      borderRadius: "20px",
      padding: "26px",
      fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      boxShadow: "0 30px 100px rgba(0,0,0,.65)",
    });

    const explanation = security.explanation ?? {};

    const title = explanation.title ?? "Transaction blocked";

    const summary = explanation.summary ?? "Nalar stopped this transaction because it did not match your intended action.";

    const details = Array.isArray(explanation.details) ? explanation.details : [];

    const risk = `${security.riskLevel ?? "UNKNOWN"} — ${security.riskScore ?? 0}/100`;

    modal.innerHTML = `
    <div
      style="
        font-size:11px;
        letter-spacing:.2em;
        color:#71717a;
        text-transform:uppercase;
      "
    >
      NALAR PROTOCOL
    </div>

    <h2
      style="
        margin:12px 0 0;
        font-size:25px;
        line-height:1.2;
        font-weight:650;
      "
    >
      ${escapeHtml(title)}
    </h2>

    <div
      style="
        margin-top:18px;
        padding:16px;
        border-radius:14px;
        background:#120808;
        border:1px solid #3f1515;
      "
    >
      <div
        style="
          font-size:11px;
          color:#a1a1aa;
          text-transform:uppercase;
          letter-spacing:.12em;
        "
      >
        Risk
      </div>

      <div
        style="
          margin-top:6px;
          font-size:15px;
          font-weight:650;
          color:#fecaca;
        "
      >
        ${escapeHtml(risk)}
      </div>
    </div>

    <p
      style="
        margin:20px 0 0;
        font-size:15px;
        line-height:1.65;
        color:#e4e4e7;
      "
    >
      ${escapeHtml(summary)}
    </p>

    ${
      details.length
        ? `
      <div
        style="
          margin-top:18px;
          padding:16px;
          border-radius:14px;
          background:#111113;
          border:1px solid #27272a;
        "
      >
        <div
          style="
            font-size:11px;
            color:#71717a;
            text-transform:uppercase;
            letter-spacing:.12em;
          "
        >
          Why Nalar stopped it
        </div>

        <div
          style="
            margin-top:10px;
            font-size:13px;
            line-height:1.7;
            color:#d4d4d8;
          "
        >
          ${details.map((detail) => `<div style="margin-bottom:9px;">• ${escapeHtml(detail)}</div>`).join("")}
        </div>
      </div>
    `
        : ""
    }

    <div
      style="
        margin-top:22px;
        font-size:12px;
        line-height:1.6;
        color:#71717a;
      "
    >
      The transaction was stopped before your wallet was asked
      to sign it.
    </div>

    <button
      id="__nalar_explanation_close"
      style="
        width:100%;
        margin-top:20px;
        padding:13px;
        border-radius:12px;
        border:1px solid #52525b;
        background:#fff;
        color:#000;
        cursor:pointer;
        font-size:13px;
        font-weight:650;
      "
    >
      Close
    </button>
  `;

    overlay.appendChild(modal);

    document.documentElement.appendChild(overlay);

    document.getElementById("__nalar_explanation_close")?.addEventListener("click", () => {
      overlay.remove();
    });
  }

  function showAllowOverlay(security, onContinue, onCancel) {
    const existing = document.getElementById("__nalar_allow_overlay__");

    if (existing) {
      existing.remove();
    }

    const overlay = document.createElement("div");

    overlay.id = "__nalar_allow_overlay__";

    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483647",
      background: "rgba(0,0,0,.58)",
      backdropFilter: "blur(5px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      boxSizing: "border-box",
    });

    const modal = document.createElement("div");

    Object.assign(modal.style, {
      width: "min(500px, 100%)",
      background: "#09090b",
      color: "#fff",
      border: "1px solid #27272a",
      borderRadius: "20px",
      padding: "26px",
      fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      boxShadow: "0 30px 100px rgba(0,0,0,.55)",
    });

    const explanation = security.explanation ?? {};

    const title = explanation.title ?? "Transaction looks safe";

    const summary = explanation.summary ?? "Nalar found that this transaction matches what you asked it to do.";

    const details = Array.isArray(explanation.details) ? explanation.details : [];

    const riskLevel = security.riskLevel ?? "LOW";
    const riskScore = security.riskScore ?? 0;

    const intentDescription = security.intent?.description ?? "Your requested transaction";

    const actualAction = security.actual?.functionName ?? security.actual?.action ?? "Unknown";

    modal.innerHTML = `
    <div
      style="
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:16px;
      "
    >
      <div>
        <div
          style="
            font-size:11px;
            letter-spacing:.2em;
            color:#71717a;
            text-transform:uppercase;
          "
        >
          NALAR PROTOCOL
        </div>

        <h2
          style="
            margin:12px 0 0;
            font-size:25px;
            line-height:1.2;
            font-weight:650;
          "
        >
          ${escapeHtml(title)}
        </h2>
      </div>

      <div
        style="
          width:34px;
          height:34px;
          display:flex;
          align-items:center;
          justify-content:center;
          border-radius:50%;
          border:1px solid #36543f;
          background:#0d1711;
          color:#8fca9f;
          font-size:17px;
          flex:0 0 auto;
        "
      >
        ✓
      </div>
    </div>

    <div
      style="
        margin-top:20px;
        padding:16px;
        border-radius:14px;
        background:#0c120e;
        border:1px solid #1d3022;
      "
    >
      <div
        style="
          font-size:10px;
          letter-spacing:.13em;
          text-transform:uppercase;
          color:#737b75;
        "
      >
        Security status
      </div>

      <div
        style="
          margin-top:7px;
          font-size:15px;
          font-weight:650;
          color:#9ed3aa;
        "
      >
        ${escapeHtml(riskLevel)} · ${escapeHtml(riskScore)}/100
      </div>
    </div>

    <div
      style="
        margin-top:18px;
        padding:16px;
        border:1px solid #27272a;
        border-radius:14px;
        background:#000;
      "
    >
      <div
        style="
          font-size:10px;
          letter-spacing:.13em;
          text-transform:uppercase;
          color:#71717a;
        "
      >
        Your intent
      </div>

      <div
        style="
          margin-top:7px;
          font-size:14px;
          line-height:1.55;
          color:#e4e4e7;
        "
      >
        ${escapeHtml(intentDescription)}
      </div>

      <div
        style="
          margin-top:15px;
          font-size:10px;
          letter-spacing:.13em;
          text-transform:uppercase;
          color:#71717a;
        "
      >
        Transaction
      </div>

      <div
        style="
          margin-top:7px;
          font-size:13px;
          color:#a1a1aa;
        "
      >
        ${escapeHtml(actualAction)}
      </div>
    </div>

    <p
      style="
        margin:18px 0 0;
        font-size:14px;
        line-height:1.65;
        color:#d4d4d8;
      "
    >
      ${escapeHtml(summary)}
    </p>

    ${
      details.length
        ? `
      <div
        style="
          margin-top:16px;
          font-size:12px;
          line-height:1.65;
          color:#a1a1aa;
        "
      >
        ${details
          .slice(0, 3)
          .map((detail) => `<div style="margin-bottom:6px;">• ${escapeHtml(detail)}</div>`)
          .join("")}
      </div>
      `
        : ""
    }

    <div
      style="
        margin-top:18px;
        font-size:11px;
        line-height:1.5;
        color:#62626b;
      "
    >
      Nalar has completed the security check.
      Your wallet will ask you to confirm the transaction next.
    </div>

    <div
      style="
        display:flex;
        gap:10px;
        margin-top:22px;
      "
    >
      <button
        id="__nalar_allow_cancel"
        style="
          flex:1;
          padding:13px;
          border-radius:12px;
          border:1px solid #3f3f46;
          background:#18181b;
          color:#e4e4e7;
          cursor:pointer;
          font-size:13px;
        "
      >
        Cancel
      </button>

      <button
        id="__nalar_allow_continue"
        style="
          flex:1;
          padding:13px;
          border-radius:12px;
          border:1px solid #fff;
          background:#fff;
          color:#000;
          cursor:pointer;
          font-size:13px;
          font-weight:650;
        "
      >
        Continue to wallet
      </button>
    </div>
  `;

    overlay.appendChild(modal);

    document.documentElement.appendChild(overlay);

    document.getElementById("__nalar_allow_cancel")?.addEventListener("click", () => {
      overlay.remove();
      onCancel();
    });

    document.getElementById("__nalar_allow_continue")?.addEventListener("click", () => {
      overlay.remove();
      onContinue();
    });
  }

  function showReviewOverlay(security, onConfirm, onCancel) {
    const existing = document.getElementById("__nalar_review_overlay");

    if (existing) {
      existing.remove();
    }

    const explanation = security.explanation ?? {};

    const summary = explanation.summary ?? "This transaction requires your attention before signing.";

    const details = Array.isArray(explanation.details) ? explanation.details : [];

    const overlay = document.createElement("div");

    overlay.id = "__nalar_review_overlay";

    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483647",
      background: "rgba(0,0,0,.65)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      boxSizing: "border-box",
    });

    const modal = document.createElement("div");

    Object.assign(modal.style, {
      width: "min(460px, 100%)",
      background: "#09090b",
      color: "#fff",
      border: "1px solid #3f3f46",
      borderRadius: "20px",
      padding: "24px",
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      boxShadow: "0 25px 80px rgba(0,0,0,.5)",
    });

    const intent = security.intent?.description ?? "Unknown transaction";

    const explanationTitle = explanation.title ?? "Review required";

    const explanationSummary = explanation.summary ?? "This transaction requires your attention before signing.";

    const explanationDetails = Array.isArray(explanation.details) ? explanation.details : [];

    const risk = `${security.riskLevel} — ${security.riskScore}/100`;

    const reasons = [...(security.reasons ?? []), ...(security.policy?.evaluation?.reasons ?? [])].filter(Boolean).filter((reason, index, array) => array.indexOf(reason) === index);

    modal.innerHTML = `
    <div
      style="
        font-size:11px;
        letter-spacing:.22em;
        color:#71717a;
        text-transform:uppercase;
      "
    >
      NALAR PROTOCOL
    </div>

    <h2
      style="
        margin:12px 0 0;
        font-size:24px;
        line-height:1.2;
      "
    >
      ${escapeHtml(explanationTitle)}
    </h2>

    <p
      style="
        margin:12px 0 0;
        color:#a1a1aa;
        line-height:1.6;
        font-size:14px;
      "
    >
       ${escapeHtml(explanationSummary)}
    </p>

    <div
      style="
        margin-top:20px;
        padding:16px;
        border:1px solid #27272a;
        border-radius:14px;
        background:#000;
      "
    >
      <div
        style="
          font-size:11px;
          color:#71717a;
          text-transform:uppercase;
          letter-spacing:.12em;
        "
      >
        Your intent
      </div>

      <div
        style="
          margin-top:7px;
          font-size:14px;
          line-height:1.5;
        "
      >
        ${escapeHtml(intent)}
      </div>

      <div
        style="
          margin-top:16px;
          font-size:11px;
          color:#71717a;
          text-transform:uppercase;
          letter-spacing:.12em;
        "
      >
        Risk
      </div>

      <div
        style="
          margin-top:7px;
          font-size:15px;
          font-weight:600;
        "
      >
        ${escapeHtml(risk)}
      </div>

      <div
        style="
          margin-top:16px;
          font-size:11px;
          color:#71717a;
          text-transform:uppercase;
          letter-spacing:.12em;
        "
      >
        Actual action
      </div>

      <div
        style="
          margin-top:7px;
          font-size:14px;
        "
      >
        ${escapeHtml(security.actual?.functionName ?? security.actual?.action ?? "Unknown")}
      </div>

      ${
        explanationDetails.length > 0
          ? `
      <div
        style="
          margin-top:16px;
          font-size:11px;
          color:#71717a;
          text-transform:uppercase;
          letter-spacing:.12em;
        "
      >
        Nalar's explanation
      </div>

      <div
        style="
          margin-top:9px;
          color:#d4d4d8;
          font-size:13px;
          line-height:1.65;
        "
      >
        ${explanationDetails
          .slice(0, 4)
          .map((detail) => `<div style="margin-bottom:7px;">• ${escapeHtml(detail)}</div>`)
          .join("")}
      </div>
    `
          : ""
      }

      ${
        reasons.length > 0
          ? `
            <div
              style="
                margin-top:16px;
                font-size:11px;
                color:#71717a;
                text-transform:uppercase;
                letter-spacing:.12em;
              "
            >
              Why
            </div>

            <div
              style="
                margin-top:8px;
                color:#d4d4d8;
                font-size:13px;
                line-height:1.6;
              "
            >
              ${reasons.map((reason) => `<div style="margin-bottom:6px">• ${escapeHtml(reason)}</div>`).join("")}
            </div>
          `
          : ""
      }
    </div>

    <div
      style="
        display:flex;
        gap:10px;
        margin-top:20px;
      "
    >
      <button
        id="__nalar_review_cancel"
        style="
          flex:1;
          padding:12px;
          border-radius:12px;
          border:1px solid #3f3f46;
          background:#18181b;
          color:#fff;
          cursor:pointer;
          font-size:13px;
        "
      >
        Cancel
      </button>

      <button
        id="__nalar_review_confirm"
        style="
          flex:1;
          padding:12px;
          border-radius:12px;
          border:0;
          background:#fff;
          color:#000;
          cursor:pointer;
          font-size:13px;
          font-weight:600;
        "
      >
        Continue
      </button>
    </div>
  `;

    overlay.appendChild(modal);

    document.documentElement.appendChild(overlay);

    document.getElementById("__nalar_review_cancel")?.addEventListener("click", () => {
      overlay.remove();
      onCancel();
    });

    document.getElementById("__nalar_review_confirm")?.addEventListener("click", () => {
      overlay.remove();
      onConfirm();
    });
  }

  function escapeHtml(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  async function getStoredIntent() {
    const id = `intent-${Date.now()}-${Math.random()}`;

    return new Promise((resolve) => {
      function handleMessage(event) {
        if (event.source !== window) {
          return;
        }

        const message = event.data;

        if (!message || message.source !== "NALAR_EXTENSION") {
          return;
        }

        if (message.type !== "INTENT_RESULT" || message.id !== id) {
          return;
        }

        window.removeEventListener("message", handleMessage);

        resolve(message.intent ?? null);
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

  async function getProtectionStatus() {
    const id = `protection-${Date.now()}-${Math.random()}`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        window.removeEventListener("message", handleMessage);

        /**
         * Fail closed.
         *
         * If Nalar cannot determine
         * its protection state, do NOT
         * silently bypass protection.
         */
        reject(new Error("[Nalar] Unable to determine protection status."));
      }, 3000);

      function handleMessage(event) {
        if (event.source !== window) {
          return;
        }

        const message = event.data;

        if (!message || message.source !== "NALAR_EXTENSION") {
          return;
        }

        if (message.type !== "PROTECTION_STATUS" || message.id !== id) {
          return;
        }

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

  function showIntentOverlay(existingIntent = "") {
    return new Promise((resolve) => {
      const existing = document.getElementById("__nalar_intent_overlay__");
      if (existing) {
        existing.remove();
      }

      const overlay = document.createElement("div");
      overlay.id = "__nalar_intent_overlay__";

      const shadow = overlay.attachShadow({ mode: "closed" });

      const style = document.createElement("style");

      style.textContent = `
      :host {
        all: initial;
      }

      * {
        box-sizing: border-box;
      }

      .nalar-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483647;

        display: flex;
        align-items: center;
        justify-content: center;

        background: rgba(0, 0, 0, 0.58);
        backdrop-filter: blur(5px);

        font-family:
          Inter,
          ui-sans-serif,
          system-ui,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          sans-serif;

        color: #f5f5f5;
      }

      .nalar-modal {
        width: min(560px, calc(100vw - 32px));

        background: #09090b;
        border: 1px solid #3a3a40;
        border-radius: 16px;

        box-shadow:
          0 24px 80px rgba(0, 0, 0, 0.55),
          0 0 0 1px rgba(255, 255, 255, 0.02);

        overflow: hidden;
      }

      .nalar-header {
        padding: 18px 22px 16px;
        border-bottom: 1px solid #222228;

        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
      }

      .nalar-brand {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .nalar-logo {
        width: 32px;
        height: 32px;

        display: flex;
        align-items: center;
        justify-content: center;

        background: #f5f5f5;
        color: #09090b;

        border-radius: 8px;

        font-size: 14px;
        font-weight: 800;
        letter-spacing: -0.04em;
      }

      .nalar-brand-name {
        font-size: 13px;
        font-weight: 650;
        letter-spacing: 0.13em;
        color: #f2f2f2;
      }

      .nalar-brand-subtitle {
        margin-top: 3px;

        font-size: 9px;
        font-weight: 500;
        letter-spacing: 0.14em;

        color: #707078;
        text-transform: uppercase;
      }

      .nalar-extension-badge {
        padding: 6px 9px;

        border: 1px solid #303038;
        border-radius: 6px;

        font-size: 9px;
        font-weight: 600;
        letter-spacing: 0.12em;

        color: #8f8f99;
        text-transform: uppercase;
        white-space: nowrap;
      }

      .nalar-body {
        padding: 24px 22px 22px;
      }

      .nalar-title {
        margin: 0;

        font-size: 24px;
        line-height: 1.2;
        font-weight: 650;
        letter-spacing: -0.025em;

        color: #f5f5f5;
      }

      .nalar-description {
        margin: 10px 0 0;

        font-size: 13px;
        line-height: 1.65;

        color: #9a9aa3;
        max-width: 470px;
      }

      .nalar-origin {
        margin-top: 20px;
        padding: 12px 14px;

        background: #0d0d10;
        border: 1px solid #24242b;
        border-radius: 9px;
      }

      .nalar-origin-label {
        font-size: 9px;
        font-weight: 600;
        letter-spacing: 0.14em;
        text-transform: uppercase;

        color: #686872;
      }

      .nalar-origin-value {
        margin-top: 5px;

        font-size: 13px;
        font-weight: 550;

        color: #d7d7dd;

        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .nalar-input-label {
        display: block;

        margin: 20px 0 8px;

        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.12em;

        color: #73737d;
        text-transform: uppercase;
      }

      textarea {
        display: block;

        width: 100%;
        min-height: 108px;

        padding: 14px;

        resize: vertical;

        background: #050506;
        border: 1px solid #35353d;
        border-radius: 10px;

        outline: none;

        color: #eeeeef;

        font-family: inherit;
        font-size: 13px;
        line-height: 1.55;

        transition:
          border-color 120ms ease,
          box-shadow 120ms ease;
      }

      textarea::placeholder {
        color: #5c5c66;
      }

      textarea:focus {
        border-color: #5f83aa;
        box-shadow: 0 0 0 3px rgba(95, 131, 170, 0.11);
      }

      .nalar-security-note {
        margin-top: 13px;

        display: flex;
        align-items: flex-start;
        gap: 9px;

        font-size: 11px;
        line-height: 1.5;

        color: #777781;
      }

      .nalar-security-dot {
        width: 6px;
        height: 6px;

        flex: 0 0 auto;

        margin-top: 5px;

        border-radius: 50%;
        background: #7295bb;

        box-shadow: 0 0 8px rgba(114, 149, 187, 0.35);
      }

      .nalar-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;

        margin-top: 24px;
        padding-top: 18px;

        border-top: 1px solid #202027;
      }

      .nalar-engine {
        font-size: 9px;
        line-height: 1.5;

        color: #62626b;

        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .nalar-engine strong {
        display: block;

        color: #8c8c96;
        font-weight: 600;
      }

      .nalar-actions {
        display: flex;
        gap: 9px;
      }

      button {
        min-width: 112px;
        height: 42px;

        padding: 0 18px;

        border-radius: 9px;

        font-family: inherit;
        font-size: 12px;
        font-weight: 600;

        cursor: pointer;
        transition:
          background 120ms ease,
          border-color 120ms ease,
          color 120ms ease,
          transform 80ms ease;
      }

      button:active {
        transform: translateY(1px);
      }

      .cancel-button {
        background: #17171b;
        border: 1px solid #36363e;
        color: #d0d0d4;
      }

      .cancel-button:hover {
        background: #1d1d22;
        border-color: #46464f;
      }

      .continue-button {
        background: #f4f4f5;
        border: 1px solid #f4f4f5;
        color: #09090b;
      }

      .continue-button:hover {
        background: #ffffff;
      }

      .error {
        margin-top: 9px;

        font-size: 11px;
        line-height: 1.45;

        color: #d89191;
      }

      @media (max-width: 600px) {
        .nalar-modal {
          width: calc(100vw - 20px);
          border-radius: 14px;
        }

        .nalar-header {
          padding: 16px;
        }

        .nalar-body {
          padding: 20px 16px 16px;
        }

        .nalar-title {
          font-size: 21px;
        }

        .nalar-footer {
          align-items: flex-end;
        }

        .nalar-actions {
          flex-direction: column-reverse;
          width: 100%;
          max-width: 180px;
        }

        button {
          width: 100%;
        }
      }
    `;

      const root = document.createElement("div");
      root.className = "nalar-overlay";

      const modal = document.createElement("div");
      modal.className = "nalar-modal";

      const header = document.createElement("div");
      header.className = "nalar-header";

      const brand = document.createElement("div");
      brand.className = "nalar-brand";

      const logo = document.createElement("div");
      logo.className = "nalar-logo";
      logo.textContent = "N";

      const brandText = document.createElement("div");

      const brandName = document.createElement("div");
      brandName.className = "nalar-brand-name";
      brandName.textContent = "NALAR PROTOCOL";

      const brandSubtitle = document.createElement("div");
      brandSubtitle.className = "nalar-brand-subtitle";
      brandSubtitle.textContent = "Browser Transaction Protection";

      brandText.appendChild(brandName);
      brandText.appendChild(brandSubtitle);

      brand.appendChild(logo);
      brand.appendChild(brandText);

      const extensionBadge = document.createElement("div");
      extensionBadge.className = "nalar-extension-badge";
      extensionBadge.textContent = "Extension";

      header.appendChild(brand);
      header.appendChild(extensionBadge);

      const body = document.createElement("div");
      body.className = "nalar-body";

      const title = document.createElement("h2");
      title.className = "nalar-title";
      title.textContent = "What are you trying to do?";

      const description = document.createElement("p");
      description.className = "nalar-description";
      description.textContent = "Tell Nalar your intent. TxSentry will compare it with what the transaction actually does.";

      const origin = document.createElement("div");
      origin.className = "nalar-origin";

      const originLabel = document.createElement("div");
      originLabel.className = "nalar-origin-label";
      originLabel.textContent = "Request from";

      const originValue = document.createElement("div");
      originValue.className = "nalar-origin-value";
      originValue.textContent = window.location.hostname || "Current website";

      origin.appendChild(originLabel);
      origin.appendChild(originValue);

      const inputLabel = document.createElement("label");
      inputLabel.className = "nalar-input-label";
      inputLabel.textContent = "Your intent";

      const textarea = document.createElement("textarea");

      textarea.placeholder = "Example: I want to mint 1 NFT for 0.02 BNB";

      textarea.value = typeof existingIntent === "string" ? existingIntent : "";

      const securityNote = document.createElement("div");
      securityNote.className = "nalar-security-note";

      const securityDot = document.createElement("span");
      securityDot.className = "nalar-security-dot";

      const securityText = document.createElement("span");
      securityText.textContent = "Nalar will analyze this transaction before your wallet is asked to sign.";

      securityNote.appendChild(securityDot);
      securityNote.appendChild(securityText);

      const footer = document.createElement("div");
      footer.className = "nalar-footer";

      const engine = document.createElement("div");
      engine.className = "nalar-engine";

      const engineName = document.createElement("strong");
      engineName.textContent = "TxSentry";

      const engineStatus = document.createElement("span");
      engineStatus.textContent = "Transaction Security Engine";

      engine.appendChild(engineName);
      engine.appendChild(engineStatus);

      const actions = document.createElement("div");
      actions.className = "nalar-actions";

      const cancelButton = document.createElement("button");
      cancelButton.className = "cancel-button";
      cancelButton.textContent = "Cancel";

      const continueButton = document.createElement("button");
      continueButton.className = "continue-button";
      continueButton.textContent = "Continue";

      const error = document.createElement("div");
      error.className = "error";

      actions.appendChild(cancelButton);
      actions.appendChild(continueButton);

      footer.appendChild(engine);
      footer.appendChild(actions);

      body.appendChild(title);
      body.appendChild(description);
      body.appendChild(origin);
      body.appendChild(inputLabel);
      body.appendChild(textarea);
      body.appendChild(securityNote);
      body.appendChild(error);
      body.appendChild(footer);

      modal.appendChild(header);
      modal.appendChild(body);

      root.appendChild(modal);

      shadow.appendChild(style);
      shadow.appendChild(root);

      document.documentElement.appendChild(overlay);

      textarea.focus();

      function cleanup() {
        overlay.remove();
      }

      cancelButton.addEventListener("click", () => {
        cleanup();
        resolve(null);
      });

      continueButton.addEventListener("click", async () => {
        const intent = textarea.value.trim();

        if (!intent) {
          error.textContent = "Please describe what you are trying to do.";
          textarea.focus();
          return;
        }

        continueButton.disabled = true;
        continueButton.textContent = "Saving...";
        error.textContent = "";

        try {
          await saveIntent(intent);

          cleanup();
          resolve(intent);
        } catch (err) {
          console.error("[Nalar] Failed to save intent:", err);

          error.textContent = "Nalar could not save your intent. Please try again.";

          continueButton.disabled = false;
          continueButton.textContent = "Continue";
        }
      });

      textarea.addEventListener("keydown", (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
          continueButton.click();
        }

        if (event.key === "Escape") {
          cancelButton.click();
        }
      });
    });
  }

  async function saveIntent(intent) {
    const id = `save-intent-${Date.now()}-${Math.random()}`;

    return new Promise((resolve, reject) => {
      function handleMessage(event) {
        if (event.source !== window) {
          return;
        }

        const message = event.data;

        if (!message || message.source !== "NALAR_EXTENSION") {
          return;
        }

        if (message.type !== "INTENT_SAVED" || message.id !== id) {
          return;
        }

        window.removeEventListener("message", handleMessage);

        if (message.ok) {
          resolve(true);
        } else {
          reject(new Error(message.error ?? "Failed to save intent."));
        }
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

  let attempts = 0;

  const maxAttempts = 100;

  const timer = setInterval(() => {
    attempts += 1;

    if (install()) {
      clearInterval(timer);
      return;
    }

    if (attempts >= maxAttempts) {
      clearInterval(timer);

      console.warn("[Nalar] Wallet provider was not detected.");
    }
  }, 50);
})();
