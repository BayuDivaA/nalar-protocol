const intentInput = document.getElementById("intent");
const saveButton = document.getElementById("save");
const status = document.getElementById("status");
const siteName = document.getElementById("siteName");
const systemStatus = document.getElementById("systemStatus");

const protectionToggle = document.getElementById("protectionToggle");
const toggleLabel = document.getElementById("toggleLabel");

let currentOrigin = null;

async function getCurrentOrigin() {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  const tab = tabs[0];

  if (!tab?.url) {
    return null;
  }

  try {
    return new URL(tab.url).origin;
  } catch {
    return null;
  }
}

async function loadSettings() {
  currentOrigin = await getCurrentOrigin();

  const result = await chrome.storage.local.get(["intents", "protectionEnabled"]);

  const intents = result.intents ?? {};

  if (currentOrigin) {
    intentInput.value = intents[currentOrigin] ?? "";
    siteName.textContent = new URL(currentOrigin).hostname;
  } else {
    intentInput.value = "";
    siteName.textContent = "Current site unavailable";
  }

  const enabled = result.protectionEnabled !== false;

  await chrome.storage.local.set({
    protectionEnabled: enabled,
  });

  renderProtectionState(enabled);
}

function renderProtectionState(enabled) {
  protectionToggle.setAttribute("aria-pressed", String(enabled));

  protectionToggle.classList.toggle("off", !enabled);

  toggleLabel.textContent = enabled ? "ACTIVE" : "PAUSED";
  systemStatus.textContent = enabled ? "Protection active" : "Protection paused";
}

protectionToggle.addEventListener("click", async () => {
  const result = await chrome.storage.local.get(["protectionEnabled"]);

  const current = result.protectionEnabled !== false;

  const next = !current;

  await chrome.storage.local.set({
    protectionEnabled: next,
  });

  renderProtectionState(next);

  status.textContent = next ? "Protection active." : "Protection paused.";

  setTimeout(() => {
    status.textContent = "";
  }, 1600);
});

saveButton.addEventListener("click", async () => {
  const intent = intentInput.value.trim();

  if (!intent) {
    status.textContent = "Intent cannot be empty.";
    return;
  }

  if (!currentOrigin) {
    status.textContent = "Unable to determine current website.";
    return;
  }

  const result = await chrome.storage.local.get(["intents"]);

  const intents = result.intents ?? {};

  intents[currentOrigin] = intent;

  await chrome.storage.local.set({
    intents,
  });

  status.textContent = "Intent saved.";

  setTimeout(() => {
    status.textContent = "";
  }, 1600);
});

loadSettings().catch((error) => {
  console.error("[Nalar] Failed to load settings:", error);

  status.textContent = "Failed to load Nalar settings.";
});
