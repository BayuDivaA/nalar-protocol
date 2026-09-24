/* ==========================================================================
   NALAR PROTOCOL · POPUP
   ==========================================================================

   The popup answers four questions in order, and nothing else:

     Is Nalar covering me right now?   the state block under the brand
     Which chain does it analyse?      the network row, read from config.js
     What did I say this site does?    the intent field for the current origin
     How do I turn it off?             the protection control in the footer

   Presentation is driven entirely by theme.css tokens and the shared
   primitives in ui.css, so a change to the design system lands here and in
   the in-page overlay at the same time.
   ========================================================================== */

(() => {
  "use strict";

  const THEME = window.NALAR_THEME;

  const els = {
    state: document.getElementById("state"),
    stateTitle: document.getElementById("stateTitle"),
    stateNote: document.getElementById("stateNote"),
    themeToggle: document.getElementById("themeToggle"),
    siteName: document.getElementById("siteName"),
    intent: document.getElementById("intent"),
    intentHint: document.getElementById("intentHint"),
    save: document.getElementById("save"),
    message: document.getElementById("message"),
    toggle: document.getElementById("toggle"),
    toggleState: document.getElementById("toggleState"),
    toggleAction: document.getElementById("toggleAction"),
    networkName: document.getElementById("networkName"),
    networkMeta: document.getElementById("networkMeta"),
  };

  const COPY = {
    active: {
      title: "Protected",
      note: "Your transactions are being checked before signing.",
    },
    paused: {
      title: "Protection paused",
      note: "Transactions reach your wallet without a Nalar check.",
    },
  };

  let currentOrigin = null;
  let savedIntent = "";
  let protectionEnabled = true;
  let messageTimer = 0;
  let confirmTimer = 0;

  /* --- Small helpers --------------------------------------------------- */

  function setMessage(text, tone) {
    clearTimeout(messageTimer);
    els.message.textContent = text || "";
    if (tone) {
      els.message.dataset.tone = tone;
    } else {
      delete els.message.dataset.tone;
    }
    // Errors stay until the next action; confirmations fade on their own.
    if (text && tone !== "error") {
      messageTimer = setTimeout(() => {
        els.message.textContent = "";
      }, 2600);
    }
  }

  async function getCurrentOrigin() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (!tab || !tab.url) return null;
      const url = new URL(tab.url);
      // Only http(s) pages can carry a wallet transaction, so only they get
      // an intent. chrome:// and file:// tabs report no origin instead.
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
      return url.origin;
    } catch {
      return null;
    }
  }

  /* --- Theme -----------------------------------------------------------
     The stored choice is the product-wide one: the same key decides the
     popup and, through the bridge, the in-page overlay. */

  function applyTheme(theme) {
    const next = THEME.apply(document.documentElement, theme);
    els.themeToggle.textContent = next === "light" ? "◑" : "◐";
    const label = `Switch to ${next === "light" ? "dark" : "light"} theme`;
    els.themeToggle.setAttribute("aria-label", label);
    els.themeToggle.title = label;
    return next;
  }

  async function initTheme() {
    const stored = await chrome.storage.local.get("nalarTheme");
    const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    const resolved = applyTheme(stored.nalarTheme || (prefersLight ? "light" : "dark"));
    // Persist the resolved theme on first run. Without this the popup would
    // render light while the in-page overlay, reading an empty key, fell back
    // to dark - the same product disagreeing with itself.
    if (stored.nalarTheme !== resolved) {
      await chrome.storage.local.set({ nalarTheme: resolved });
    }
  }

  els.themeToggle.addEventListener("click", async () => {
    const current = document.documentElement.getAttribute("data-nalar-theme");
    const next = applyTheme(current === "light" ? "dark" : "light");
    await chrome.storage.local.set({ nalarTheme: next });
  });

  /* --- Network ---------------------------------------------------------
     Read from config.js rather than written here, so the popup can never
     claim a chain the security check cannot actually analyse. */

  function renderNetwork() {
    const config = window.NALAR_CONFIG;
    const chains = config && config.SUPPORTED_CHAINS ? Object.values(config.SUPPORTED_CHAINS) : [];

    if (chains.length === 0) {
      els.networkName.textContent = "No network configured";
      els.networkMeta.textContent = "Analysis is unavailable";
      return;
    }

    if (chains.length === 1) {
      els.networkName.textContent = chains[0].name;
      els.networkMeta.textContent = `Chain ID ${chains[0].id} · ${chains[0].symbol}`;
      return;
    }

    els.networkName.textContent = `${chains.length} networks`;
    els.networkMeta.textContent = chains.map((chain) => `${chain.name} · ${chain.id}`).join(" · ");
  }

  /* --- Protection state ------------------------------------------------ */

  function pulse() {
    if (THEME.prefersReducedMotion()) return;
    clearTimeout(confirmTimer);
    els.state.classList.remove("is-confirming");
    // Reading offsetWidth restarts the keyframes if the class was just on.
    void els.state.offsetWidth;
    els.state.classList.add("is-confirming");
    confirmTimer = setTimeout(() => {
      els.state.classList.remove("is-confirming");
    }, 560);
  }

  function renderProtection(enabled, options) {
    const changed = enabled !== protectionEnabled;
    protectionEnabled = enabled;
    const copy = enabled ? COPY.active : COPY.paused;

    els.toggle.setAttribute("aria-pressed", String(enabled));
    els.toggleState.textContent = enabled ? "Active" : "Paused";
    els.toggleAction.textContent = enabled ? "Pause protection" : "Resume protection";

    els.state.dataset.state = enabled ? "active" : "paused";
    els.stateTitle.textContent = copy.title;
    els.stateNote.textContent = copy.note;

    // One confirmation ring, only on the way back to protection.
    if (enabled && changed && options && options.pulse) pulse();
  }

  els.toggle.addEventListener("click", async () => {
    try {
      const stored = await chrome.storage.local.get("protectionEnabled");
      const next = stored.protectionEnabled === false;
      await chrome.storage.local.set({ protectionEnabled: next });
      renderProtection(next, { pulse: true });
      setMessage(next ? "Protection resumed." : "Protection paused for every site.");
    } catch {
      setMessage("Could not change protection. Try again.", "error");
    }
  });

  /* --- Intent ---------------------------------------------------------- */

  function renderIntentHint() {
    if (!currentOrigin) {
      els.intentHint.textContent = "Open a website to describe what you expect there.";
      return;
    }
    if (!savedIntent && !els.intent.value.trim()) {
      els.intentHint.textContent = "No intent saved for this site yet.";
      return;
    }
    els.intentHint.textContent =
      els.intent.value.trim() === savedIntent
        ? "Nalar compares this against what the transaction actually does."
        : "Unsaved changes.";
  }

  els.intent.addEventListener("input", renderIntentHint);

  els.save.addEventListener("click", async () => {
    const intent = els.intent.value.trim();
    if (!intent) {
      setMessage("Describe what you expect the transaction to do.", "warning");
      els.intent.focus();
      return;
    }
    if (!currentOrigin) {
      setMessage("Nalar cannot identify this page, so it cannot store an intent.", "warning");
      return;
    }

    try {
      const stored = await chrome.storage.local.get("intents");
      const intents = stored.intents || {};
      intents[currentOrigin] = intent;
      await chrome.storage.local.set({ intents });
      savedIntent = intent;
      renderIntentHint();
      setMessage("Intent saved for this site.");
    } catch {
      setMessage("Could not save the intent. Try again.", "error");
    }
  });

  /* --- Load ------------------------------------------------------------ */

  async function loadSettings() {
    await initTheme();
    renderNetwork();

    currentOrigin = await getCurrentOrigin();
    const stored = await chrome.storage.local.get(["intents", "protectionEnabled"]);
    const intents = stored.intents || {};

    if (currentOrigin) {
      savedIntent = (intents[currentOrigin] || "").trim();
      els.intent.value = savedIntent;
      els.siteName.textContent = new URL(currentOrigin).hostname;
    } else {
      // The field stays editable on purpose. A disabled input reads as a
      // broken popup, and the user cannot tell "wrong tab" from "Nalar is
      // broken" - so typing always works and only saving needs a website.
      els.siteName.textContent = "No website in this tab";
    }
    renderIntentHint();

    // Default to on, then persist the default so the background worker and
    // the popup can never disagree about the current state.
    const enabled = stored.protectionEnabled !== false;
    await chrome.storage.local.set({ protectionEnabled: enabled });
    renderProtection(enabled, { pulse: false });
  }

  function renderUnavailable() {
    els.state.dataset.state = "error";
    els.stateTitle.textContent = "Settings unavailable";
    els.stateNote.textContent = "Nalar could not read your settings. Close and reopen this popup to try again.";
    els.networkName.textContent = "Unknown";
    els.networkMeta.textContent = "Analysis state could not be read";
    els.intent.disabled = true;
    els.save.disabled = true;
    els.toggle.disabled = true;
    els.siteName.textContent = "Unavailable";
    setMessage("Nalar settings could not be loaded.", "error");
  }

  loadSettings().catch((error) => {
    console.error("[Nalar] Popup initialization failed:", error);
    renderUnavailable();
  });
})();
