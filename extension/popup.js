const intentInput = document.getElementById("intent");

const saveButton = document.getElementById("save");

const message = document.getElementById("message");

const siteName = document.getElementById("siteName");

const toggle = document.getElementById("toggle");

const systemStatus = document.getElementById("systemStatus");

const statusDot = document.getElementById("statusDot");

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

    try {
      siteName.textContent = new URL(currentOrigin).hostname;
    } catch {
      siteName.textContent = "Current site";
    }
  } else {
    siteName.textContent = "Current site unavailable";
  }

  const enabled = result.protectionEnabled !== false;

  await chrome.storage.local.set({
    protectionEnabled: enabled,
  });

  renderProtection(enabled);
}

function renderProtection(enabled) {
  toggle.textContent = enabled ? "ACTIVE" : "PAUSED";

  toggle.classList.toggle("paused", !enabled);

  toggle.setAttribute("aria-pressed", String(enabled));

  systemStatus.textContent = enabled ? "Protection active" : "Protection paused";

  statusDot.style.background = enabled ? "#9EBC9F" : "#77766F";
}

toggle.addEventListener("click", async () => {
  const result = await chrome.storage.local.get(["protectionEnabled"]);

  const current = result.protectionEnabled !== false;

  const next = !current;

  await chrome.storage.local.set({
    protectionEnabled: next,
  });

  renderProtection(next);

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

  const result = await chrome.storage.local.get(["intents"]);

  const intents = result.intents ?? {};

  intents[currentOrigin] = intent;

  await chrome.storage.local.set({
    intents,
  });

  message.textContent = "Intent saved for this site.";

  setTimeout(() => {
    message.textContent = "";
  }, 1600);
});

loadSettings().catch((error) => {
  console.error("[Nalar] Popup initialization failed:", error);

  message.textContent = "Unable to load Nalar settings.";
});
