const intentInput = document.getElementById("intent");
const saveButton = document.getElementById("save");
const clearIntentButton = document.getElementById("clearIntent");
const message = document.getElementById("message");
const siteName = document.getElementById("siteName");
const toggle = document.getElementById("toggle");
const systemStatus = document.getElementById("systemStatus");
const statusDot = document.getElementById("statusDot");
const themeToggle = document.getElementById("themeToggle");
const securityHeading = document.getElementById("securityHeading");
const securityDescription = document.getElementById("securityDescription");
const networkSelect = document.getElementById("networkSelect");
const networkNote = document.getElementById("networkNote");
const networkError = document.getElementById("networkError");
const networkErrorTitle = document.getElementById("networkErrorTitle");
const networkErrorText = document.getElementById("networkErrorText");
const networkRetry = document.getElementById("networkRetry");
const networkTestnet = document.getElementById("networkTestnet");

let currentOrigin = null;
let currentTabId = null;
let selectedNetwork = 97;
let networkState = "checking";
let protectionEnabled = true;

function showNetworkError(title, description) {
  networkState = "error";
  networkErrorTitle.textContent = title;
  networkErrorText.textContent = description;
  networkError.hidden = false;
  networkNote.textContent = "Security checks are paused until the network is verified.";
  renderProtection(protectionEnabled);
}

async function inspectWalletNetwork(targetChainId = null) {
  if (!currentTabId) return { error: "PROVIDER_UNAVAILABLE" };
  try {
    const [execution] = await chrome.scripting.executeScript({
      target: { tabId: currentTabId },
      world: "MAIN",
      args: [targetChainId],
      func: async (target) => {
        const provider = window.ethereum ?? window.rabby;
        if (!provider?.request) return { error: "PROVIDER_UNAVAILABLE" };
        let actual;
        try {
          actual = Number(await provider.request({ method: "eth_chainId" }));
          if (!Number.isInteger(actual) || actual <= 0) return { error: "NETWORK_UNAVAILABLE" };
        } catch {
          return { error: "NETWORK_CONNECTION_FAILED" };
        }
        if (target !== null && actual !== target) {
          try {
            await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: `0x${target.toString(16)}` }] });
          } catch {
            return { error: "NETWORK_SWITCH_FAILED" };
          }
        }
        try {
          actual = Number(await provider.request({ method: "eth_chainId" }));
          if (!Number.isInteger(actual) || actual <= 0) return { error: "NETWORK_UNAVAILABLE" };
          if (target !== null && actual !== target) return { error: "NETWORK_SWITCH_FAILED" };
          if (actual !== 56 && actual !== 97) return { error: "NETWORK_NOT_SUPPORTED", chainId: actual };
          await provider.request({ method: "eth_blockNumber" });
          return { chainId: actual };
        } catch {
          return { error: "NETWORK_CONNECTION_FAILED" };
        }
      },
    });
    return execution?.result ?? { error: "NETWORK_UNAVAILABLE" };
  } catch {
    return { error: "PROVIDER_UNAVAILABLE" };
  }
}

function describeNetworkFailure(error, target) {
  if (error === "NETWORK_SWITCH_FAILED") {
    return ["COULD NOT SWITCH NETWORK", `${NALAR_CONFIG.SUPPORTED_CHAINS[target].name} could not be activated. Your current selection remains ${NALAR_CONFIG.SUPPORTED_CHAINS[selectedNetwork].name}.`];
  }
  if (error === "NETWORK_CONNECTION_FAILED") {
    return ["NETWORK CONNECTION FAILED", `Unable to connect to ${NALAR_CONFIG.SUPPORTED_CHAINS[target].fullName}. Check your network connection and try again.`];
  }
  if (error === "PROVIDER_UNAVAILABLE") {
    return ["NETWORK CONNECTION FAILED", `Unable to connect to ${NALAR_CONFIG.SUPPORTED_CHAINS[target].fullName}. Connect your wallet and try again.`];
  }
  if (error === "NETWORK_NOT_SUPPORTED") {
    return ["NETWORK NOT SUPPORTED", "NALAR supports BNB Testnet and BNB Mainnet. Switch to a supported network to continue."];
  }
  return ["NETWORK UNAVAILABLE", "NALAR could not determine the current wallet network. Connect a wallet and retry."];
}

