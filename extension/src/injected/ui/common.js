import { UI } from "../constants.js";

/* ---- Shared global styles injected once into page ---- */

let stylesInjected = false;

function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;

  const style = document.createElement("style");
  style.id = "__nalar_styles__";
  style.textContent = `
    @keyframes nalarFadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes nalarEnter {
      from {
        opacity: 0;
        transform: translateY(2px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    @keyframes nalarPulse {
      0%, 100% {
        opacity: 0.35;
      }
      50% {
        opacity: 1;
      }
    }
    .__nalar_scrollbar::-webkit-scrollbar {
      width: 5px;
      height: 5px;
    }
    .__nalar_scrollbar::-webkit-scrollbar-track {
      background: #090909;
    }
    .__nalar_scrollbar::-webkit-scrollbar-thumb {
      background: #242424;
      border-radius: 3px;
    }
    .__nalar_scrollbar::-webkit-scrollbar-thumb:hover {
      background: #3A3A3A;
    }
  `;
  document.head.appendChild(style);
}

/* ---- Base Styles ---- */

export function applyBaseStyles(element) {
  injectStyles();
  Object.assign(element.style, {
    boxSizing: "border-box",
    fontFamily: UI.fontFamily,
    color: UI.text,
    WebkitFontSmoothing: "antialiased",
  });
}

/* ---- Root Overlay ---- */

export function createRoot(id) {
  const root = document.createElement("div");
  root.id = id;

  Object.assign(root.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483647",
    pointerEvents: "none",
  });

  applyBaseStyles(root);
  return root;
}

export function centerRoot(root) {
  Object.assign(root.style, {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "16px",
    background: UI.overlayBg,
    animation: "nalarFadeIn 0.2s ease both",
    pointerEvents: "auto",
  });
}

/* ---- Panel (Single Coherent Surface) ---- */

export function createPanel() {
  const panel = document.createElement("div");

  Object.assign(panel.style, {
    width: "min(540px, calc(100vw - 32px))",
    maxHeight: "calc(100vh - 32px)",
    display: "flex",
    flexDirection: "column",
    background: UI.panelBg,
    border: `1px solid ${UI.border}`,
    borderRadius: "16px",
    boxShadow: "0 20px 48px rgba(0, 0, 0, 0.75), 0 2px 6px rgba(0, 0, 0, 0.4)",
    overflow: "hidden",
    pointerEvents: "auto",
    animation: "nalarEnter 0.22s ease both",
  });

  return panel;
}

/* ---- Content Scroll Area ---- */

export function createScrollArea() {
  const scrollArea = document.createElement("div");
  scrollArea.className = "__nalar_scrollbar";

  Object.assign(scrollArea.style, {
    flex: "1 1 auto",
    overflowY: "auto",
    overscrollBehavior: "contain",
  });

  return scrollArea;
}

/* ---- Section with Label and Clean Separator ---- */

export function createSection(label, content, options = {}) {
  const section = document.createElement("div");

  Object.assign(section.style, {
    padding: options.padding || "18px 24px",
    borderBottom: options.noBorder ? "none" : `1px solid ${UI.border}`,
    background: "transparent",
  });

  if (label) {
    const labelEl = document.createElement("div");
    Object.assign(labelEl.style, {
      marginBottom: "10px",
      fontSize: "10px",
      fontWeight: "600",
      letterSpacing: "0.1em",
      color: UI.textDim,
      textTransform: "uppercase",
    });
    labelEl.textContent = label;
    section.appendChild(labelEl);
  }

  if (content) {
    section.appendChild(content);
  }

  return section;
}

/* ---- Collapsible Technical Section ---- */

