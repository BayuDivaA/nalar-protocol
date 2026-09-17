import { IDS, UI } from "../constants.js";
import { createButton, createPanel, createRoot, centerRoot } from "./common.js";
import { removeElement } from "../utils.js";

export function showIntentOverlay(existingIntent = "") {
  return new Promise((resolve) => {
    removeElement(IDS.intent);

    const root = createRoot(IDS.intent);
    centerRoot(root);

    const panel = createPanel();

    /* ---- Header ---- */
    const header = document.createElement("div");
    Object.assign(header.style, {
      padding: "24px 24px 20px",
      borderBottom: `1px solid ${UI.border}`,
      background: UI.panelBg,
    });

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
    title.textContent = "Declare intent";

    const desc = document.createElement("div");
    Object.assign(desc.style, {
      marginTop: "8px",
      fontSize: "13px",
      lineHeight: "1.55",
      color: UI.textSecondary,
    });
    desc.textContent =
      "State what you expect this transaction to execute. Nalar validates your intent against actual bytecode and on-chain effects.";

    header.appendChild(eyebrow);
    header.appendChild(title);
    header.appendChild(desc);
    panel.appendChild(header);

    /* ---- Body ---- */
    const body = document.createElement("div");
    Object.assign(body.style, {
      padding: "22px 24px 24px",
      background: UI.panelBg,
    });

    const inputLabel = document.createElement("div");
    Object.assign(inputLabel.style, {
      marginBottom: "10px",
      fontSize: "10px",
      fontWeight: "600",
      letterSpacing: "0.1em",
      color: UI.textDim,
      textTransform: "uppercase",
    });
    inputLabel.textContent = "USER INTENT";

    const input = document.createElement("textarea");
    input.value = existingIntent || "";
    input.placeholder = "e.g. Swap 0.001 tBNB to NDEMO";

    Object.assign(input.style, {
      width: "100%",
      minHeight: "105px",
      resize: "vertical",
      boxSizing: "border-box",
      padding: "12px 14px",
      borderRadius: "8px",
      border: `1px solid ${UI.border}`,
      background: UI.bg2,
      color: UI.text,
      outline: "none",
      fontSize: "13px",
      lineHeight: "1.55",
      fontFamily: UI.fontFamily,
      transition: "border-color 0.15s ease",
    });

    input.addEventListener("focus", () => {
      input.style.borderColor = UI.borderAccent;
    });

    input.addEventListener("blur", () => {
      input.style.borderColor = UI.border;
    });

    body.appendChild(inputLabel);
    body.appendChild(input);

    /* ---- Footer Actions ---- */
    const footer = document.createElement("div");
    Object.assign(footer.style, {
      display: "flex",
      justifyContent: "flex-end",
      alignItems: "center",
      gap: "10px",
      marginTop: "20px",
      paddingTop: "18px",
      borderTop: `1px solid ${UI.border}`,
    });

    const cancel = createButton("Cancel", "secondary");
    const analyze = createButton("Analyze", "primary");

    cancel.addEventListener("click", () => {
      root.remove();
      resolve(null);
    });

    analyze.addEventListener("click", () => {
      const intent = input.value.trim();

      if (!intent) {
        input.focus();
        input.style.borderColor = UI.block;
        return;
      }

      root.remove();
      resolve(intent);
    });

    footer.appendChild(cancel);
    footer.appendChild(analyze);
    body.appendChild(footer);

    panel.appendChild(body);
    root.appendChild(panel);
    document.documentElement.appendChild(root);

    setTimeout(() => input.focus(), 50);
  });
}
