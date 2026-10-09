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
    bg: "var(--nalar-ui-bg)",
    bgDeep: "var(--nalar-ui-bg-deep)",
    surface: "var(--nalar-ui-surface)",
    raised: "var(--nalar-ui-raised)",
    border: "var(--nalar-ui-border)",
    borderStrong: "var(--nalar-ui-border-strong)",
    text: "var(--nalar-ui-text)",
    soft: "var(--nalar-ui-soft)",
    muted: "var(--nalar-ui-muted)",
    dim: "var(--nalar-ui-dim)",
    danger: "var(--nalar-ui-danger)",
    warning: "var(--nalar-ui-warning)",
    safe: "var(--nalar-ui-safe)",
    accent: "var(--nalar-ui-accent)",
    accentHover: "var(--nalar-ui-accent-hover)",
    dangerBg: "var(--nalar-ui-danger-bg)",
    warningBg: "var(--nalar-ui-warning-bg)",
    safeBg: "var(--nalar-ui-safe-bg)",
    accentBg: "var(--nalar-ui-accent-soft)",
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

  function linkifyAddresses(root, chainId) {
    const explorer = NALAR_CONFIG.SUPPORTED_CHAINS[parseNumericChainId(chainId)]?.explorer;
    if (!explorer) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.parentElement?.closest("a, script, style") && /0x(?:[a-fA-F0-9]{64}|[a-fA-F0-9]{40})(?![a-fA-F0-9])/.test(node.nodeValue ?? "")) nodes.push(node);
    }
    nodes.forEach((node) => {
      const value = node.nodeValue ?? "";
      const fragment = document.createDocumentFragment();
      let cursor = 0;
      for (const match of value.matchAll(/0x(?:[a-fA-F0-9]{64}|[a-fA-F0-9]{40})(?![a-fA-F0-9])/g)) {
        const address = match[0];
        const kind = address.length === 66 ? "tx" : "address";
        fragment.append(document.createTextNode(value.slice(cursor, match.index)));
        const link = document.createElement("a");
        link.className = "nalar-address-link";
        link.href = `${explorer}/${kind}/${address}`;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.title = address;
        link.setAttribute("aria-label", `View ${kind === "tx" ? "transaction" : "address"} ${address} on BscScan`);
        link.textContent = `${formatAddress(address)} ↗`;
        fragment.append(link);
        cursor = match.index + address.length;
      }
      fragment.append(document.createTextNode(value.slice(cursor)));
      node.replaceWith(fragment);
    });
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
      if (/^[0-9]+$/.test(trimmed)) {
        return Number.parseInt(trimmed, 10);
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
    if (NALAR_CONFIG.SUPPORTED_CHAINS[numeric]) {
      return NALAR_CONFIG.SUPPORTED_CHAINS[numeric].fullName;
    }
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

  async function getSelectedNetwork() {
    const result = await requestBridge("GET_NETWORK");
    const chainId = parseNumericChainId(result.chainId);
    if (result.error || !NALAR_CONFIG.SUPPORTED_CHAINS[chainId]) {
      throw new Error("NETWORK_UNAVAILABLE");
    }
    return chainId;
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
    let selectedChainId = null;
    try {
      rawChainId = await originalRequest({
        method: "eth_chainId",
      });
    } catch (err) {
      console.warn("[Nalar] Could not query eth_chainId:", err);
      return showRecoverableFailure("NETWORK CONNECTION FAILED", "Unable to connect to the wallet network. Check your connection and try again.");
    }

    const numericChainId = parseNumericChainId(rawChainId);
    try {
      selectedChainId = await getSelectedNetwork();
    } catch {
      return showRecoverableFailure("NETWORK UNAVAILABLE", "NALAR could not determine the selected network.");
    }

    async function switchToTestnet() {
      await originalRequest({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x61" }] });
      const active = parseNumericChainId(await originalRequest({ method: "eth_chainId" }));
      if (active !== 97) throw new Error("Wallet did not switch to BNB Testnet.");
      await originalRequest({ method: "eth_blockNumber" });
      const saved = await requestBridge("SET_NETWORK", { chainId: 97 });
      if (!saved.ok) throw new Error("Could not save BNB Testnet selection.");
      return true;
    }

    function showRecoverableFailure(title, description) {
      return new Promise((resolve, reject) => {
        showNetworkFailureOverlay({
          title,
          description,
          onRetry: () => resolve(handleTransactionRequest({ originalRequest, provider, args, providerLabel })),
          onCancel: () => reject(new Error(`[Nalar] ${title}. Transaction cancelled.`)),
          onSwitchTestnet: selectedChainId !== 97 ? async () => {
            await switchToTestnet();
            reject(new Error("[Nalar] Network changed. Start a new transaction on BNB Testnet."));
          } : null,
        });
      });
    }

    if (numericChainId === null) {
      return showRecoverableFailure("NETWORK UNAVAILABLE", "NALAR could not determine the current wallet network.");
    }

    const explicitTxChainId = parseNumericChainId(transaction.chainId);
    if (transaction.chainId != null && explicitTxChainId !== numericChainId) {
      return showRecoverableFailure("NETWORK MISMATCH", "The transaction chain does not match the wallet network. Check the DApp request before continuing.");
    }

    if (transaction.chainId != null && explicitTxChainId !== selectedChainId) {
      return showRecoverableFailure("NETWORK MISMATCH", "The DApp requested a different network. Switch the DApp network and start a new transaction.");
    }

    if (numericChainId !== selectedChainId || !NALAR_CONFIG.SUPPORTED_CHAINS[numericChainId]) {
      console.warn("[Nalar] Unsupported network detected before security check:", {
        chainId: numericChainId,
        rawChainId,
        provider: providerLabel,
      });

      return new Promise((resolve, reject) => {
        let overlayHandle = null;
        let chainChangedHandler = null;
        let resuming = false;

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
          if (resuming) return;
          try {
            await originalRequest({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: NALAR_CONFIG.SUPPORTED_CHAINS[selectedChainId].hex }],
            });

            if (resuming) return;

            const switched = parseNumericChainId(await originalRequest({ method: "eth_chainId" }));
            if (switched !== selectedChainId) throw new Error("Wallet did not switch to the selected network.");
            await originalRequest({ method: "eth_blockNumber" });

            resuming = true;
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
            if (switched === selectedChainId && !resuming) {
              resuming = true;
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
          requiredChainId: selectedChainId,
          onSwitch: doSwitch,
          onCancel: doCancel,
        });
      });
    }

    try {
      await originalRequest({ method: "eth_blockNumber" });
    } catch {
      return showRecoverableFailure("NETWORK CONNECTION FAILED", `Unable to connect to ${NALAR_CONFIG.SUPPORTED_CHAINS[numericChainId].fullName}. Check your connection and try again.`);
    }

    const chainIdHex = normalizeChainIdHex(numericChainId);

    /*
     * Get previously stored intent
     */

    const existingIntent = await getStoredIntent();

    /*
     * Ask user for intent
     */

    const confirmedIntent = await showIntentOverlay(existingIntent, numericChainId);

    if (typeof confirmedIntent !== "string" || !confirmedIntent.trim()) {
      throw new Error("[Nalar] Transaction cancelled.");
    }

    const intent = confirmedIntent.trim();

    /*
     * Persist intent
     */

    try {
      await saveIntent(intent);
    } catch {
      return showRecoverableFailure("INTENT UNAVAILABLE", "NALAR could not save your request for this site. Retry or cancel. The transaction was not sent to your wallet.");
    }

    /*
     * Security request ID
     */

    const id = ++requestId;

    /*
     * Loading UI
     */

    const analysis = showAnalysisOverlay(numericChainId);

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
        failAnalysis("ANALYSIS TIMED OUT", "NALAR could not finish checking this transaction. Retry or cancel.");
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

      function failAnalysis(title, description) {
        if (settled) return;
        settled = true;
        cleanupSecurityWait();
        showNetworkFailureOverlay({
          title,
          description,
          onRetry: () => resolve(handleTransactionRequest({ originalRequest, provider, args, providerLabel })),
          onCancel: () => reject(new Error(`[Nalar] ${title}. Transaction cancelled.`)),
          onSwitchTestnet: numericChainId === 56 ? async () => {
            await switchToTestnet();
            reject(new Error("[Nalar] Network changed. Start a new transaction on BNB Testnet."));
          } : null,
        });
      }

      /*
       * Continue to actual wallet.
       */

      async function continueToWallet() {
        if (settled) {
          return;
        }
        settled = true;
        let walletReady = false;
        try {
          const activeChainId = parseNumericChainId(await originalRequest({ method: "eth_chainId" }));
          const activeSelection = await getSelectedNetwork();
          if (activeChainId !== numericChainId || activeSelection !== numericChainId) {
            throw new Error("[Nalar] Network changed during analysis. Start a new transaction.");
          }
          await originalRequest({ method: "eth_blockNumber" });
          walletReady = true;
          console.info("[Nalar] Forwarding transaction to wallet.");
          const result = await originalRequest(args);

          resolve(result);
        } catch (error) {
          if (walletReady) {
            reject(error);
            return;
          }
          const changed = error instanceof Error && error.message.includes("Network changed");
          showNetworkFailureOverlay({
            title: changed ? "NETWORK MISMATCH" : "NETWORK CONNECTION FAILED",
            description: changed ? "The wallet network changed during analysis. Start a new security check before signing." : "NALAR could not verify the wallet network before signing. Check your connection and retry.",
            onRetry: () => resolve(handleTransactionRequest({ originalRequest, provider, args, providerLabel })),
            onCancel: () => reject(new Error("[Nalar] Transaction cancelled: network could not be verified.")),
          });
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

        if (message.type === "TX_PROGRESS") {
          if (!settled && message.id === id && message.chainId === numericChainId) analysis?.updateProgress?.(message.progress);
          return;
        }

        if (message.type !== "TX_RESULT" && message.type !== "BRIDGE_ERROR") {
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

        /*
         * Check for Network Not Supported error fallback
         */
        const isNetworkNotSupported =
          message.errorCode === "NETWORK_NOT_SUPPORTED" || message.errorCode === "UNSUPPORTED_CHAIN" || (typeof message.error === "string" && (message.error.includes("BNB Testnet only") || message.error.includes("UNSUPPORTED_CHAIN")));

        if (isNetworkNotSupported && NALAR_CONFIG.SUPPORTED_CHAINS[numericChainId]) {
          failAnalysis("ANALYSIS UNAVAILABLE", "NALAR could not complete security analysis for this network. Retry or switch network.");
          return;
        }

        if (isNetworkNotSupported) {
          cleanupSecurityWait();
          console.warn("[Nalar] Backend reported unsupported network:", message);

          const reportedChainId = parseNumericChainId(message.receivedChainId) ?? parseNumericChainId(chainIdHex) ?? numericChainId ?? 1;

          showNetworkNotSupportedOverlay({
            currentChainId: reportedChainId,
            requiredChainId: selectedChainId,
            onSwitch: async () => {
              try {
                await originalRequest({
                  method: "wallet_switchEthereumChain",
                  params: [{ chainId: NALAR_CONFIG.SUPPORTED_CHAINS[selectedChainId].hex }],
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
          if (message.errorCode === "NETWORK_CONNECTION_FAILED") {
            failAnalysis("NETWORK CONNECTION FAILED", `Unable to connect to ${NALAR_CONFIG.SUPPORTED_CHAINS[numericChainId].fullName}. Check your connection and try again.`);
          } else if (message.errorCode === "ANALYSIS_TIMEOUT" || /timed out/i.test(message.error ?? "")) {
            failAnalysis("ANALYSIS TIMED OUT", "NALAR could not finish checking this transaction. Retry or cancel.");
          } else {
            failAnalysis("ANALYSIS UNAVAILABLE", "NALAR could not complete security analysis for this network. Retry or switch network.");
          }

          return;
        }

        cleanupSecurityWait();

        const security = message.security;

        if (!security || !["ALLOW", "REVIEW", "BLOCK"].includes(security.decision)) {
          failAnalysis("ANALYSIS UNAVAILABLE", "NALAR received an incomplete security result. Retry or cancel this transaction.");
          return;
        }

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
          }, numericChainId);

          return;
        }

        /*
         * REVIEW
         */

        if (security.decision === "REVIEW") {
          showDecisionOverlay(security, "REVIEW", continueToWallet, () => {
            cancelTransaction("[Nalar] Transaction cancelled during review.");
          }, numericChainId);

          return;
        }

        /*
         * ALLOW
         */

        showDecisionOverlay(security, "ALLOW", continueToWallet, () => {
          cancelTransaction("[Nalar] Transaction cancelled by user.");
        }, numericChainId);
      }

      /*
       * Listen BEFORE sending request.
       */

      window.addEventListener("message", onSecurityResult);

      /*
       * Send transaction to bridge.
       */

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

  function showIntentOverlay(existingIntent = "", chainId) {
    return new Promise((resolve) => {
      removeNalarElement(IDS.intent);

      const overlay = document.createElement("div");

      overlay.id = IDS.intent;

      overlay.className = "nalar-overlay";

      applyOverlayStyle(overlay);

      const modal = createModal();
      modal.classList.add("nalar-intent-modal");

      const header = document.createElement("div");
      header.className = "nalar-intent-header";

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
      body.className = "nalar-intent-body";

      Object.assign(body.style, {
        padding: "22px 28px 20px",
      });

      const siteLabel = createLabel("REQUEST FROM");

      const site = document.createElement("div");
      site.className = "nalar-request-context";

      site.textContent = window.location.hostname || "Current website";
      site.title = window.location.origin;
      const network = NALAR_CONFIG.SUPPORTED_CHAINS[parseNumericChainId(chainId)];
      if (network) site.textContent += ` · ${network.name}`;

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
      intentLabel.id = "__nalar_intent_label__";

      intentLabel.style.marginTop = "22px";

      const textarea = document.createElement("textarea");

      textarea.value = typeof existingIntent === "string" ? existingIntent : "";

      textarea.placeholder = network ? `e.g. Send ${network.nativeAsset} to a friend` : "Describe the action you expect";
      textarea.setAttribute("aria-labelledby", intentLabel.id);
      textarea.setAttribute("aria-describedby", "__nalar_intent_help__");

      textarea.className = "nalar-intent-textarea";

      Object.assign(textarea.style, {
        display: "block",
        width: "100%",
        minHeight: "96px",
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
        textarea.style.borderColor = UI.accent;
      });

      textarea.addEventListener("blur", () => {
        textarea.style.borderColor = UI.borderStrong;
        textarea.style.boxShadow = "none";
      });

      body.appendChild(intentLabel);

      body.appendChild(textarea);
      const privacy = document.createElement("p");
      privacy.id = "__nalar_intent_help__";
      privacy.className = "nalar-intent-helper";
      privacy.textContent = "Stored per site; sent with transaction details for analysis.";
      body.appendChild(privacy);
      const validation = document.createElement("p");
      validation.id = "__nalar_intent_error__";
      validation.className = "nalar-intent-validation";
      validation.setAttribute("role", "alert");
      body.appendChild(validation);
      textarea.addEventListener("input", () => {
        textarea.removeAttribute("aria-invalid");
        textarea.setAttribute("aria-describedby", privacy.id);
        validation.textContent = "";
      });

      const footer = document.createElement("div");
      footer.className = "nalar-intent-footer";

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
          validation.textContent = "Describe what you expect this transaction to do.";
          textarea.setAttribute("aria-invalid", "true");
          textarea.setAttribute("aria-describedby", `${privacy.id} ${validation.id}`);
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

  function showNetworkFailureOverlay({ title, description, onRetry, onCancel, onSwitchTestnet }) {
    removeNalarElement(IDS.network);
    removeNalarElement(IDS.analysis);
    const overlay = document.createElement("div");
    overlay.id = IDS.network;
    overlay.className = "nalar-overlay nalar-network-overlay";
    applyOverlayStyle(overlay);
    const modal = createModal();
    modal.classList.add("nalar-network-modal");
    Object.assign(modal.style, { width: "min(440px, 100%)", padding: "24px" });
    modal.appendChild(createBrandEyebrow("NALAR · TRANSACTION CHECK"));

    const heading = document.createElement("h2");
    heading.textContent = String(title).toLowerCase().replace(/^./, (letter) => letter.toUpperCase()).replace(/\b(bnb|mcp|rpc|nalar)\b/g, (name) => name.toUpperCase());
    Object.assign(heading.style, { margin: "14px 0 8px", fontSize: "20px", color: UI.text });
    modal.appendChild(heading);

    const explanation = document.createElement("p");
    explanation.textContent = description;
    Object.assign(explanation.style, { margin: "0 0 18px", fontSize: "13px", lineHeight: "1.55", color: UI.soft });
    modal.appendChild(explanation);

    const actions = document.createElement("div");
    Object.assign(actions.style, { display: "flex", flexWrap: "wrap", gap: "8px" });
    const retry = createButton("Retry", true);
    retry.onclick = () => { overlay.remove(); onRetry(); };
    actions.appendChild(retry);
    if (onSwitchTestnet) {
      const switchButton = createButton("Switch to BNB Testnet", false);
      switchButton.onclick = async () => {
        switchButton.disabled = true;
        try {
          await onSwitchTestnet();
          overlay.remove();
        } catch {
          switchButton.disabled = false;
          explanation.textContent = "COULD NOT SWITCH NETWORK. Your current network remains unchanged. Retry or cancel this transaction.";
        }
      };
      actions.appendChild(switchButton);
    }
    const cancel = createButton("Cancel", false);
    cancel.onclick = () => { overlay.remove(); onCancel(); };
    modal.addEventListener("keydown", (event) => { if (event.key === "Escape") cancel.click(); });
    actions.appendChild(cancel);
    modal.appendChild(actions);
    overlay.appendChild(modal);
    document.documentElement.appendChild(overlay);
  }

  function showNetworkNotSupportedOverlay({ currentChainId, requiredChainId = 97, onSwitch, onCancel }) {
    removeNalarElement(IDS.network);
    removeNalarElement(IDS.analysis);
    removeNalarElement(IDS.decision);
    removeNalarElement(IDS.intent);

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
    title.textContent = NALAR_CONFIG.SUPPORTED_CHAINS[currentChainId] ? "NETWORK MISMATCH" : "NETWORK NOT SUPPORTED";
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
    subtitle.textContent = "NALAR supports BNB Testnet and BNB Mainnet. The wallet must match the selected network before analysis.";
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
    requiredName.textContent = NALAR_CONFIG.SUPPORTED_CHAINS[requiredChainId].fullName;
    Object.assign(requiredName.style, {
      marginTop: "6px",
      fontSize: "13px",
      fontWeight: "600",
      color: UI.text,
    });
    requiredBox.appendChild(requiredName);

    const requiredId = document.createElement("div");
    requiredId.textContent = `Chain ID ${requiredChainId}`;
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
    messageText.textContent = `Switch your wallet to ${NALAR_CONFIG.SUPPORTED_CHAINS[requiredChainId].fullName} before continuing.`;
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
    const switchBtn = createButton(`Switch to ${NALAR_CONFIG.SUPPORTED_CHAINS[requiredChainId].name}`, true);

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
          switchBtn.textContent = `Switch to ${NALAR_CONFIG.SUPPORTED_CHAINS[requiredChainId].name}`;
          statusEl.textContent = `COULD NOT SWITCH NETWORK. Open your wallet and select ${NALAR_CONFIG.SUPPORTED_CHAINS[requiredChainId].fullName}.`;
        }
      }
    };

    footer.appendChild(cancelBtn);
    modal.addEventListener("keydown", (event) => { if (event.key === "Escape") cancelBtn.click(); });
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

  function showAnalysisOverlay(chainId) {
    removeNalarElement(IDS.analysis);
    const overlay = document.createElement("div");
    overlay.id = IDS.analysis;
    overlay.className = "nalar-overlay";
    applyOverlayStyle(overlay);

    const modal = createModal();
    modal.classList.add("nalar-analysis-modal");
    modal.setAttribute("aria-busy", "true");
    modal.appendChild(createBrandEyebrow("NALAR PROTOCOL · SECURITY"));

    const title = document.createElement("h2");
    title.textContent = "Checking transaction";
    modal.appendChild(title);

    const context = document.createElement("p");
    context.className = "nalar-request-context";
    const network = NALAR_CONFIG.SUPPORTED_CHAINS[parseNumericChainId(chainId)];
    context.textContent = window.location.hostname || "Current website";
    if (network) context.textContent += ` · ${network.name}`;
    modal.appendChild(context);

    const rail = document.createElement("div");
    rail.className = "nalar-progress-rail";
    rail.setAttribute("role", "progressbar");
    rail.setAttribute("aria-label", "Transaction analysis in progress");
    const indicator = document.createElement("span");
    rail.appendChild(indicator);
    modal.appendChild(rail);

    const status = document.createElement("p");
    status.className = "nalar-analysis-status";
    status.setAttribute("role", "status");
    status.textContent = "Waiting for the security check. Your transaction has not been sent to the wallet.";
    modal.appendChild(status);

    const steps = document.createElement("ol");
    steps.className = "nalar-analysis-steps";
    steps.hidden = true;
    const rows = new Map();
    Object.entries(NALAR_CONFIG.ANALYSIS_STEPS ?? {}).forEach(([stage, label]) => {
      const row = document.createElement("li");
      row.setAttribute("data-status", "pending");
      const marker = document.createElement("span");
      marker.className = "nalar-step-marker";
      marker.setAttribute("aria-hidden", "true");
      marker.textContent = "○";
      const name = document.createElement("span");
      name.textContent = label;
      const state = document.createElement("span");
      state.className = "nalar-step-state";
      state.textContent = "Waiting";
      row.appendChild(marker); row.appendChild(name); row.appendChild(state);
      steps.appendChild(row);
      rows.set(stage, { row, marker, state, status: "pending" });
    });
    modal.appendChild(steps);

    overlay.appendChild(modal);
    document.documentElement.appendChild(overlay);
    return {
      updateProgress(event) {
        if (!overlay.isConnected || event?.chainId !== parseNumericChainId(chainId)) return;
        const entry = rows.get(event.stage);
        if (!entry || !["running", "completed", "failed", "unavailable"].includes(event.status)) return;
        if (event.address) {
          if (entry.status === "running" && /^0x[a-fA-F0-9]{40}$/.test(event.address)) {
            status.textContent = `${event.status === "completed" ? "Checked" : NALAR_CONFIG.ANALYSIS_STEPS[event.stage]} · ${event.address}`;
            linkifyAddresses(status, parseNumericChainId(chainId));
          }
          return;
        }
        if (event.status === "running" ? entry.status !== "pending" : entry.status !== "running") return;
        steps.hidden = false;
        entry.status = event.status;
        entry.row.setAttribute("data-status", event.status);
        entry.marker.textContent = { running: "●", completed: "✓", failed: "×", unavailable: "–" }[event.status];
        entry.state.textContent = { running: "In progress", completed: "Completed", failed: "Failed", unavailable: "Unavailable" }[event.status];
        status.textContent = event.status === "running" ? NALAR_CONFIG.ANALYSIS_STEPS[event.stage] : "Your transaction has not been sent to the wallet.";
      },
      remove(callback) {
        dismissNalarElement(IDS.analysis, callback);
      },
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Decision overlay
  |--------------------------------------------------------------------------
  */

  function showDecisionOverlay(security, decision, onContinue, onCancel, chainId) {
    removeNalarElement(IDS.decision);

    const overlay = document.createElement("div");

    overlay.id = IDS.decision;

    overlay.className = "nalar-overlay nalar-decision-overlay";

    overlay.setAttribute("data-decision", decision.toLowerCase());

    applyOverlayStyle(overlay);

    const modal = createModal();

    Object.assign(modal.style, {
      width: "min(620px, 100%)",
      maxHeight: "calc(100vh - 32px)",
      display: "flex",
      flexDirection: "column",
    });

    const riskLevel = String(security?.riskLevel ?? "UNKNOWN");

    const riskScore = Number.isFinite(security?.riskScore) ? security.riskScore : null;

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

    // Put the key explanation directly below the verdict, before supporting details.
    body.appendChild(createWhyStoppedCard(explanation, security, decision));
    body.appendChild(createIntentVsActualComparison(explanation, security, decision));
    const affected = createAffectedSection(security);
    if (affected) body.appendChild(affected);

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
    body.appendChild(createTechnicalSection(explanation, security, chainId));

    // 7. Footer Actions
    const footer = createDecisionFooter(decision, onContinue, onCancel, overlay);

    modal.appendChild(header);

    modal.appendChild(body);

    modal.appendChild(footer);

    overlay.appendChild(modal);

    document.documentElement.appendChild(overlay);
    linkifyAddresses(modal, chainId);

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

    const eyebrow = createBrandEyebrow("NALAR · TRANSACTION CHECK");

    const heading = document.createElement("h2");
    heading.className = "nalar-verdict-title";
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
    subtitle.className = "nalar-verdict-description";
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

    const verdict = document.createElement("div");
    verdict.className = "nalar-verdict-code";
    verdict.textContent = decision;
    headingWrap.insertBefore(verdict, heading);

    const risk = document.createElement("div");
    risk.className = "nalar-risk-readout";
    risk.setAttribute("data-level", riskLevel.toLowerCase());
    const level = document.createElement("div");
    level.className = "nalar-risk-caption";
    level.textContent = ({ LOW: "Low risk", MEDIUM: "Caution", HIGH: "High risk", CRITICAL: "Critical risk" })[riskLevel.toUpperCase()] ?? "Risk unknown";
    risk.appendChild(level);
    if (riskScore !== null) {
      const score = document.createElement("div");
      score.className = "nalar-risk-number";
      score.textContent = String(riskScore);
      const scale = document.createElement("span");
      scale.textContent = " / 100";
      score.appendChild(scale);
      risk.appendChild(score);
    } else {
      const unavailable = document.createElement("span");
      unavailable.className = "nalar-risk-unavailable";
      unavailable.textContent = "Score unavailable";
      risk.appendChild(unavailable);
    }

    header.appendChild(mark);
    header.appendChild(headingWrap);
    header.appendChild(risk);

    return header;
  }

  function getPrimaryRootCause(explanation, security, decision) {
    const isUncertain = security?.comparison?.overall === "UNCERTAIN" || explanation?.comparison?.status === "UNKNOWN";
    const isMismatch = !isUncertain && (security?.intentMatch === false || security?.comparison?.overall === "MISMATCH" || explanation?.comparison?.status === "MISMATCH");
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

    // 2. Use normalized findings; raw tax values do not establish percentages.
    const analyses = Array.isArray(security?.scamAnalyses) ? security.scamAnalyses : Array.isArray(security?.transactionScamContext?.analyses) ? security.transactionScamContext.analyses : [];
    for (const a of analyses) {
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
    });

    const labelText = "Why this verdict";
    const sectionLabel = createLabel(labelText);
    sectionLabel.style.color = isBlock ? UI.danger : isReview ? UI.warning : UI.muted;

    card.appendChild(sectionLabel);

    const primaryReasonText = getPrimaryRootCause(explanation, security, decision);

    const reasonEl = document.createElement("div");
    reasonEl.className = "nalar-why-stopped-primary";
    reasonEl.textContent = primaryReasonText;
    markExplanationSource(sectionLabel, explanation, primaryReasonText);

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
      const impactLabel = document.createElement("div");
      impactLabel.className = "nalar-impact-label";
      impactLabel.textContent = "Impact";
      markExplanationSource(impactLabel, explanation, impactText);
      card.appendChild(impactLabel);
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

  function markExplanationSource(label, explanation, text) {
    if (explanation?.meta?.generator !== "AI" || ![explanation?.whyStopped?.primaryReason, explanation?.whyStopped?.userImpact, explanation?.whatThisMeans, explanation?.comparison?.summary, explanation?.summary, explanation?.userIntent?.description, explanation?.userIntent?.summary, explanation?.actualTransaction?.summary, ...(Array.isArray(explanation?.evidence) ? explanation.evidence.map((item) => item?.explanation) : [])].some((value) => typeof value === "string" && value.trim() === text)) return;
    const badge = document.createElement("span");
    badge.className = "nalar-ai-label";
    badge.textContent = "[AI]";
    badge.title = "AI-written explanation. The security verdict comes from deterministic rules.";
    label.appendChild(badge);
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
    const isUncertain = comp.overall === "UNCERTAIN" || explanation?.comparison?.status === "UNKNOWN";
    const isMismatch = !isUncertain && (comp.overall === "MISMATCH" || explanation?.comparison?.status === "MISMATCH" || security?.intentMatch === false);
    const isMatch = !isMismatch && !isUncertain && (explanation?.comparison?.status === "MATCH" || security?.intentMatch === true || comp.overall === "MATCH");

    const headerRow = document.createElement("div");
    headerRow.className = "nalar-comparison-header";

    Object.assign(headerRow.style, {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "12px",
    });

    const headerLabel = createLabel("Intent vs transaction");
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
    } else if (isUncertain || !isMatch) {
      badgeText = "? UNVERIFIED";
      badgeColor = UI.warning;
      badgeBg = UI.warningBg;
      badgeBorder = "rgba(251, 191, 36, 0.28)";
    }

    const matchBadge = document.createElement("div");
    matchBadge.className = "nalar-badge";
    matchBadge.setAttribute("data-match", String(isMatch));
    matchBadge.setAttribute("data-state", isMismatch ? "mismatch" : isMatch ? "match" : "uncertain");
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
    if (explanation?.meta?.generator === "AI") markExplanationSource(intentLabel, explanation, userIntentText);
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
    if (explanation?.meta?.generator === "AI") markExplanationSource(actualLabel, explanation, actualTxText);
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
    for (const [label, value] of [["Input", explanation?.actualTransaction?.input], ["Output", explanation?.actualTransaction?.output]]) {
      if (typeof value !== "string" || !value.trim()) continue;
      const amount = document.createElement("div");
      amount.className = "nalar-transaction-amount";
      const key = document.createElement("span");
      key.textContent = label;
      const display = document.createElement("span");
      display.textContent = value;
      amount.appendChild(key);
      amount.appendChild(display);
      actualBox.appendChild(amount);
    }
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
        mismatchesList.push(`Recipient: Expected ${comp.recipient.expected}, Actual ${comp.recipient.actual}`);
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

  function createAffectedSection(security) {
    const effects = security?.effects ?? {};
    const entries = [
      ...(Array.isArray(effects.approvals) ? effects.approvals : []).map((approval) => ({
        label: approval.type === "ERC721_OPERATOR" ? `NFT operator permission${approval.approved === false ? " · revoked" : ""}` : approval.unlimited === true ? "Unlimited token allowance" : "Token allowance",
        asset: approval.token,
        party: approval.spender ?? approval.operator,
        partyLabel: "Spender / operator",
      })),
      ...(Array.isArray(effects.swaps) ? effects.swaps : []).map((swap) => ({
        label: "Token swap", asset: swap.tokenIn, output: swap.tokenOut, party: swap.recipient, partyLabel: "Recipient",
      })),
      ...(Array.isArray(effects.mints) ? effects.mints : []).map((mint) => ({
        label: `NFT mint${Number.isFinite(mint.quantity) ? ` · ${mint.quantity}` : ""}`, asset: mint.contract, party: mint.recipient, partyLabel: "Recipient",
      })),
    ];
    if (!entries.length) return null;
    const section = document.createElement("section");
    section.className = "nalar-affected-section";
    section.appendChild(createLabel("Affected assets & permissions"));
    const more = entries.length > 2 ? document.createElement("details") : null;
    if (more) {
      more.className = "nalar-affected-more";
      const summary = document.createElement("summary");
      summary.textContent = `${entries.length - 2} more affected ${entries.length === 3 ? "entry" : "entries"}`;
      more.appendChild(summary);
    }
    entries.forEach((entry, index) => {
      const row = document.createElement("div");
      row.className = "nalar-effect-row";
      const label = document.createElement("strong");
      label.textContent = entry.label;
      row.appendChild(label);
      for (const [name, value] of [[entry.output ? "Send asset" : "Asset", entry.asset], ["Receive asset", entry.output], [entry.partyLabel, entry.party]]) {
        if (typeof value !== "string" || !value) continue;
        const field = document.createElement("div");
        const key = document.createElement("span");
        key.textContent = name;
        const address = document.createElement("span");
        address.textContent = value;
        field.appendChild(key);
        field.appendChild(address);
        row.appendChild(field);
      }
      (index < 2 ? section : more).appendChild(row);
    });
    if (more) section.appendChild(more);
    return section;
  }

  function createWhatThisMeansSection(explanation, security, decision) {
    const isBlock = decision === "BLOCK";
    const isReview = decision === "REVIEW";
    const isUncertain = security?.comparison?.overall === "UNCERTAIN" || explanation?.comparison?.status === "UNKNOWN";
    const isMismatch = !isUncertain && (security?.intentMatch === false || security?.comparison?.overall === "MISMATCH");

    let text = "";
    if (typeof explanation?.whatThisMeans === "string" && explanation.whatThisMeans.trim().length > 0) {
      text = explanation.whatThisMeans.trim();
    } else if (typeof explanation?.whyStopped?.userImpact === "string" && explanation.whyStopped.userImpact.trim().length > 0) {
      text = explanation.whyStopped.userImpact.trim();
    } else if (isBlock && isMismatch) {
      text = "Signing this request would execute an action different from what you intended, potentially transferring permissions or assets unexpectedly.";
    } else if (isBlock) {
      text = "Signing this transaction could result in irreversible loss of assets or unverified contract execution.";
    } else if (isReview && isUncertain) {
      text = "NALAR could not confirm a match because your request was too broad. Check the action, token, amount, and recipient before continuing.";
    } else if (isReview) {
      text = "This transaction interacts with contract functions or addresses that require careful verification before signing.";
    } else {
      text = "No blocking issue was found in the available checks. Simulation reflects the state at the time of analysis and cannot guarantee the mined outcome.";
    }

    const callout = document.createElement("section");
    callout.className = "nalar-means-callout nalar-stagger-4";
    Object.assign(callout.style, {
      marginTop: "12px",
      padding: "12px 16px",
      border: `1px solid ${UI.border}`,
      borderRadius: "8px",
      background: UI.surface,
    });

    const label = document.createElement("div");
    label.className = "nalar-means-label";
    label.textContent = "What this means";
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
    markExplanationSource(label, explanation, text);
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
    const threats = Array.isArray(security?.transactionThreats) ? security.transactionThreats : [];
    const hasAddressReports = reports.some((report) => /^0x[a-fA-F0-9]{40}$/.test(report?.token ?? "") && report?.contract);
    const count = (evidenceItems?.length ?? 0) + threats.length + reports.reduce((acc, r) => acc + (Array.isArray(r?.findings) ? r.findings.length : 0), 0);

    const wrapper = document.createElement("details");
    wrapper.className = "nalar-evidence-details nalar-stagger-5";

    Object.assign(wrapper.style, {
      marginTop: "12px",
      padding: "12px 0 0",
      borderTop: `1px solid ${UI.border}`,
    });

    const summary = document.createElement("summary");
    summary.textContent = `Security evidence (${count > 0 ? `${count} ${count === 1 ? "item" : "items"}` : hasAddressReports ? "no findings" : "unavailable"})`;

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

    if (reports.length && (evidenceItems || threats.length)) {
      const heading = document.createElement("h3");
      heading.className = "nalar-evidence-group-title";
      heading.textContent = "Transaction-wide findings";
      content.appendChild(heading);
    }

    if (evidenceItems) {
      const list = document.createElement("ol");
      list.className = "nalar-evidence-list";
      content.appendChild(list);
      evidenceItems.forEach((item, index) => {
        const row = document.createElement("li");
        row.className = "nalar-evidence-record";
        row.setAttribute("data-kind", evidenceKind(item));
        if (String(item?.label ?? "").toLowerCase() === evidenceKind(item).toLowerCase()) row.setAttribute("data-kind-label", "redundant");
        row.setAttribute("aria-label", evidenceKind(item));
        Object.assign(row.style, {
          padding: "7px 0",
          borderTop: index > 0 ? `1px solid ${UI.border}` : "none",
        });

        const topLine = document.createElement("div");
        topLine.className = "nalar-evidence-line";
        Object.assign(topLine.style, {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "8px",
        });

        const labelEl = document.createElement("span");
        labelEl.className = "nalar-evidence-label";
        labelEl.textContent = item?.label ?? "Evidence";
        Object.assign(labelEl.style, {
          fontSize: "11px",
          fontWeight: "600",
          color: UI.text,
        });

        const rightSide = document.createElement("div");
        rightSide.className = "nalar-evidence-value";
        Object.assign(rightSide.style, {
          display: "flex",
          alignItems: "center",
          gap: "6px",
        });

        const valEl = document.createElement("span");
        valEl.className = "nalar-evidence-fact";
        valEl.textContent = item?.value ?? "Unavailable";
        Object.assign(valEl.style, {
          fontSize: "11px",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          color: UI.soft,
        });

        const badge = document.createElement("span");
        badge.className = "nalar-badge-source";
        badge.setAttribute("data-source", item?.source ?? "UNKNOWN");
        badge.textContent = item?.source ?? "UNKNOWN";

        rightSide.appendChild(valEl);
        rightSide.appendChild(badge);
        topLine.appendChild(labelEl);
        topLine.appendChild(rightSide);
        row.appendChild(topLine);

        if (item?.explanation) {
          const expEl = document.createElement("div");
          expEl.className = "nalar-evidence-explanation";
          expEl.textContent = item.explanation;
          if (explanation?.meta?.generator === "AI") markExplanationSource(expEl, explanation, item.explanation);
          Object.assign(expEl.style, {
            marginTop: "3px",
            fontSize: "11px",
            lineHeight: "1.5",
            color: UI.muted,
          });
          row.appendChild(expEl);
        }

        list.appendChild(row);
      });
    }
    if (reports.length || threats.length) {
      reports.forEach((analysis) => {
        const findings = Array.isArray(analysis?.findings) ? analysis.findings : [];
        if (!findings.length && (!/^0x[a-fA-F0-9]{40}$/.test(analysis?.token ?? "") || !analysis?.contract)) return;
        const sub = document.createElement("section");
        sub.className = "nalar-address-evidence";
        sub.setAttribute("aria-label", `Analysis for ${analysis?.token ?? "unavailable address"}`);

        const head = document.createElement("div");
        Object.assign(head.style, {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "8px",
        });

        const token = document.createElement("h3");
        token.className = "nalar-evidence-group-title";
        token.textContent = analysis?.token ?? "Unknown";
        token.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        token.style.color = UI.text;

        const badge = document.createElement("div");
        badge.textContent = `${analysis?.riskLevel ?? "UNKNOWN"}${Number.isFinite(analysis?.riskScore) ? ` · ${analysis.riskScore}` : ""}`;
        Object.assign(badge.style, {
          color: riskColor(analysis?.riskLevel),
          fontSize: "12px",
          fontWeight: "700",
        });

        head.appendChild(token);
        head.appendChild(badge);
        sub.appendChild(head);

        const address = String(analysis?.token ?? "").toLowerCase();
        const roles = [];
        if (address && String(security?.transactionSummary?.target ?? "").toLowerCase() === address) roles.push("Transaction contract");
        (security?.effects?.approvals ?? []).forEach((approval) => {
          if (String(approval.token ?? "").toLowerCase() === address) roles.push("Approval asset");
          if (String(approval.spender ?? approval.operator ?? "").toLowerCase() === address) roles.push("Spender / operator");
        });
        (security?.effects?.swaps ?? []).forEach((swap) => {
          if (String(swap.tokenIn ?? "").toLowerCase() === address) roles.push("Input asset");
          if (String(swap.tokenOut ?? "").toLowerCase() === address) roles.push("Output asset");
          if ((swap.hopTokens ?? []).some((token) => String(token).toLowerCase() === address)) roles.push("Swap path");
        });
        if (roles.length) {
          const role = document.createElement("p");
          role.className = "nalar-address-role";
          role.textContent = [...new Set(roles)].join(" · ");
          sub.appendChild(role);
        }
        if (!findings.length) {
          const empty = document.createElement("p");
          empty.textContent = "No specific findings were returned for this address. This is not a safety guarantee.";
          sub.appendChild(empty);
        }

        const list = document.createElement("ol");
        list.className = "nalar-evidence-list";
        if (findings.length) sub.appendChild(list);
        findings.forEach((finding) => {
          const severity = String(finding?.severity ?? "INFO").toUpperCase();
          const isThreat = severity === "CRITICAL" || severity === "HIGH";
          const fRow = document.createElement("li");
          fRow.className = "nalar-finding";
          fRow.setAttribute("data-severity", severity.toLowerCase());
          Object.assign(fRow.style, {
            padding: "3px 0",
            fontSize: "11px",
            lineHeight: "1.5",
            color: isThreat ? UI.danger : severity === "MEDIUM" ? UI.warning : UI.muted,
          });
          fRow.appendChild(createFindingRecord(finding));
          list.appendChild(fRow);
        });

        content.appendChild(sub);
      });

      if (reports.length && threats.length) {
        const heading = document.createElement("h3");
        heading.className = "nalar-evidence-group-title";
        heading.textContent = "Transaction-wide threats";
        content.appendChild(heading);
      }
      const list = document.createElement("ol");
      list.className = "nalar-evidence-list";
      if (threats.length) content.appendChild(list);
      threats.forEach((finding) => {
        const row = document.createElement("li");
        row.className = "nalar-finding";
        row.appendChild(createFindingRecord(finding));
        Object.assign(row.style, { padding: "5px 0", fontSize: "11px", lineHeight: "1.5", color: UI.soft });
        list.appendChild(row);
      });
    }

    if (!count && !hasAddressReports) {
      const unavailable = document.createElement("p");
      unavailable.textContent = "No detailed evidence was returned for this transaction.";
      Object.assign(unavailable.style, { margin: "4px 0", fontSize: "11px", color: UI.soft });
      content.appendChild(unavailable);
    }

    wrapper.appendChild(content);
    wrapper.addEventListener("toggle", () => {
      if (!wrapper.open) return;
      try { window.NALAR_MOTION?.enter(content); } catch {}
    });
    return wrapper;
  }

  function evidenceKind(item) {
    // Classify presentation, not severity or security conclusions. Sources stay intact.
    if (["UNLIMITED_ALLOWANCE", "UNEXPECTED_SPENDER", "UNEXPECTED_NFT_OPERATOR", "SUSPICIOUS_APPROVAL_TARGET", "APPROVAL_TO_CONTRACT"].includes(item?.code)) return "Token approval";
    const source = String(item?.source ?? "UNKNOWN").toUpperCase();
    return ({ SIMULATION: "Simulation", CONTRACT: "Contract analysis", ABI: "Contract analysis", PROXY: "Contract analysis", IMPLEMENTATION: "Contract analysis", ONCHAIN: "On-chain evidence", "ON-CHAIN": "On-chain evidence", ADDRESS_HISTORY: "Address history", REPUTATION: "Reputation", TOKEN_APPROVAL: "Token approval", INTENT: "Intent comparison", POLICY: "Policy evaluation", AGENT: "Agent analysis" })[source] ?? "Security finding";
  }

  function createFindingRecord(finding) {
    const record = document.createElement("div");
    record.className = "nalar-evidence-record";
    record.setAttribute("data-kind", evidenceKind(finding));
    record.setAttribute("role", "group");
    record.setAttribute("aria-label", evidenceKind(finding));
    const title = document.createElement("strong");
    title.className = "nalar-evidence-label";
    title.textContent = finding?.title ?? finding?.code ?? "Security finding";
    const source = document.createElement("span");
    source.className = "nalar-badge-source";
    source.textContent = finding?.source ?? "UNKNOWN";
    const line = document.createElement("div");
    line.className = "nalar-evidence-line";
    line.appendChild(title);
    line.appendChild(source);
    record.appendChild(line);
    if (finding?.description) {
      const description = document.createElement("div");
      description.className = "nalar-evidence-explanation";
      description.textContent = finding.description;
      record.appendChild(description);
    }
    return record;
  }

  function createTechnicalSection(explanation, security, chainId) {
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
    const approval = Array.isArray(security?.effects?.approvals) ? security.effects.approvals[0] : null;
    const swap = Array.isArray(security?.effects?.swaps) ? security.effects.swaps[0] : null;
    const mint = Array.isArray(security?.effects?.mints) ? security.effects.mints[0] : null;

    const rows = [
      ["Network", getChainName(chainId)],
      ["Chain ID", chainId],
      ["Target address", tx.target ?? security?.transaction?.to ?? "N/A"],
      ...(approval ? [["Spender / operator", approval.spender ?? approval.operator ?? "N/A"]] : []),
      ...(approval?.token ? [["Approval token", approval.token]] : []),
      ...(approval?.amount !== undefined ? [["Allowance (base units)", approval.amount]] : []),
      ...(typeof approval?.approved === "boolean" ? [["Operator enabled", String(approval.approved)]] : []),
      ...(swap?.recipient || mint?.recipient ? [["Recipient", swap?.recipient ?? mint?.recipient]] : []),
      ["Action", humanizeAction(actual.action)],
      ["Function name", actual.functionName ?? "N/A"],
      ["Selector", actual.selector ?? "N/A"],
      ["Simulation status", sim.success === true ? "Passed at check time" : sim.success === false ? "Reverted / Failed" : "Unavailable"],
      ["BNB MCP status", security?.bnbIntelligence?.available === true ? "Available" : "Unavailable"],
      ["Risk score", Number.isFinite(security?.riskScore) ? `${security.riskScore} / 100 (${security?.riskLevel ?? "UNKNOWN"})` : "Unavailable"],
      ["Analysis completed", typeof security?.checkedAt === "string" && !Number.isNaN(Date.parse(security.checkedAt)) ? new Date(security.checkedAt).toLocaleString() : "Unavailable"],
      ...(typeof security?.transaction?.data === "string" ? [["Calldata", security.transaction.data]] : []),
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
      const fullValue = String(value);
      right.textContent = /^0x[a-fA-F0-9]{40}$/.test(fullValue) ? fullValue : fullValue.length > 72 ? `${fullValue.slice(0, 71)}…` : fullValue;
      right.title = fullValue;
      right.style.color = UI.soft;
      right.style.fontSize = "10px";
      right.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
      right.style.overflowWrap = "anywhere";

      row.appendChild(left);
      row.appendChild(right);
      content.appendChild(row);
    });

    wrapper.appendChild(content);
    wrapper.addEventListener("toggle", () => {
      if (!wrapper.open) return;
      try { window.NALAR_MOTION?.enter(content); } catch {}
    });

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
      const continueButton = createButton(decision === "REVIEW" ? "Review & continue" : "Continue to wallet", true);

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
      background: "rgba(25, 33, 40, 0.55)",
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      boxSizing: "border-box",
    });
  }

  function createModal() {
    const returnFocus = document.activeElement;
    const modal = document.createElement("div");

    modal.className = "nalar-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.tabIndex = -1;

    Object.assign(modal.style, {
      position: "relative",
      width: "min(520px, 100%)",
      overflow: "hidden",
      border: `1px solid ${UI.borderStrong}`,
      borderRadius: "12px",
      background: UI.bg,
      color: UI.text,
      boxShadow: "0 16px 48px rgba(15, 25, 32, 0.18)",
    });

    queueMicrotask(() => {
      if (!modal.isConnected) return;
      modal.setAttribute("aria-label", modal.querySelector("h2")?.textContent || "NALAR transaction check");
      const focusable = () => [...modal.querySelectorAll('button:not(:disabled), textarea, select, summary, a[href]')].filter((element) => element.getClientRects().length);
      if (!modal.contains(document.activeElement)) modal.focus({ preventScroll: true });
      modal.addEventListener("keydown", (event) => {
        if (event.key !== "Tab") return;
        const items = focusable();
        const first = items[0] || modal;
        const last = items.at(-1) || modal;
        if (event.shiftKey && (document.activeElement === first || document.activeElement === modal)) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === modal)) {
          event.preventDefault(); first.focus();
        }
      });
      const observer = new MutationObserver(() => {
        if (modal.isConnected) return;
        observer.disconnect();
        if (returnFocus?.isConnected && !document.querySelector(".nalar-overlay")) returnFocus.focus();
      });
      observer.observe(document.documentElement, { childList: true });
      try { window.NALAR_MOTION?.enter(modal); } catch {}
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
      color: primary ? "var(--nalar-ui-on-accent)" : UI.text,
      fontSize: "12.5px",
      fontWeight: "600",
      letterSpacing: "-0.01em",
      cursor: "pointer",
      boxShadow: "none",
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
          title: "Transaction blocked",
          subtitle: "Nalar stopped this transaction before your wallet signed it.",
          label: "Nalar stopped this transaction before your wallet signed it.",
        };

      case "REVIEW":
        return {
          title: "Review required",
          subtitle: "Nalar recommends reviewing this transaction before proceeding.",
          label: "Nalar recommends reviewing this transaction before proceeding.",
        };

      default:
        return {
          title: "Ready to continue",
          subtitle: "No blocking condition was found in the available checks.",
          label: "No blocking condition was found in the available checks.",
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