export function createCollapsibleSection(label, content, collapsed = true) {
  const section = document.createElement("div");

  Object.assign(section.style, {
    padding: "0 24px",
    borderBottom: `1px solid ${UI.border}`,
    background: "transparent",
  });

  const toggle = document.createElement("button");
  toggle.type = "button";

  Object.assign(toggle.style, {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    padding: "16px 0",
    background: "none",
    border: "none",
    cursor: "pointer",
    outline: "none",
    fontFamily: UI.fontFamily,
  });

  const labelEl = document.createElement("span");
  Object.assign(labelEl.style, {
    fontSize: "10px",
    fontWeight: "600",
    letterSpacing: "0.1em",
    color: UI.textDim,
    textTransform: "uppercase",
  });
  labelEl.textContent = label;

  const chevron = document.createElement("span");
  Object.assign(chevron.style, {
    fontSize: "11px",
    color: UI.textMuted,
    transition: "transform 0.18s ease",
  });
  chevron.textContent = "▸";

  toggle.appendChild(labelEl);
  toggle.appendChild(chevron);

  const body = document.createElement("div");
  Object.assign(body.style, {
    overflow: "hidden",
    paddingBottom: collapsed ? "0" : "16px",
    maxHeight: collapsed ? "0" : "none",
    transition: "max-height 0.2s ease, padding-bottom 0.2s ease",
  });
  body.appendChild(content);

  let isCollapsed = collapsed;

  toggle.addEventListener("click", () => {
    isCollapsed = !isCollapsed;

    if (isCollapsed) {
      body.style.maxHeight = "0";
      body.style.paddingBottom = "0";
      chevron.style.transform = "rotate(0deg)";
    } else {
      body.style.maxHeight = `${body.scrollHeight + 16}px`;
      body.style.paddingBottom = "16px";
      chevron.style.transform = "rotate(90deg)";
    }
  });

  if (!collapsed) {
    chevron.style.transform = "rotate(90deg)";
  }

  section.appendChild(toggle);
  section.appendChild(body);

  return section;
}

/* ---- Editorial Text Block ---- */

export function createTextBlock(text, options = {}) {
  const el = document.createElement("div");

  Object.assign(el.style, {
    fontSize: options.fontSize || "13px",
    lineHeight: options.lineHeight || "1.6",
    color: options.color || UI.textSecondary,
    fontWeight: options.bold ? "600" : "400",
  });

  el.textContent = text;
  return el;
}

/* ---- Native Tactile Button ---- */

export function createButton(label, variant = "secondary") {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;

  const isPrimary = variant === "primary" || variant === true;

  Object.assign(btn.style, {
    appearance: "none",
    height: "40px",
    padding: "0 18px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: isPrimary ? "600" : "500",
    fontFamily: UI.fontFamily,
    cursor: "pointer",
    outline: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.12s ease, border-color 0.12s ease, transform 0.08s ease",
    border: isPrimary ? "1px solid #FFFFFF" : `1px solid ${UI.borderStrong}`,
    background: isPrimary ? "#F5F5F5" : UI.bg3,
    color: isPrimary ? "#090909" : UI.text,
  });

  btn.addEventListener("mouseenter", () => {
    if (isPrimary) {
      btn.style.background = "#FFFFFF";
    } else {
      btn.style.background = "#1C1C1C";
      btn.style.borderColor = UI.borderAccent;
    }
  });

  btn.addEventListener("mouseleave", () => {
    if (isPrimary) {
      btn.style.background = "#F5F5F5";
    } else {
      btn.style.background = UI.bg3;
      btn.style.borderColor = UI.borderStrong;
    }
  });

  btn.addEventListener("mousedown", () => {
    btn.style.transform = "translateY(1px)";
  });

  btn.addEventListener("mouseup", () => {
    btn.style.transform = "translateY(0)";
  });

  btn.addEventListener("focus", () => {
    btn.style.outline = `2px solid ${UI.borderAccent}`;
    btn.style.outlineOffset = "2px";
  });

  btn.addEventListener("blur", () => {
    btn.style.outline = "none";
  });

  return btn;
}

/* ---- Structured Key-Value Row ---- */

export function createKvRow(label, value, options = {}) {
  const row = document.createElement("div");

  Object.assign(row.style, {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: "16px",
    padding: "5px 0",
  });

  const labelEl = document.createElement("span");
  Object.assign(labelEl.style, {
    color: UI.textMuted,
    fontSize: options.labelFontSize || "12px",
    letterSpacing: options.uppercase ? "0.06em" : "normal",
    textTransform: options.uppercase ? "uppercase" : "none",
  });
  labelEl.textContent = label;

  const valueEl = document.createElement("span");
  Object.assign(valueEl.style, {
    color: options.color || UI.text,
    fontSize: options.valueFontSize || "12px",
    fontFamily: options.mono ? UI.monoFamily : UI.fontFamily,
    fontWeight: options.bold ? "600" : "400",
    textAlign: "right",
    wordBreak: "break-all",
  });
  valueEl.textContent = String(value);

  row.appendChild(labelEl);
  row.appendChild(valueEl);

  return row;
}

/* ---- Minimal Badge ---- */

export function createBadge(text, options = {}) {
  const badge = document.createElement("span");

  Object.assign(badge.style, {
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 7px",
    borderRadius: "4px",
    border: `1px solid ${options.borderColor || UI.border}`,
    background: options.bg || UI.bg2,
    color: options.color || UI.textSecondary,
    fontSize: "10px",
    fontWeight: "600",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  });

  badge.textContent = text;
  return badge;
}