async function switchNetwork(target) {
  if (!NALAR_CONFIG.SUPPORTED_CHAINS[target]) {
    showNetworkError("NETWORK NOT SUPPORTED", "NALAR supports BNB Testnet and BNB Mainnet.");
    networkSelect.value = String(selectedNetwork);
    return;
  }
  networkSelect.disabled = true;
  const result = await inspectWalletNetwork(target);
  if (!result.error) {
    const saved = await chrome.runtime.sendMessage({ type: "SET_NETWORK", chainId: target }).catch(() => null);
    if (saved?.ok) {
      selectedNetwork = target;
      networkError.hidden = true;
      networkNote.textContent = `Connected to ${NALAR_CONFIG.SUPPORTED_CHAINS[target].fullName}.`;
      networkState = "verified";
      renderProtection(protectionEnabled);
    } else {
      result.error = "NETWORK_UNAVAILABLE";
    }
  }
  if (result.error) showNetworkError(...describeNetworkFailure(result.error, target));
  networkSelect.value = String(selectedNetwork);
  networkSelect.disabled = false;
}

async function loadNetwork() {
  let stored;
  try {
    ({ selectedNetwork: stored } = await chrome.storage.local.get(["selectedNetwork"]));
  } catch {
    showNetworkError("NETWORK UNAVAILABLE", "NALAR could not read the selected network. Retry to continue.");
    return;
  }
  let validStored = Number.isInteger(stored) && NALAR_CONFIG.SUPPORTED_CHAINS[stored];
  selectedNetwork = validStored ? stored : 97;
  networkSelect.value = String(selectedNetwork);
  const result = await inspectWalletNetwork();
  if (result.error) {
    showNetworkError(...describeNetworkFailure(result.error, selectedNetwork));
    return;
  }
  if ((stored === undefined || !validStored) && result.chainId === 97) {
    const fallback = await chrome.runtime.sendMessage({ type: "SET_NETWORK", chainId: 97 }).catch(() => null);
    if (!fallback?.ok) {
      showNetworkError("NETWORK UNAVAILABLE", "NALAR could not save the validated BNB Testnet network. Retry to continue.");
      return;
    }
    stored = 97;
    validStored = true;
  }
  if (stored !== undefined && !validStored) {
    showNetworkError("NETWORK UNAVAILABLE", "The saved network is invalid. Select a supported network to continue.");
  } else if (result.chainId !== selectedNetwork) {
    showNetworkError("NETWORK MISMATCH", `Wallet: ${NALAR_CONFIG.SUPPORTED_CHAINS[result.chainId].name}. NALAR: ${NALAR_CONFIG.SUPPORTED_CHAINS[selectedNetwork].name}. Select a network to continue.`);
  } else {
    networkError.hidden = true;
    networkNote.textContent = `Connected to ${NALAR_CONFIG.SUPPORTED_CHAINS[selectedNetwork].fullName}.`;
    networkState = "verified";
    renderProtection(protectionEnabled);
  }
}

networkSelect.addEventListener("change", () => switchNetwork(Number(networkSelect.value)));
networkRetry.addEventListener("click", () => switchNetwork(selectedNetwork));
networkTestnet.addEventListener("click", () => switchNetwork(97));

async function getCurrentOrigin() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  currentTabId = tab?.id ?? null;
  if (!tab?.url) return null;
  try {
    return new URL(tab.url).origin;
  } catch {
    return null;
  }
}

