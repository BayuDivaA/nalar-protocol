import { IDS, LIMITS, UI } from "../constants.js";
import { createPanel, createRoot, centerRoot } from "./common.js";
import { removeElement } from "../utils.js";

const STEPS = [
  "UNDERSTANDING INTENT",
  "DECODING TRANSACTION",
  "SIMULATING EXECUTION",
  "INSPECTING CONTRACT",
  "READING ON-CHAIN STATE",
  "EVALUATING SECURITY",
];

export function showAnalysisOverlay() {
  removeElement(IDS.analysis);

  const root = createRoot(IDS.analysis);
  centerRoot(root);

  const panel = createPanel();

  const content = document.createElement("div");
  Object.assign(content.style, {
    padding: "24px 24px 22px",
    background: UI.panelBg,
  });

  /* ---- Header ---- */
  const eyebrow = document.createElement("div");
  Object.assign(eyebrow.style, {
    fontSize: "10px",
    fontWeight: "600",
    letterSpacing: "0.12em",
    color: UI.textDim,
    textTransform: "uppercase",
  });
  eyebrow.textContent = "NALAR · TXSENTRY";

  const title = document.createElement("div");
  Object.assign(title.style, {
    marginTop: "10px",
    fontSize: "22px",
    fontWeight: "600",
    letterSpacing: "-0.02em",
    color: UI.text,
  });
  title.textContent = "Analyzing transaction";

  const subtitle = document.createElement("div");
  Object.assign(subtitle.style, {
    marginTop: "8px",
    fontSize: "13px",
    lineHeight: "1.55",
    color: UI.textSecondary,
  });
  subtitle.textContent =
    "Inspecting execution payload and evaluating against on-chain contract state.";

  content.appendChild(eyebrow);
  content.appendChild(title);
  content.appendChild(subtitle);

  /* ---- Vertical Scanning Sequence ---- */
  const sequenceContainer = document.createElement("div");
  Object.assign(sequenceContainer.style, {
    marginTop: "24px",
    borderTop: `1px solid ${UI.border}`,
  });

  const checkmarkSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${UI.allow}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  const pendingDotSvg = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="${UI.borderAccent}" stroke-width="2"><circle cx="12" cy="12" r="8"/></svg>`;
  const activePulseSvg = `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${UI.text};animation:nalarPulse 1.2s infinite ease-in-out;"></span>`;

  const rows = STEPS.map((label, index) => {
    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "11px 0",
      borderBottom: `1px solid ${UI.borderMuted}`,
      transition: "opacity 0.2s ease, transform 0.2s ease",
    });

    const labelEl = document.createElement("span");
    Object.assign(labelEl.style, {
      fontSize: "11px",
      fontWeight: "600",
      letterSpacing: "0.08em",
      color: UI.textDim,
      textTransform: "uppercase",
      transition: "color 0.2s ease",
    });
    labelEl.textContent = label;

    const indicator = document.createElement("div");
    Object.assign(indicator.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "20px",
      height: "20px",
      fontFamily: UI.monoFamily,
      fontSize: "12px",
    });
    indicator.innerHTML = pendingDotSvg;

    row.appendChild(labelEl);
    row.appendChild(indicator);
    sequenceContainer.appendChild(row);

    return { row, labelEl, indicator };
  });

  content.appendChild(sequenceContainer);

  /* ---- Note ---- */
  const note = document.createElement("div");
  Object.assign(note.style, {
    marginTop: "20px",
    paddingTop: "14px",
    borderTop: `1px solid ${UI.border}`,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "10px",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: UI.textDim,
  });

  const noteText = document.createElement("span");
  noteText.textContent = "Deterministic verification";

  const noteStatus = document.createElement("span");
  Object.assign(noteStatus.style, {
    fontFamily: UI.monoFamily,
  });
  noteStatus.textContent = "STANDBY";

  note.appendChild(noteText);
  note.appendChild(noteStatus);
  content.appendChild(note);

  panel.appendChild(content);
  root.appendChild(panel);
  document.documentElement.appendChild(root);

  /* ---- Scanning Step Logic ---- */
  let currentStep = 0;

  function renderSteps(activeIdx) {
    rows.forEach((item, idx) => {
      if (idx < activeIdx) {
        /* completed */
        item.labelEl.style.color = UI.textSecondary;
        item.indicator.innerHTML = checkmarkSvg;
      } else if (idx === activeIdx) {
        /* active */
        item.labelEl.style.color = UI.text;
        item.indicator.innerHTML = activePulseSvg;
      } else {
        /* pending */
        item.labelEl.style.color = UI.textDim;
        item.indicator.innerHTML = pendingDotSvg;
      }
    });

    noteStatus.textContent = `STEP ${Math.min(activeIdx + 1, STEPS.length)} OF ${STEPS.length}`;
  }

  renderSteps(0);

  const interval = setInterval(() => {
    currentStep += 1;

    if (currentStep >= STEPS.length) {
      clearInterval(interval);
      /* mark all completed */
      rows.forEach((item) => {
        item.labelEl.style.color = UI.textSecondary;
        item.indicator.innerHTML = checkmarkSvg;
      });
      noteStatus.textContent = "ANALYSIS COMPLETE";
      return;
    }

    renderSteps(currentStep);
  }, LIMITS.ANALYSIS_STEP_DURATION);

  return {
    remove() {
      clearInterval(interval);
      removeElement(IDS.analysis);
    },
  };
}
