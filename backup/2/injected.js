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

  /*
   * Explorers for the chains Nalar can analyse. A chain missing from this map
   * gets plain text rather than a link to an explorer that does not know it.
   */
  const EXPLORERS = {
    97: "https://testnet.bscscan.com",
    56: "https://bscscan.com",
  };

  const SUPPORTED_CHAIN_IDS = new Set([97, 56]);

  function isSupportedChain(chainId) {
    const num = parseNumericChainId(chainId);
    return num !== null && SUPPORTED_CHAIN_IDS.has(num);
  }

  /*
   * Theme, read once per overlay through the bridge: injected.js -> bridge.js
   * -> background.js -> chrome.storage. It is never taken from the page, so a
   * site cannot decide how Nalar's own surface looks. Dark until it arrives.
   */
  let nalarTheme = "dark";

  let elementUid = 0;

  /* Unique ids for aria-labelledby / aria-describedby, one per overlay. */
  function nextId(prefix) {
    elementUid += 1;

    return `nalar-${prefix}-${elementUid}`;
  }

  /*
   * Milliseconds, mirroring the --nalar-motion-* tokens in theme.css. These
   * are the few values a script must hold as numbers, because they drive
   * setTimeout and the analysis interval.
   */
  const MOTION = {
    instant: 120,
    fast: 160,
    normal: 220,
    enter: 300,
    slow: 420,
    exit: 160,
  };

  /* Section reveal offsets for the decision result, in ms. Mirrors
     NALAR_THEME.stagger in theme.js and feeds --nalar-delay on .nalar-rise. */
  const STAGGER = [0, 80, 140, 200, 260];

  function createNalarMarkSvg(size = 12) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 560 560");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("aria-hidden", "true");
    svg.style.flexShrink = "0";
    svg.style.fill = "var(--nalar-text)";
    svg.innerHTML =
      '<rect x="75.39" y="208.7" width="95.75" height="201.58"/><path d="M484.8,209.73V410.59a289.14,289.14,0,0,1-95.91-16.24q-12.28-4.31-24-9.66A291.05,291.05,0,0,1,244.77,283.24a.07.07,0,0,1,0-.06,191.77,191.77,0,0,0-10.9-17.37s0,0,0-.05A194.59,194.59,0,0,0,171.48,209a2.9,2.9,0,0,0-.34-.19V103.88q12.3,4.32,24.07,9.66a290.94,290.94,0,0,1,116,95.47c1.41,2,2.77,3.91,4.11,5.91a187.43,187.43,0,0,0,11,17.5s0,0,0,0a194.47,194.47,0,0,0,62.73,57V209.73Z"/><path fill="#0066FF" d="M484.8,103.88H389.05v33.38l62.37,62.37H484.8Z"/>';
    return svg;
  }

  function createEyebrow(text) {
    const wrap = document.createElement("div");
    wrap.className = "nalar-eyebrow";
    wrap.appendChild(createNalarMarkSvg(12));
    const label = document.createElement("span");
    label.textContent = text;
    wrap.appendChild(label);
    return wrap;
  }

  /*
   * The six checks Nalar runs, in the order the rail shows them. Each one
   * names a source the decision can cite, so a step here always has a
   * counterpart in the evidence: on-chain, simulation, intent, policy, MCP.
   */
  const ANALYSIS_STEPS = ["Understanding your request", "Decoding transaction", "Simulating execution", "Checking contract", "Reviewing on-chain evidence", "Evaluating risk"];

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
    // Matches the exit animation in ui.css (--nalar-motion-fast).
    setTimeout(() => {
      element.remove();
      if (onRemoved) onRemoved();
    }, MOTION.exit);
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

    let protectionEnabled;

    try {
      protectionEnabled = await getProtectionStatus();
    } catch (error) {
      /*
       * Fails closed. Without a readable protection state Nalar cannot claim
       * this transaction was checked, so it is not forwarded - and the notice
       * says why rather than leaving a rejected promise unexplained.
       */
      showErrorNotice(error, "STATUS_UNAVAILABLE");

      throw new Error("[Nalar] Protection status could not be read.");
    }

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
     * Settle the theme before any overlay is built. Every surface reads it once
     * at construction, so it has to be resolved before the first one mounts -
     * and only when a surface might actually appear.
     */

    await refreshTheme();

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
    if (explicitTxChainId !== null && !isSupportedChain(explicitTxChainId)) {
      numericChainId = explicitTxChainId;
    }

    if (!isSupportedChain(numericChainId)) {
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

        async function doSwitch(targetId) {
          const targetChainId = targetId === 56 || explicitTxChainId === 56 ? 56 : 97;
          const targetHex = targetChainId === 56 ? "0x38" : "0x61";

          try {
            await originalRequest({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: targetHex }],
            });

            if (transaction.chainId !== undefined && transaction.chainId !== null) {
              transaction.chainId = typeof transaction.chainId === "number" ? targetChainId : targetHex;
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
            if (isSupportedChain(switched)) {
              if (transaction.chainId !== undefined && transaction.chainId !== null) {
                transaction.chainId = typeof transaction.chainId === "number" ? switched : switched === 56 ? "0x38" : "0x61";
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

        showErrorNotice("Security analysis timed out.", "TIMEOUT");

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
          showErrorNotice(message.error, message.errorCode);

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
  | DEAD CODE - pending deletion.
  |
  | Everything from here to the "Overlay shell" section below is the previous
  | presentation layer. It is unreachable: every function in it is redeclared
  | later in this file (function declarations hoist, so the later one wins),
  | and it references the removed UI palette and installStyles(), which no
  | longer exist. It is kept only because the tooling that would delete it was
  | unavailable; it is not called and not maintained. Do not add to it.
  |--------------------------------------------------------------------------
  |
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

  /*
  |--------------------------------------------------------------------------
  | Overlay shell
  |--------------------------------------------------------------------------
  |
  | Four surfaces share one frame: the intent prompt, the analysis rail, the
  | decision result and the network gate. They are built from the classes in
  | ui.css, so all four render from the tokens in theme.css and not one
  | builder carries a colour of its own.
  |
  */

  /*
   * Theme, read once per overlay through the bridge: injected.js -> bridge.js
   * -> background.js -> chrome.storage. It is never taken from the page, so a
   * site cannot decide how Nalar's own surface looks.
   */
  async function refreshTheme() {
    try {
      const result = await requestBridge("GET_THEME", {}, 800);

      if (result && (result.theme === "light" || result.theme === "dark")) {
        nalarTheme = result.theme;
      }
    } catch {
      /* Keep the cached theme. Failing to read a preference is not a reason to
         re-theme a surface the user is already reading. */
    }
  }

  function createRoot(id, labelledBy) {
    const root = document.createElement("div");

    root.id = id;

    root.className = "nalar-root";

    root.setAttribute("role", "dialog");

    root.setAttribute("aria-modal", "true");

    root.setAttribute("data-nalar-theme", nalarTheme);

    if (labelledBy) {
      root.setAttribute("aria-labelledby", labelledBy);
    }

    return root;
  }

  function createModal(options = {}) {
    const modal = document.createElement("div");

    let classes = "nalar-modal";
    if (options.compact) {
      classes += " nalar-modal--compact";
    }
    if (options.variant) {
      classes += ` nalar-modal--${options.variant}`;
    }

    modal.className = classes;

    return modal;
  }

  /* Two light points and one arc, static, clipped to the header. This is the
     entire cosmic budget, and the only decorative element Nalar ships. */
  function createCosmos() {
    const cosmos = document.createElement("div");

    cosmos.className = "nalar-cosmos";

    cosmos.setAttribute("aria-hidden", "true");

    ["a", "b"].forEach((variant) => {
      const star = document.createElement("span");

      star.className = `nalar-star nalar-star--${variant}`;

      cosmos.appendChild(star);
    });

    const orbit = document.createElement("span");

    orbit.className = "nalar-orbit";

    cosmos.appendChild(orbit);

    return cosmos;
  }

  function createHead() {
    const head = document.createElement("header");

    head.className = "nalar-head";

    head.appendChild(createCosmos());

    return head;
  }

  function createTitle(text, id) {
    const title = document.createElement("h2");

    title.className = "nalar-title";

    title.id = id;

    title.textContent = text;

    return title;
  }

  function createLede(text) {
    const lede = document.createElement("p");

    lede.className = "nalar-lede";

    lede.textContent = text;

    return lede;
  }

  function createBody() {
    const body = document.createElement("main");

    body.className = "nalar-body";

    return body;
  }

  function createFoot() {
    const foot = document.createElement("footer");

    foot.className = "nalar-foot";

    return foot;
  }

  function createLabel(text, node) {
    const label = document.createElement("p");

    label.className = node ? "nalar-label nalar-label--node" : "nalar-label";

    label.textContent = text;

    return label;
  }

  function createProse(text, variant) {
    const prose = document.createElement("p");

    prose.className = variant ? `nalar-prose nalar-prose--${variant}` : "nalar-prose";

    prose.textContent = text;

    return prose;
  }

  function createMono(text) {
    const mono = document.createElement("span");

    mono.className = "nalar-mono";

    mono.textContent = text;

    return mono;
  }

  function createRow(key, value) {
    const row = document.createElement("div");

    row.className = "nalar-row";

    const keyEl = document.createElement("span");

    keyEl.className = "nalar-row-key";

    keyEl.textContent = key;

    const valueEl = document.createElement("span");

    valueEl.className = "nalar-row-val";

    if (value instanceof Node) {
      valueEl.appendChild(value);
    } else {
      valueEl.textContent = String(value ?? "");
    }

    row.appendChild(keyEl);

    row.appendChild(valueEl);

    return row;
  }

  function createButton(label, primary) {
    const button = document.createElement("button");

    button.className = primary ? "nalar-btn nalar-btn--primary" : "nalar-btn";

    button.type = "button";

    button.textContent = label;

    return button;
  }

  function createActions() {
    const actions = document.createElement("div");

    actions.className = "nalar-actions nalar-actions--split";

    return actions;
  }

  function createNote(text) {
    const note = document.createElement("p");

    note.className = "nalar-foot-note";

    note.textContent = text;

    return note;
  }

  function createStatusLine() {
    const status = document.createElement("p");

    status.className = "nalar-status-line";

    status.setAttribute("role", "status");

    return status;
  }

  function createDisclosure(title, count) {
    const details = document.createElement("details");

    details.className = "nalar-disclosure";

    const summary = document.createElement("summary");

    const label = document.createElement("span");

    label.textContent = title;

    summary.appendChild(label);

    if (count) {
      const counter = document.createElement("span");

      counter.className = "nalar-disclosure-count";

      counter.textContent = count;

      summary.appendChild(counter);
    }

    const body = document.createElement("div");

    body.className = "nalar-disclosure-body";

    details.appendChild(summary);

    details.appendChild(body);

    return { details, body };
  }

  /* Staggered reveal: one class and one custom property, set from JS. */
  function rise(element, step) {
    element.classList.add("nalar-rise");

    element.style.setProperty("--nalar-delay", `${STAGGER[step] ?? 0}ms`);

    return element;
  }

  function mount(root) {
    document.documentElement.appendChild(root);

    return root;
  }

  /*
  |--------------------------------------------------------------------------
  | Keyboard and focus
  |--------------------------------------------------------------------------
  */

  function rememberFocus() {
    const active = document.activeElement;

    return active && typeof active.focus === "function" ? active : null;
  }

  function restoreFocus(element) {
    if (!element || !document.contains(element)) {
      return;
    }

    try {
      element.focus({ preventScroll: true });
    } catch {}
  }

  function focusableIn(root) {
    const selector = 'a[href], button:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

    return Array.from(root.querySelectorAll(selector)).filter((element) => element.offsetParent !== null);
  }

  /*
   * A decision has to hold the keyboard while it is open and give it back when
   * it closes. Escape is wired to the same action as the cancel path, so there
   * is no state the mouse can leave and the keyboard cannot.
   */
  function trapFocus(root, onEscape) {
    function onKeydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();

        onEscape();

        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const items = focusableIn(root);

      if (items.length === 0) {
        return;
      }

      const first = items[0];

      const last = items[items.length - 1];

      const active = document.activeElement;

      if (event.shiftKey && (active === first || !root.contains(active))) {
        event.preventDefault();

        last.focus();

        return;
      }

      if (!event.shiftKey && active === last) {
        event.preventDefault();

        first.focus();
      }
    }

    document.addEventListener("keydown", onKeydown, true);

    return () => document.removeEventListener("keydown", onKeydown, true);
  }

  /*
  |--------------------------------------------------------------------------
  | Values: addresses, sources, token differences
  |--------------------------------------------------------------------------
  */

  function explorerUrl(chainId, address) {
    const base = EXPLORERS[chainId] || (Number(chainId) === 56 ? "https://bscscan.com" : "https://testnet.bscscan.com");

    if (!base || !/^0x[a-fA-F0-9]{40}$/.test(String(address))) {
      return null;
    }

    return `${base}/address/${address}`;
  }

  function txExplorerUrl(chainId, hash) {
    const base = EXPLORERS[chainId] || (Number(chainId) === 56 ? "https://bscscan.com" : "https://testnet.bscscan.com");

    if (!base || !/^0x[a-fA-F0-9]{64}$/.test(String(hash))) {
      return null;
    }

    return `${base}/tx/${hash}`;
  }

  /*
   * A contract address is the one value a user may want to check away from
   * this modal, so it is a real link into the chain's explorer. An address on
   * a chain with no explorer entry stays plain text rather than pointing at an
   * explorer that would not know it.
   */
  function createAddress(address, chainId = 97) {
    const text = formatAddress(address);

    const href = explorerUrl(chainId, address);

    if (!href) {
      return createMono(text);
    }

    const link = document.createElement("a");

    link.className = "nalar-addr";

    link.href = href;

    link.target = "_blank";

    link.rel = "noopener noreferrer";

    link.title = `${address} · opens the block explorer`;

    link.textContent = text;

    const external = document.createElement("span");

    external.className = "nalar-addr-ext";

    external.setAttribute("aria-hidden", "true");

    external.textContent = "↗";

    link.appendChild(external);

    return link;
  }

  function createTxLink(hash, chainId = 97) {
    const text = typeof hash === "string" && hash.length > 14 ? `${hash.slice(0, 8)}...${hash.slice(-6)}` : String(hash);

    const href = txExplorerUrl(chainId, hash);

    if (!href) {
      return createMono(text);
    }

    const link = document.createElement("a");

    link.className = "nalar-addr";

    link.href = href;

    link.target = "_blank";

    link.rel = "noopener noreferrer";

    link.title = `${hash} · opens the block explorer`;

    link.textContent = text;

    const external = document.createElement("span");

    external.className = "nalar-addr-ext";

    external.setAttribute("aria-hidden", "true");

    external.textContent = "↗";

    link.appendChild(external);

    return link;
  }

  const SOURCE_LABELS = {
    ONCHAIN: "ON-CHAIN",
    "ON-CHAIN": "ON-CHAIN",
    ON_CHAIN: "ON-CHAIN",
    SIMULATION: "SIMULATION",
    INTENT: "INTENT",
    POLICY: "POLICY",
    MCP: "BNB MCP",
    BNB_MCP: "BNB MCP",
    "BNB MCP": "BNB MCP",
  };

  function formatSource(source) {
    if (!source) {
      return "";
    }

    const key = String(source).trim().toUpperCase();

    return SOURCE_LABELS[key] ?? key.replaceAll("_", " ");
  }

  function createSourceBadge(source) {
    const badge = document.createElement("span");

    badge.className = "nalar-source";

    badge.textContent = formatSource(source);

    return badge;
  }

  function tokenize(text) {
    return String(text ?? "")
      .split(/\s+/)
      .filter(Boolean);
  }

  function normalizeToken(token) {
    return token.toLowerCase().replace(/[^a-z0-9.]/g, "");
  }

  /*
   * Longest common subsequence over the two sentences, so only the tokens the
   * transaction actually changed get marked: "swap tBNB to NDEMO" against
   * "swap tBNB to DHON" marks DHON and leaves the rest of the line alone.
   *
   * When almost nothing is shared the two sentences have too little in common
   * for a mark to read as a difference, and marking every word would only
   * shout, so nothing is marked and the rows below state the difference.
   */
  function diffTokens(expected, actual) {
    const left = tokenize(expected).map(normalizeToken);

    const right = tokenize(actual).map(normalizeToken);

    const table = Array.from({ length: left.length + 1 }, () => new Uint16Array(right.length + 1));

    for (let i = left.length - 1; i >= 0; i -= 1) {
      for (let j = right.length - 1; j >= 0; j -= 1) {
        table[i][j] = left[i] === right[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
      }
    }

    const kept = new Array(right.length).fill(false);

    let i = 0;

    let j = 0;

    while (i < left.length && j < right.length) {
      if (left[i] === right[j]) {
        kept[j] = true;

        i += 1;

        j += 1;
      } else if (table[i + 1][j] >= table[i][j + 1]) {
        i += 1;
      } else {
        j += 1;
      }
    }

    const marked = kept.filter((value) => !value).length;

    if (right.length === 0 || marked > right.length * 0.6) {
      return null;
    }

    return kept;
  }

  function createComparedText(text, expected, markDifferences) {
    const prose = document.createElement("p");

    prose.className = "nalar-compare-text";

    const tokens = tokenize(text);

    const kept = markDifferences ? diffTokens(expected, text) : null;

    if (!kept || tokens.length === 0) {
      prose.textContent = text;

      return prose;
    }

    tokens.forEach((token, index) => {
      if (index > 0) {
        prose.appendChild(document.createTextNode(" "));
      }

      if (kept[index]) {
        prose.appendChild(document.createTextNode(token));

        return;
      }

      const mark = document.createElement("span");

      mark.className = "nalar-diff";

      mark.textContent = token;

      prose.appendChild(mark);
    });

    return prose;
  }

  /*
  |--------------------------------------------------------------------------
  | Intent prompt
  |--------------------------------------------------------------------------
  */

  function showIntentOverlay(existingIntent = "") {
    removeNalarElement(IDS.intent);

    return new Promise((resolve) => {
      const titleId = nextId("intent-title");

      const textareaId = nextId("intent-field");

      const statusId = nextId("intent-status");

      const previousFocus = rememberFocus();

      const root = createRoot(IDS.intent, titleId);

      const modal = createModal({ compact: true, variant: "intent" });

      const head = createHead();

      head.appendChild(createEyebrow("NALAR PROTOCOL"));

      head.appendChild(createTitle("What are you trying to do?", titleId));

      head.appendChild(createLede("Describe what you expect this transaction to do."));

      const body = createBody();

      const section = document.createElement("section");

      section.className = "nalar-section nalar-section--first";

      /* Node dot on the section label only, so it reads as the section head and
       not as a second field label next to YOUR INTENT below it. */
      section.appendChild(createLabel("REQUEST FROM", true));

      const site = document.createElement("p");

      site.className = "nalar-site";

      site.textContent = window.location.hostname || "This website";

      section.appendChild(site);

      const fieldLabel = document.createElement("label");

      fieldLabel.className = "nalar-label nalar-field-label";

      fieldLabel.setAttribute("for", textareaId);

      fieldLabel.textContent = "YOUR INTENT";

      section.appendChild(fieldLabel);

      const textarea = document.createElement("textarea");

      textarea.className = "nalar-textarea";

      textarea.id = textareaId;

      textarea.spellcheck = false;

      textarea.setAttribute("aria-describedby", statusId);

      textarea.placeholder = "Example: Swap 0.001 tBNB to NDEMO";

      textarea.value = typeof existingIntent === "string" ? existingIntent : "";

      section.appendChild(textarea);

      body.appendChild(section);

      const foot = createFoot();

      foot.appendChild(createNote("Nalar checks this before your wallet is asked to sign."));

      const status = createStatusLine();

      status.id = statusId;

      foot.appendChild(status);

      const actions = createActions();

      const cancelButton = createButton("Cancel", false);

      const analyzeButton = createButton("Analyze transaction", true);

      actions.appendChild(cancelButton);

      actions.appendChild(analyzeButton);

      foot.appendChild(actions);

      modal.appendChild(head);

      modal.appendChild(body);

      modal.appendChild(foot);

      root.appendChild(modal);

      let released = false;

      let release = () => {};

      function finish(value) {
        if (released) {
          return;
        }

        released = true;

        release();

        restoreFocus(previousFocus);

        dismissNalarElement(IDS.intent, () => resolve(value));
      }

      cancelButton.onclick = () => finish(null);

      analyzeButton.onclick = () => {
        const value = textarea.value.trim();

        if (!value) {
          status.textContent = "Add a short description before analyzing.";

          textarea.setAttribute("aria-invalid", "true");

          textarea.focus();

          return;
        }

        textarea.removeAttribute("aria-invalid");

        finish(value);
      };

      textarea.addEventListener("input", () => {
        textarea.removeAttribute("aria-invalid");

        if (status.textContent) {
          status.textContent = "";
        }
      });

      textarea.addEventListener("keydown", (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
          event.preventDefault();

          analyzeButton.click();
        }
      });

      mount(root);

      release = trapFocus(root, () => finish(null));

      textarea.focus();
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Network gate
  |--------------------------------------------------------------------------
  |
  | The gate is a comparison too: where the wallet is against where the
  | analysis happens. Same primitive as the intent check, so the user learns
  | one shape and reads four screens with it.
  |
  */

  function showNetworkNotSupportedOverlay({ currentChainId, onSwitch, onCancel }) {
    removeNalarElement(IDS.network);

    removeNalarElement(IDS.analysis);

    removeNalarElement(IDS.decision);

    removeNalarElement(IDS.intent);

    const titleId = nextId("network-title");

    const previousFocus = rememberFocus();

    const root = createRoot(IDS.network, titleId);

    const modal = createModal({ compact: true, variant: "network" });

    const head = createHead();

    head.appendChild(createEyebrow("NALAR PROTOCOL · NETWORK CHECK"));

    head.appendChild(createTitle("Network not supported", titleId));

    head.appendChild(createLede("Nalar supports BNB Smart Chain Testnet (97) and Mainnet (56)."));

    const body = createBody();

    const section = document.createElement("section");

    section.className = "nalar-section nalar-section--first";

    /* No section label: the compare already names both sides, and a third
       heading above them would only repeat the title. */
    const compareBlock = document.createElement("div");

    compareBlock.className = "nalar-compare-block";

    compareBlock.setAttribute("data-match", "false");

    const compare = document.createElement("div");

    compare.className = "nalar-compare";

    const walletSide = document.createElement("div");

    walletSide.className = "nalar-compare-side";

    walletSide.appendChild(createLabel("YOUR WALLET"));

    const walletName = document.createElement("p");

    walletName.className = "nalar-network-name";

    walletName.textContent = getChainName(currentChainId);

    walletSide.appendChild(walletName);

    const walletId = document.createElement("p");

    walletId.className = "nalar-network-id";

    walletId.textContent = currentChainId === null || currentChainId === undefined ? "Chain ID unknown" : `Chain ID ${currentChainId}`;

    walletSide.appendChild(walletId);

    const rail = document.createElement("div");

    rail.className = "nalar-compare-rail";

    rail.setAttribute("aria-hidden", "true");

    const requiredSide = document.createElement("div");

    requiredSide.className = "nalar-compare-side";

    requiredSide.appendChild(createLabel("SUPPORTED NETWORKS"));

    const requiredBox = document.createElement("div");

    requiredBox.className = "nalar-network-box";

    requiredBox.setAttribute("data-role", "required");

    const requiredName = document.createElement("p");

    requiredName.className = "nalar-network-name";

    requiredName.textContent = "BNB Smart Chain";

    requiredBox.appendChild(requiredName);

    const requiredId = document.createElement("p");

    requiredId.className = "nalar-network-id";

    requiredId.textContent = "Mainnet (56) · Testnet (97)";

    requiredBox.appendChild(requiredId);

    requiredSide.appendChild(requiredBox);

    compare.appendChild(walletSide);

    compare.appendChild(rail);

    compare.appendChild(requiredSide);

    compareBlock.appendChild(compare);

    const chip = document.createElement("p");

    chip.className = "nalar-verdict-chip";

    chip.textContent = "✕ SWITCH REQUIRED";

    compareBlock.appendChild(chip);

    section.appendChild(compareBlock);

    section.appendChild(createProse("Switch your wallet to BNB Smart Chain (Mainnet 56 or Testnet 97) to continue. Nalar runs the check again on the supported network.", "muted"));

    body.appendChild(section);

    const foot = createFoot();

    const status = createStatusLine();

    foot.appendChild(status);

    const actions = createActions();

    const cancelButton = createButton("Cancel", false);

    const switchButton = createButton("Switch to BNB Chain", true);

    actions.appendChild(cancelButton);

    actions.appendChild(switchButton);

    foot.appendChild(actions);

    modal.appendChild(head);

    modal.appendChild(body);

    modal.appendChild(foot);

    root.appendChild(modal);

    let released = false;

    let release = () => {};

    function finish(callback) {
      if (released) {
        return;
      }

      released = true;

      release();

      restoreFocus(previousFocus);

      dismissNalarElement(IDS.network, () => {
        if (typeof callback === "function") {
          callback();
        }
      });
    }

    cancelButton.onclick = () => finish(onCancel);

    switchButton.onclick = async () => {
      if (typeof onSwitch !== "function") {
        return;
      }

      switchButton.disabled = true;

      switchButton.textContent = "Switching…";

      status.textContent = "Waiting for your wallet to confirm the switch.";

      try {
        await onSwitch();
      } catch {
        switchButton.disabled = false;

        switchButton.textContent = "Switch to BNB Testnet";

        status.textContent = "The switch did not go through. Open your wallet and select BNB Smart Chain Testnet.";
      }
    };

    mount(root);

    release = trapFocus(root, () => finish(onCancel));

    switchButton.focus();

    return {
      overlay: root,

      setStatus(message) {
        status.textContent = message;
      },

      remove(callback) {
        released = true;

        release();

        dismissNalarElement(IDS.network, callback);
      },
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Analysis rail
  |--------------------------------------------------------------------------
  |
  | The six checks on a vertical rail. The rail replaces a spinner because a
  | spinner says "wait" while this says what is being waited for, and the light
  | travelling down it is the only motion in the product that runs on its own.
  | It is CSS on a node that is removed with the overlay, so no timer and no
  | listener outlives the check.
  |
  | The step timing is theatre, and it is capped: the overlay is removed the
  | moment the backend answers, so a fast check shows a step or two and a
  | result rather than a full six-step performance.
  |
  */

  /* Per-step reveal offset, and how long the rail dwells on a step. */
  const RAIL_STEP_DELAY = 48;

  const RAIL_STEP_MS = 560;

  function showAnalysisOverlay() {
    removeNalarElement(IDS.analysis);

    const titleId = nextId("analysis-title");

    const root = createRoot(IDS.analysis, titleId);

    const modal = createModal({ compact: true, variant: "analysis" });

    const head = createHead();

    head.appendChild(createEyebrow("NALAR PROTOCOL"));

    head.appendChild(createTitle("Analyzing transaction", titleId));

    head.appendChild(createLede("Understanding what you're about to sign."));

    const body = createBody();

    const section = document.createElement("section");

    section.className = "nalar-section nalar-section--first";

    const rail = document.createElement("div");

    rail.className = "nalar-rail";

    rail.setAttribute("role", "status");

    rail.setAttribute("aria-live", "polite");

    const rows = ANALYSIS_STEPS.map((label, index) => {
      const row = document.createElement("div");

      row.className = "nalar-step nalar-rise";

      row.setAttribute("data-state", index === 0 ? "active" : "pending");

      row.style.setProperty("--nalar-delay", `${index * RAIL_STEP_DELAY}ms`);

      const node = document.createElement("span");

      node.className = "nalar-step-node";

      const num = document.createElement("span");

      num.className = "nalar-step-num";

      num.textContent = String(index + 1).padStart(2, "0");

      const text = document.createElement("span");

      text.className = "nalar-step-text";

      text.textContent = label;

      row.appendChild(node);

      row.appendChild(num);

      row.appendChild(text);

      rail.appendChild(row);

      return row;
    });

    section.appendChild(rail);

    body.appendChild(section);

    modal.appendChild(head);

    modal.appendChild(body);

    root.appendChild(modal);

    mount(root);

    let current = 0;

    const timer = setInterval(() => {
      if (!document.getElementById(IDS.analysis)) {
        clearInterval(timer);

        return;
      }

      /* Hold on the last step until the backend answers: inventing progress
         past the final check would be a lie about what is still running. */
      if (current >= rows.length - 1) {
        return;
      }

      rows[current].setAttribute("data-state", "done");

      current += 1;

      rows[current].setAttribute("data-state", "active");
    }, RAIL_STEP_MS);

    return {
      remove(callback) {
        clearInterval(timer);

        dismissNalarElement(IDS.analysis, callback);
      },
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Decision result
  |--------------------------------------------------------------------------
  |
  | Ordered so the answer arrives before the reasoning: decision, then why,
  | then what you asked against what this does, then what it means. Evidence
  | and technical detail are collapsed, because they are what a user reaches
  | for after the first four have done their job.
  |
  */

  function showDecisionOverlay(security, decision, onContinue, onCancel) {
    removeNalarElement(IDS.decision);

    removeNalarElement(IDS.analysis);

    const riskLevel = String(security?.riskLevel ?? "UNKNOWN").toUpperCase();

    const riskScore = Number.isFinite(Number(security?.riskScore)) ? Math.max(0, Math.min(100, Number(security.riskScore))) : 0;

    const status = getDecisionStatus(decision);

    const explanation = security?.explanation ?? {};

    const titleId = nextId("decision-title");

    const previousFocus = rememberFocus();

    const root = createRoot(IDS.decision, titleId);

    const modal = createModal({ variant: "decision" });

    modal.setAttribute("data-decision", String(decision).toLowerCase());

    const head = createHead();

    const tx = security?.transaction || security?.request || {};
    const chainId = Number(tx.chainId ?? security?.chainId ?? 97);
    const networkBadge = chainId === 56 ? "BSC MAINNET" : "BSC TESTNET";

    head.appendChild(createEyebrow(`NALAR PROTOCOL · ${networkBadge}`));

    head.appendChild(createVerdict(decision, status, riskLevel, riskScore, titleId));

    head.appendChild(createLede(status.subtitle));

    rise(head, 0);

    const body = createBody();

    body.appendChild(createRootCauseSection(explanation, security, decision));

    body.appendChild(createComparisonSection(explanation, security, decision));

    const means = createWhatThisMeansSection(explanation, security, decision);

    if (means) {
      body.appendChild(means);
    }

    const evidence = createEvidenceDisclosure(explanation, security);

    if (evidence) {
      body.appendChild(evidence);
    }

    body.appendChild(createTechnicalDisclosure(explanation, security));

    const foot = createFoot();

    foot.appendChild(createNote(getFooterNote(decision)));

    const actions = createActions();

    const cancelButton = createButton(decision === "BLOCK" ? "Close" : "Cancel", decision === "BLOCK");

    actions.appendChild(cancelButton);

    if (decision !== "BLOCK") {
      const continueButton = createButton(decision === "REVIEW" ? "Review & Continue" : "Continue", true);

      continueButton.onclick = () => finish(onContinue);

      actions.appendChild(continueButton);
    }

    foot.appendChild(actions);

    modal.appendChild(head);

    modal.appendChild(body);

    modal.appendChild(foot);

    root.appendChild(modal);

    let released = false;

    let release = () => {};

    function finish(callback) {
      if (released) {
        return;
      }

      released = true;

      release();

      restoreFocus(previousFocus);

      dismissNalarElement(IDS.decision, () => {
        if (typeof callback === "function") {
          callback();
        }
      });
    }

    cancelButton.onclick = () => finish(onCancel);

    mount(root);

    release = trapFocus(root, () => finish(onCancel));

    /* Focus lands on the safe action, never on the one that signs. */
    cancelButton.focus();
  }

  function createVerdict(decision, status, riskLevel, riskScore, titleId) {
    const verdict = document.createElement("div");

    verdict.className = "nalar-verdict";

    const mark = document.createElement("div");

    mark.className = "nalar-verdict-mark";

    mark.setAttribute("aria-hidden", "true");

    mark.textContent = decision === "BLOCK" ? "✕" : decision === "REVIEW" ? "!" : "✓";

    const title = document.createElement("h2");

    title.className = "nalar-verdict-title";

    title.id = titleId;

    title.textContent = status.title;

    const score = document.createElement("div");

    score.className = "nalar-score";

    const value = document.createElement("span");

    value.className = "nalar-score-value";

    value.textContent = String(riskScore);

    const max = document.createElement("span");

    max.className = "nalar-score-max";

    max.textContent = " / 100";

    const level = document.createElement("span");

    level.className = "nalar-score-level";

    level.textContent = riskLevel;

    score.appendChild(value);

    score.appendChild(max);

    score.appendChild(level);

    verdict.appendChild(mark);

    verdict.appendChild(title);

    verdict.appendChild(score);

    return verdict;
  }

  /*
   * The single sentence that answers "why". Ordered by how directly each
   * source explains the decision: a stated intent mismatch first, because that
   * is the failure the user can act on, then the concrete contract hazards the
   * scam analyses found, then the generic explanations.
   */
  function getPrimaryRootCause(explanation, security, decision) {
    const comparison = security?.comparison || {};

    const isMismatch = security?.intentMatch === false || comparison.overall === "MISMATCH" || explanation?.comparison?.status === "MISMATCH";

    if (isMismatch) {
      if (typeof explanation?.whyStopped?.primaryReason === "string" && explanation.whyStopped.primaryReason.trim()) {
        return explanation.whyStopped.primaryReason.trim();
      }

      if (typeof explanation?.comparison?.summary === "string" && explanation.comparison.summary.trim()) {
        return explanation.comparison.summary.trim();
      }

      if (comparison.summary) {
        return comparison.summary;
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

    const analyses = Array.isArray(security?.scamAnalyses) ? security.scamAnalyses : Array.isArray(security?.transactionScamContext?.analyses) ? security.transactionScamContext.analyses : [];

    for (const analysis of analyses) {
      const state = Array.isArray(analysis?.contractPrivileges?.state) ? analysis.contractPrivileges.state : [];

      const sellTax = state.find((entry) => entry?.code === "CURRENT_SELL_TAX");

      if (sellTax && Number(sellTax.value) >= 2000) {
        const percent = (Number(sellTax.value) / 100).toFixed(0);

        return `The contract charges a ${percent}% sell tax, so you may not be able to exit at the value you expect.`;
      }

      const findings = Array.isArray(analysis?.findings) ? analysis.findings : [];

      const critical = findings.find((finding) => String(finding?.severity).toUpperCase() === "CRITICAL" || String(finding?.severity).toUpperCase() === "HIGH");

      if (critical?.title) {
        return critical.title;
      }
    }

    if (security?.simulation && security.simulation.success === false) {
      return "The transaction failed during simulation and would revert on-chain.";
    }

    if (typeof explanation?.whyStopped?.primaryReason === "string" && explanation.whyStopped.primaryReason.trim()) {
      return explanation.whyStopped.primaryReason.trim();
    }

    if (typeof explanation?.summary === "string" && explanation.summary.trim()) {
      return explanation.summary.trim();
    }

    return getFallbackSummary(security, decision);
  }

  function createRootCauseSection(explanation, security, decision) {
    const section = document.createElement("section");

    section.className = "nalar-section nalar-section--first nalar-section--state";

    rise(section, 1);

    const label = decision === "BLOCK" ? "WHY NALAR STOPPED THIS" : decision === "REVIEW" ? "WHY THIS NEEDS YOUR ATTENTION" : "SECURITY ASSESSMENT";

    /* Node dot: the rail motif, and this section is --state so the dot takes
       the decision colour rather than the accent. */
    section.appendChild(createLabel(label, true));

    const reason = getPrimaryRootCause(explanation, security, decision);

    section.appendChild(createProse(reason, "strong"));

    const impact = typeof explanation?.whyStopped?.userImpact === "string" && explanation.whyStopped.userImpact.trim() ? explanation.whyStopped.userImpact.trim() : null;

    if (impact && impact !== reason) {
      section.appendChild(createProse(impact, "muted"));
    }

    return section;
  }

  function readIntentText(explanation, security) {
    if (typeof explanation?.userIntent === "string" && explanation.userIntent.trim()) {
      return explanation.userIntent.trim();
    }

    if (typeof explanation?.userIntent?.summary === "string" && explanation.userIntent.summary.trim()) {
      return explanation.userIntent.summary.trim();
    }

    if (typeof explanation?.userIntent?.description === "string" && explanation.userIntent.description.trim()) {
      return explanation.userIntent.description.trim();
    }

    if (security?.intent?.description) {
      return security.intent.description;
    }

    return "Not specified";
  }

  function readActualText(explanation, security) {
    if (typeof explanation?.actualTransaction === "string" && explanation.actualTransaction.trim()) {
      return explanation.actualTransaction.trim();
    }

    if (typeof explanation?.actualTransaction?.summary === "string" && explanation.actualTransaction.summary.trim()) {
      return explanation.actualTransaction.summary.trim();
    }

    if (security?.transactionSummary?.title) {
      return security.transactionSummary.title;
    }

    if (security?.transactionSummary?.summary) {
      return security.transactionSummary.summary;
    }

    if (security?.actual?.action) {
      return humanizeAction(security.actual.action);
    }

    return "Contract call";
  }

  /* The per-field differences, for when the headline sentence is not enough. */
  function buildMismatchRows(comparison) {
    const rows = [];

    const comp = comparison || {};

    const isMint = comp.action?.expected === "MINT" || comp.action?.actual === "MINT";

    if (comp.quantity && comp.quantity.status === "MISMATCH") {
      rows.push(`${isMint ? "NFT quantity" : "Quantity"}: expected ${comp.quantity.expected}, actual ${comp.quantity.actual}`);
    }

    if (comp.amount && comp.amount.status === "MISMATCH") {
      rows.push(`${isMint ? "Payment" : "Amount"}: expected ${comp.amount.expected}, actual ${comp.amount.actual}`);
    }

    if (comp.outputToken && comp.outputToken.status === "MISMATCH") {
      rows.push(`Receive token: expected ${comp.outputToken.expected || "token"}, actual ${comp.outputToken.actual || "token"}`);
    }

    if (comp.inputToken && comp.inputToken.status === "MISMATCH") {
      rows.push(`Send token: expected ${comp.inputToken.expected || "token"}, actual ${comp.inputToken.actual || "token"}`);
    }

    if (comp.action && comp.action.status === "MISMATCH") {
      rows.push(`Action: expected ${humanizeAction(comp.action.expected)}, actual ${humanizeAction(comp.action.actual)}`);
    }

    if (comp.recipient && comp.recipient.status === "MISMATCH") {
      rows.push(`Recipient: expected ${formatAddress(comp.recipient.expected)}, actual ${formatAddress(comp.recipient.actual)}`);
    }

    if (Array.isArray(comp.mismatches)) {
      const mentionsContract = comp.mismatches.some((mismatch) => typeof mismatch === "string" && mismatch.toLowerCase().includes("not a smart contract"));

      if (mentionsContract) {
        rows.push("Target: the destination is not a smart contract");
      }
    }

    if (rows.length === 0 && Array.isArray(comp.mismatches)) {
      comp.mismatches.forEach((mismatch) => {
        if (typeof mismatch === "string" && mismatch.trim()) {
          rows.push(mismatch.trim());
        }
      });
    }

    return rows;
  }

  function createComparisonSection(explanation, security, decision) {
    const section = document.createElement("section");

    section.className = "nalar-section";

    rise(section, 2);

    section.appendChild(createLabel("YOUR REQUEST VS ACTUAL TRANSACTION"));

    const comp = security?.comparison || {};

    const isMismatch = comp.overall === "MISMATCH" || explanation?.comparison?.status === "MISMATCH" || security?.intentMatch === false;

    const isUncertain = !isMismatch && (comp.overall === "UNCERTAIN" || explanation?.comparison?.status === "UNKNOWN");

    const block = document.createElement("div");

    block.className = "nalar-compare-block";

    block.setAttribute("data-match", isMismatch ? "false" : isUncertain ? "unknown" : "true");

    const intentText = readIntentText(explanation, security);

    const actualText = readActualText(explanation, security);

    const compare = document.createElement("div");

    compare.className = "nalar-compare";

    const expectedSide = document.createElement("div");

    expectedSide.className = "nalar-compare-side";

    expectedSide.appendChild(createLabel("YOUR REQUEST"));

    expectedSide.appendChild(createComparedText(intentText, "", false));

    const rail = document.createElement("div");

    rail.className = "nalar-compare-rail";

    rail.setAttribute("aria-hidden", "true");

    const actualSide = document.createElement("div");

    actualSide.className = "nalar-compare-side nalar-compare-side--actual";

    actualSide.appendChild(createLabel("ACTUAL TRANSACTION"));

    /* Only the tokens that differ are marked, and only when the two sentences
       are close enough that a mark reads as a difference rather than noise. */
    actualSide.appendChild(createComparedText(actualText, intentText, isMismatch && intentText !== "Not specified"));

    compare.appendChild(expectedSide);

    compare.appendChild(rail);

    compare.appendChild(actualSide);

    block.appendChild(compare);

    const chip = document.createElement("p");

    chip.className = "nalar-verdict-chip";

    chip.textContent = isMismatch ? "✕ DOESN'T MATCH YOUR REQUEST" : isUncertain ? "? NOT VERIFIED" : "✓ MATCHES YOUR REQUEST";

    block.appendChild(chip);

    if (isMismatch) {
      const rows = buildMismatchRows(comp);

      if (rows.length > 0) {
        const diffs = document.createElement("div");

        diffs.className = "nalar-diffs";

        rows.forEach((text) => {
          const row = document.createElement("p");

          row.className = "nalar-diff-row";

          row.textContent = text;

          diffs.appendChild(row);
        });

        block.appendChild(diffs);
      }
    }

    section.appendChild(block);

    return section;
  }

  function createWhatThisMeansSection(explanation, security, decision) {
    const meaning = typeof explanation?.whatThisMeans === "string" ? explanation.whatThisMeans.trim() : typeof explanation?.whyStopped?.userImpact === "string" ? explanation.whyStopped.userImpact.trim() : "";

    const nextStep = typeof explanation?.recommendation === "string" ? explanation.recommendation.trim() : "";

    if (!meaning && !nextStep) {
      return null;
    }

    const section = document.createElement("section");

    section.className = "nalar-section";

    rise(section, 3);

    section.appendChild(createLabel("WHAT THIS MEANS", true));

    if (meaning) {
      section.appendChild(createProse(meaning));
    }

    if (nextStep) {
      section.appendChild(createProse(nextStep, "muted"));
    }

    return section;
  }

  /*
   * Everything the decision was based on, flattened into one list. Each row
   * keeps its source so a user can tell a simulation result from a policy
   * rule - the difference matters when judging how much to trust it.
   */
  function collectFindings(explanation, security) {
    const findings = [];

    const analyses = Array.isArray(security?.scamAnalyses) ? security.scamAnalyses : Array.isArray(security?.transactionScamContext?.analyses) ? security.transactionScamContext.analyses : [];

    analyses.forEach((analysis) => {
      if (analysis?.contractName || analysis?.name) {
        findings.push({
          text: `${analysis.contractName ?? analysis.name}${analysis.contractAddress ? ` · ${formatAddress(analysis.contractAddress)}` : ""}`,
          severity: "info",
          source: "ON-CHAIN",
        });
      }

      const state = Array.isArray(analysis?.contractPrivileges?.state) ? analysis.contractPrivileges.state : [];

      state.forEach((entry) => {
        if (!entry?.code) {
          return;
        }

        const isBad = entry.risk === "HIGH" || entry.risk === "CRITICAL" || entry.safe === false;

        findings.push({
          text: `${humanizeEvidenceLabel(entry.code)}: ${entry.description ?? entry.value ?? "reported"}`,
          severity: isBad ? "high" : "info",
          source: "ON-CHAIN",
        });
      });

      const analysisFindings = Array.isArray(analysis?.findings) ? analysis.findings : [];

      analysisFindings.forEach((finding) => {
        if (!finding?.title && !finding?.description) {
          return;
        }

        findings.push({
          text: finding.title ? `${finding.title}${finding.description ? ` - ${finding.description}` : ""}` : finding.description,
          severity: String(finding.severity ?? "info").toLowerCase(),
          source: finding.source ?? "ON-CHAIN",
        });
      });
    });

    const evidence = Array.isArray(explanation?.evidence) ? explanation.evidence : [];

    evidence.forEach((item) => {
      const text = typeof item === "string" ? item : (item?.description ?? item?.text ?? item?.title);

      if (!text) {
        return;
      }

      findings.push({
        text: String(text),
        severity: String(item?.severity ?? "info").toLowerCase(),
        source: item?.source ?? "POLICY",
      });
    });

    if (security?.simulation) {
      const success = security.simulation.success !== false;

      findings.push({
        text: success ? "Simulation completed without reverting." : `Simulation reverted${security.simulation.revertReason ? `: ${security.simulation.revertReason}` : "."}`,
        severity: success ? "info" : "high",
        source: "SIMULATION",
      });
    }

    if (security?.mcp || security?.transactionScamContext) {
      findings.push({
        text: "Contract context retrieved for this target.",
        severity: "info",
        source: "BNB MCP",
      });
    }

    return findings;
  }

  function createEvidenceDisclosure(explanation, security) {
    const findings = collectFindings(explanation, security);

    const { details, body } = createDisclosure("Security evidence", findings.length > 0 ? String(findings.length) : null);

    rise(details, 4);

    if (findings.length === 0) {
      const empty = document.createElement("p");

      empty.className = "nalar-empty";

      empty.textContent = "No individual findings were returned for this transaction.";

      body.appendChild(empty);

      return details;
    }

    findings.forEach((finding) => {
      const row = document.createElement("div");

      row.className = "nalar-finding";

      row.setAttribute("data-severity", finding.severity);

      row.appendChild(document.createTextNode(finding.text));

      row.appendChild(createSourceBadge(finding.source));

      body.appendChild(row);
    });

    return details;
  }

  function createTechnicalDisclosure(explanation, security) {
    const { details, body } = createDisclosure("Technical details");

    rise(details, 4);

    const rows = document.createElement("div");

    rows.className = "nalar-rows";

    const tx = security?.transaction || security?.request || {};

    const chainId = Number(tx.chainId ?? security?.chainId ?? 97);

    rows.appendChild(createRow("Network", chainId === 56 ? "BNB Smart Chain Mainnet (56)" : "BNB Smart Chain Testnet (97)"));
    rows.appendChild(createRow("Native asset", chainId === 56 ? "BNB" : "tBNB"));

    if (tx.to) {
      rows.appendChild(createRow("Target", createAddress(tx.to, chainId)));
    }

    if (tx.from) {
      rows.appendChild(createRow("From", createAddress(tx.from, chainId)));
    }

    if (tx.value && tx.value !== "0") {
      const sym = chainId === 56 ? "BNB" : "tBNB";
      try {
        const valEth = Number(BigInt(tx.value)) / 1e18;
        rows.appendChild(createRow("Value", `${valEth} ${sym}`));
      } catch {
        rows.appendChild(createRow("Value", `${tx.value} wei`));
      }
    }

    if (Array.isArray(security?.effects?.swaps)) {
      security.effects.swaps.forEach((swap, idx) => {
        const labelPrefix = security.effects.swaps.length > 1 ? ` (${idx + 1})` : "";
        if (swap.tokenIn && /^0x[a-fA-F0-9]{40}$/.test(swap.tokenIn)) {
          rows.appendChild(createRow(`Send token${labelPrefix}`, createAddress(swap.tokenIn, chainId)));
        }
        if (swap.tokenOut && /^0x[a-fA-F0-9]{40}$/.test(swap.tokenOut)) {
          rows.appendChild(createRow(`Receive token${labelPrefix}`, createAddress(swap.tokenOut, chainId)));
        }
      });
    }

    if (Array.isArray(security?.effects?.approvals)) {
      security.effects.approvals.forEach((app) => {
        if (app.spender && /^0x[a-fA-F0-9]{40}$/.test(app.spender)) {
          rows.appendChild(createRow("Spender", createAddress(app.spender, chainId)));
        }
        if (app.token && /^0x[a-fA-F0-9]{40}$/.test(app.token)) {
          rows.appendChild(createRow("Approved token", createAddress(app.token, chainId)));
        }
      });
    }

    const txHash = tx.hash || security?.txHash || security?.transactionHash;
    if (txHash && typeof txHash === "string" && /^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      rows.appendChild(createRow("Transaction", createTxLink(txHash, chainId)));
    }

    if (tx.data && tx.data !== "0x") {
      const selector = tx.data.slice(0, 10);

      rows.appendChild(createRow("Selector", createMono(selector)));

      const subhead = document.createElement("p");

      subhead.className = "nalar-subhead";

      subhead.textContent = tx.data.length > 74 ? `${tx.data.slice(0, 74)}…` : tx.data;

      body.appendChild(subhead);
    }

    const riskScore = Number.isFinite(Number(security?.riskScore)) ? Number(security.riskScore) : null;

    if (riskScore !== null) {
      rows.appendChild(createRow("Risk score", `${riskScore} / 100`));
    }

    if (security?.riskLevel) {
      rows.appendChild(createRow("Risk level", String(security.riskLevel).toUpperCase()));
    }

    const sources = Array.isArray(security?.sources) && security.sources.length > 0 ? security.sources.map(formatSource) : ["INTENT", "ON-CHAIN", "SIMULATION"];

    const sourceRow = document.createElement("div");

    sourceRow.className = "nalar-row";

    const sourceKey = document.createElement("span");

    sourceKey.className = "nalar-row-key";

    sourceKey.textContent = "Checked against";

    const sourceVal = document.createElement("span");

    sourceVal.className = "nalar-row-val";

    const seen = new Set();

    sources.forEach((source) => {
      if (seen.has(source)) {
        return;
      }

      seen.add(source);

      sourceVal.appendChild(createSourceBadge(source));
    });

    sourceRow.appendChild(sourceKey);

    sourceRow.appendChild(sourceVal);

    rows.appendChild(sourceRow);

    body.appendChild(rows);

    return details;
  }

  /*
  |--------------------------------------------------------------------------
  | Failure notice
  |--------------------------------------------------------------------------
  |
  | The transaction is not sent either way - a failure means Nalar could not
  | answer, so the safe outcome is the same as a block. The notice only says
  | why, in one sentence, with the raw code kept small underneath for a
  | support conversation.
  */

  const FAILURE_COPY = {
    STATUS_UNAVAILABLE: {
      title: "Nalar is not responding",
      text: "Nalar could not read its own settings, so it could not check this transaction. Reload the page and try again.",
    },
    TIMEOUT: {
      title: "Nalar could not finish in time",
      text: "The blockchain investigation took longer than expected, so the transaction was not sent.",
    },
    OFFLINE: {
      title: "Nalar is unreachable",
      text: "The security service could not be contacted. Check your connection and try again.",
    },
    NO_INTENT: {
      title: "No intent set for this site",
      text: "Nalar compares a transaction against what you said this site should do. Set that first, then try again.",
    },
    UNAUTHORIZED: {
      title: "Nalar was refused",
      text: "The security service rejected this request. The transaction was not sent.",
    },
    RATE_LIMITED: {
      title: "Too many requests",
      text: "The security service is rate limiting. Wait a moment and try again.",
    },
    SERVER: {
      title: "Analysis could not be completed",
      text: "The security service failed while analysing this transaction. Nothing was sent to your wallet.",
    },
    INVALID: {
      title: "Unreadable response",
      text: "Nalar received an answer it could not parse, so it did not act on it.",
    },
    UNKNOWN: {
      title: "Nalar could not check this transaction",
      text: "The security check did not complete, so the transaction was stopped.",
    },
  };

  /* One place that turns a failure into copy, so every path reads the same. */
  function describeFailure(error, errorCode) {
    const code = String(errorCode ?? "").toUpperCase();

    const message = typeof error === "string" ? error : typeof error?.message === "string" ? error.message : "";

    const lower = message.toLowerCase();

    let key = "UNKNOWN";

    if (code === "STATUS_UNAVAILABLE") {
      key = "STATUS_UNAVAILABLE";
    } else if (code === "TIMEOUT" || lower.includes("timed out") || lower.includes("timeout")) {
      key = "TIMEOUT";
    } else if (code === "NO_INTENT" || lower.includes("no transaction intent")) {
      key = "NO_INTENT";
    } else if (code === "UNAUTHORIZED" || lower.includes("unauthorized")) {
      key = "UNAUTHORIZED";
    } else if (code === "RATE_LIMITED" || lower.includes("rate limit")) {
      key = "RATE_LIMITED";
    } else if (code === "SERVER_ERROR" || lower.includes("could not be completed by the server") || lower.includes("http 5")) {
      key = "SERVER";
    } else if (lower.includes("invalid response")) {
      key = "INVALID";
    } else if (lower.includes("unavailable") || lower.includes("network connection") || lower.includes("failed to fetch")) {
      key = "OFFLINE";
    }

    const copy = FAILURE_COPY[key] ?? FAILURE_COPY.UNKNOWN;

    return {
      key,
      title: copy.title,
      text: copy.text,
      code: message || null,
    };
  }

  /*
   * A low, self-dismissing notice. It never blocks the page and never asks for
   * input: by the time it appears the transaction has already been refused.
   */
  function showErrorNotice(error, errorCode, onRetry) {
    removeNalarElement(IDS.banner);

    const { title, text, code } = describeFailure(error, errorCode);

    const notice = document.createElement("div");

    notice.className = "nalar-notice";

    notice.id = IDS.banner;

    notice.setAttribute("role", "alert");

    if (nalarTheme === "light") {
      notice.setAttribute("data-nalar-theme", "light");
    }

    const body = document.createElement("div");

    body.className = "nalar-notice-body";

    const titleEl = document.createElement("p");

    titleEl.className = "nalar-notice-title";

    titleEl.textContent = title;

    const textEl = document.createElement("p");

    textEl.className = "nalar-notice-text";

    textEl.textContent = text;

    body.appendChild(titleEl);

    body.appendChild(textEl);

    if (code) {
      const codeEl = document.createElement("p");

      codeEl.className = "nalar-notice-code";

      codeEl.textContent = code;

      body.appendChild(codeEl);
    }

    const close = document.createElement("button");

    close.className = "nalar-notice-close";

    close.type = "button";

    close.textContent = "✕";

    close.setAttribute("aria-label", "Dismiss");

    let timer = 0;

    function remove() {
      clearTimeout(timer);

      if (!notice.isConnected) {
        return;
      }

      notice.classList.add("nalar-closing");

      setTimeout(() => notice.remove(), MOTION.exit);
    }

    close.onclick = () => {
      remove();

      if (typeof onRetry === "function") {
        onRetry();
      }
    };

    notice.appendChild(body);

    notice.appendChild(close);

    mount(notice);

    /* Long enough to read three lines, short enough not to linger. */
    timer = setTimeout(remove, 9000);

    return { remove };
  }

  /* NALAR_LAYER_CHUNK_5_END */

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
      return "Continuing will send the original request to your wallet for final confirmation.";
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
