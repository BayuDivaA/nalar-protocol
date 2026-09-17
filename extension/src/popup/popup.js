const toggle = document.getElementById("toggle");
const protectionStatus = document.getElementById("protectionStatus");
const statusLabel = document.getElementById("statusLabel");
const statusDot = document.getElementById("statusDot");

async function loadState() {
  const result = await chrome.storage.local.get(["nalarProtectionEnabled"]);
  const enabled = result.nalarProtectionEnabled !== false;
  updateUI(enabled);
}

function updateUI(enabled) {
  toggle.classList.toggle("active", enabled);

  if (protectionStatus) {
    protectionStatus.textContent = enabled ? "Firewall active" : "Firewall paused";
  }

  if (statusLabel) {
    statusLabel.textContent = enabled ? "ACTIVE" : "PAUSED";
    statusLabel.classList.toggle("active", enabled);
  }

  if (statusDot) {
    statusDot.classList.toggle("active", enabled);
  }
}

toggle.addEventListener("click", async () => {
  const result = await chrome.storage.local.get(["nalarProtectionEnabled"]);
  const current = result.nalarProtectionEnabled !== false;
  const next = !current;

  await chrome.storage.local.set({ nalarProtectionEnabled: next });
  updateUI(next);
});

loadState();
