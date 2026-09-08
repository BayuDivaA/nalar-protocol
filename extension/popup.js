const intentInput = document.getElementById("intent");

const saveButton = document.getElementById("save");

const status = document.getElementById("status");

const protectionToggle = document.getElementById("protectionToggle");

const toggleIndicator = document.getElementById("toggleIndicator");

const toggleLabel = document.getElementById("toggleLabel");

async function loadSettings() {
  const result = await chrome.storage.local.get(["intent", "protectionEnabled"]);

  intentInput.value = result.intent ?? "";

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

  await chrome.storage.local.set({
    intent,
  });

  status.textContent = "Intent saved.";

  setTimeout(() => {
    status.textContent = "";
  }, 1600);
});

loadSettings();