async function initTheme() {
  const result = await chrome.storage.local.get(["nalarTheme"]);
  let theme = result.nalarTheme;
  if (!theme) {
    theme = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  applyTheme(theme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  if (themeToggle) {
    themeToggle.textContent = theme === "light" ? "LIGHT MODE" : "DARK MODE";
    themeToggle.setAttribute("title", `Switch to ${theme === "light" ? "dark" : "light"} mode`);
    themeToggle.setAttribute("aria-label", `Switch to ${theme === "light" ? "dark" : "light"} theme`);
  }
}

if (themeToggle) {
  themeToggle.addEventListener("click", async () => {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "light" ? "dark" : "light";
    applyTheme(next);
    await chrome.storage.local.set({ nalarTheme: next });
  });
}

async function loadSettings() {
  await initTheme();
  currentOrigin = await getCurrentOrigin();
  const result = await chrome.storage.local.get(["intents", "protectionEnabled"]);
  const intents = result.intents ?? {};

  if (currentOrigin) {
    intentInput.value = intents[currentOrigin] ?? "";
    clearIntentButton.disabled = !intents[currentOrigin];
    try {
      siteName.textContent = new URL(currentOrigin).hostname;
      siteName.title = currentOrigin;
    } catch {
      siteName.textContent = "Current site";
    }
  } else {
    siteName.textContent = "Current site unavailable";
    clearIntentButton.disabled = true;
  }

  const enabled = result.protectionEnabled !== false;
  await chrome.storage.local.set({ protectionEnabled: enabled });
  renderProtection(enabled);
  await loadNetwork();
  window.NALAR_MOTION?.enter(document.querySelector(".main"));
}

function renderProtection(enabled) {
  protectionEnabled = enabled;
  toggle.classList.toggle("paused", !enabled);
  toggle.setAttribute("aria-pressed", String(enabled));
  toggle.setAttribute("aria-label", enabled ? "Pause NALAR protection" : "Activate NALAR protection");
  systemStatus.textContent = enabled ? "ACTIVE" : "PAUSED";
  statusDot.classList.toggle("paused", !enabled);
  securityHeading.textContent = !enabled ? "Protection paused" : networkState === "verified" ? "Ready before signing" : networkState === "checking" ? "Checking network" : "Checks unavailable";
  securityDescription.textContent = !enabled
    ? "NALAR is inactive. Resume protection to inspect the next transaction."
    : networkState === "verified"
      ? "NALAR will inspect the next transaction before it reaches your wallet. The result appears over the current site."
      : networkState === "checking"
        ? "NALAR is verifying the selected wallet network before analysis."
        : "NALAR will hold transaction requests until the wallet network can be verified.";
}

toggle.addEventListener("click", async () => {
  const result = await chrome.storage.local.get(["protectionEnabled"]);
  const current = result.protectionEnabled !== false;
  const next = !current;
  await chrome.storage.local.set({ protectionEnabled: next });
  renderProtection(next);
  window.NALAR_MOTION?.status(toggle, next);
  if (next) window.NALAR_MOTION?.pulse(statusDot);
  message.textContent = next ? "Protection active." : "Protection paused.";
  setTimeout(() => {
    message.textContent = "";
  }, 1600);
});

saveButton.addEventListener("click", async () => {
  const intent = intentInput.value.trim();
  if (!intent) {
    message.textContent = "Describe what you expect the transaction to do.";
    intentInput.focus();
    return;
  }
  if (!currentOrigin) {
    message.textContent = "Unable to determine the current website.";
    return;
  }
  try {
    const result = await chrome.storage.local.get(["intents"]);
    const intents = { ...(result.intents ?? {}), [currentOrigin]: intent };
    await chrome.storage.local.set({ intents });
    clearIntentButton.disabled = false;
    message.textContent = "Intent saved for this site.";
  } catch {
    message.textContent = "Could not save intent. Try again.";
  }
});

clearIntentButton.addEventListener("click", async () => {
  if (!currentOrigin) return;
  try {
    const result = await chrome.storage.local.get(["intents"]);
    const intents = { ...(result.intents ?? {}) };
    delete intents[currentOrigin];
    await chrome.storage.local.set({ intents });
    intentInput.value = "";
    clearIntentButton.disabled = true;
    message.textContent = "Saved intent removed for this site.";
  } catch {
    message.textContent = "Could not remove saved intent. Try again.";
  }
});

loadSettings().catch((error) => {
  console.error("[Nalar] Popup initialization failed:", error);
  message.textContent = "Unable to load Nalar settings.";
});
