import { IDS, UI } from "../constants.js";
import {
  createBadge,
  createButton,
  createCollapsibleSection,
  createKvRow,
  createPanel,
  createRoot,
  createScrollArea,
  createSection,
  createTextBlock,
  centerRoot,
} from "./common.js";
import {
  formatAddress,
  formatReason,
  humanizeAction,
  humanizeStateCode,
  safeNumber,
  removeElement,
} from "../utils.js";

export function showDecisionOverlay(security, decision, onContinue, onCancel) {
  removeElement(IDS.decision);

  const root = createRoot(IDS.decision);
  centerRoot(root);

  const panel = createPanel();

  /* ---- Extract normalized data ---- */
  const riskScore = safeNumber(security?.riskScore);
  const riskLevel = String(security?.riskLevel || (decision === "BLOCK" ? "CRITICAL" : decision === "REVIEW" ? "MEDIUM" : "LOW")).toUpperCase();
  const txSummary = security?.transactionSummary || {};
  const userIntent = security?.intent?.description || security?.userIntent || "";
  const actualAction = security?.actual?.action || security?.action || "TRANSACTION";
  const functionName = security?.actual?.functionName || security?.functionName || null;
  const contractAddress = security?.contract?.address || security?.actual?.contract || security?.targetContract || null;
  const explanation = security?.explanation || {};
  const simulation = security?.simulation || {};
  const intentMatch = security?.intentMatch;
  const selector = security?.actual?.selector || security?.selector || null;
  const chainId = security?.transaction?.chainId || security?.chainId || null;

  const tokenReports = Array.isArray(security?.scamAnalyses)
    ? security.scamAnalyses
    : Array.isArray(security?.transactionScamContext?.analyses)
      ? security.transactionScamContext.analyses
      : [];

  /* ---- 1. Fixed Header ---- */
  panel.appendChild(createDecisionHeader(decision, riskLevel, riskScore));

  /* ---- 2. Scrollable Body ---- */
  const scrollArea = createScrollArea();

  /* ---- 2a. Primary Content: Why it was stopped / Security Assessment ---- */
  scrollArea.appendChild(createReasonSection(decision, explanation, security, tokenReports));

  /* ---- 2b. Intent vs Actual Execution ---- */
  scrollArea.appendChild(createIntentComparisonSection(userIntent, txSummary, actualAction, intentMatch));

  /* ---- 2c. What will happen (Semantic Transaction Summary) ---- */
  if (txSummary.description || (Array.isArray(txSummary.details) && txSummary.details.length > 0)) {
    scrollArea.appendChild(createSection("WHAT WILL HAPPEN", createTransactionFlow(txSummary, contractAddress)));
  }

  /* ---- 2d. Scam Intelligence ---- */
  if (tokenReports.length > 0) {
    scrollArea.appendChild(createScamIntelligenceSection(tokenReports));
  }

  /* ---- 2e. Technical Details (Collapsed) ---- */
  scrollArea.appendChild(
    createCollapsibleSection(
      "TECHNICAL DETAILS",
      createTechnicalGrid(security, actualAction, functionName, contractAddress, chainId, simulation, intentMatch, selector),
      true,
    ),
  );

  panel.appendChild(scrollArea);

  /* ---- 3. Fixed Footer Actions ---- */
  panel.appendChild(createDecisionFooter(decision, root, onContinue, onCancel));

  root.appendChild(panel);
  document.documentElement.appendChild(root);
}

/* ============================================
   1. Sophisticated Header & Risk Bar
   ============================================ */

function createDecisionHeader(decision, riskLevel, riskScore) {
  const header = document.createElement("div");

  const stateColor =
    decision === "BLOCK" ? UI.block : decision === "REVIEW" ? UI.review : UI.allow;
  const stateTitle =
    decision === "BLOCK"
      ? "Transaction blocked"
      : decision === "REVIEW"
        ? "Review transaction"
        : "Transaction cleared";

  Object.assign(header.style, {
    padding: "22px 24px 18px",
    background: UI.panelBg,
    borderBottom: `1px solid ${UI.border}`,
    flexShrink: "0",
  });

  /* Top metadata row: Brand + Risk Score */
  const topRow = document.createElement("div");
  Object.assign(topRow.style, {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
  });

  const brand = document.createElement("div");
  Object.assign(brand.style, {
    fontSize: "10px",
    fontWeight: "600",
    letterSpacing: "0.12em",
    color: UI.textDim,
    textTransform: "uppercase",
  });
  brand.textContent = "NALAR · TXSENTRY";

  const scoreBox = document.createElement("div");
  Object.assign(scoreBox.style, {
    display: "flex",
    alignItems: "baseline",
    gap: "3px",
  });

  const scoreVal = document.createElement("span");
  Object.assign(scoreVal.style, {
    fontSize: "18px",
    fontWeight: "700",
    fontFamily: UI.monoFamily,
    color: UI.text,
  });
  scoreVal.textContent = String(riskScore);

  const scoreTotal = document.createElement("span");
  Object.assign(scoreTotal.style, {
    fontSize: "11px",
    color: UI.textDim,
    fontFamily: UI.monoFamily,
  });
  scoreTotal.textContent = "/ 100";

  scoreBox.appendChild(scoreVal);
  scoreBox.appendChild(scoreTotal);
  topRow.appendChild(brand);
  topRow.appendChild(scoreBox);
  header.appendChild(topRow);

  /* Main Decision Title + Risk Level */
  const mainRow = document.createElement("div");
  Object.assign(mainRow.style, {
    marginTop: "10px",
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: "12px",
  });

  const titleEl = document.createElement("div");
  Object.assign(titleEl.style, {
    fontSize: "22px",
    fontWeight: "600",
    letterSpacing: "-0.02em",
    color: UI.text,
  });
  titleEl.textContent = stateTitle;

  const riskBadge = document.createElement("div");
  Object.assign(riskBadge.style, {
    fontSize: "11px",
    fontWeight: "600",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: stateColor,
  });
  riskBadge.textContent = `${decision} · ${riskLevel} RISK`;

  mainRow.appendChild(titleEl);
  mainRow.appendChild(riskBadge);
  header.appendChild(mainRow);

  /* Thin semantic accent line */
  const accentLine = document.createElement("div");
  Object.assign(accentLine.style, {
    marginTop: "16px",
    height: "2px",
    width: "100%",
    background: `linear-gradient(90deg, ${stateColor} 0%, ${stateColor} 30%, transparent 100%)`,
    opacity: "0.9",
  });
  header.appendChild(accentLine);

  return header;
}

/* ============================================
   2a. Primary Reason & Editorial Explanation
   ============================================ */

function createReasonSection(decision, explanation, security, tokenReports) {
  const container = document.createElement("div");

  const reasons = collectEditorialReasons(explanation, security, decision);
  const title = decision === "BLOCK" ? "WHY IT WAS STOPPED" : "SECURITY ASSESSMENT";

  // Primary headline explanation
  const headline = document.createElement("div");
  Object.assign(headline.style, {
    fontSize: "15px",
    fontWeight: "600",
    lineHeight: "1.45",
    color: UI.text,
  });
  headline.textContent = reasons[0] || getFallbackExplanation(decision);
  container.appendChild(headline);

  // Secondary context if available
  if (reasons.length > 1) {
    const list = document.createElement("div");
    Object.assign(list.style, {
      marginTop: "10px",
      display: "flex",
      flexDirection: "column",
      gap: "6px",
    });

    for (let i = 1; i < reasons.length; i++) {
      const item = document.createElement("div");
      Object.assign(item.style, {
        fontSize: "13px",
        lineHeight: "1.55",
        color: UI.textSecondary,
      });
      item.textContent = `· ${reasons[i]}`;
      list.appendChild(item);
    }

    container.appendChild(list);
  }

  // Supporting Evidence Table (Structured Security Report)
  const evidenceRows = extractEvidenceRows(tokenReports, security);
  if (evidenceRows.length > 0) {
    const evidenceBox = document.createElement("div");
    Object.assign(evidenceBox.style, {
      marginTop: "16px",
      paddingTop: "12px",
      borderTop: `1px solid ${UI.border}`,
    });

    const evidenceTitle = document.createElement("div");
    Object.assign(evidenceTitle.style, {
      marginBottom: "8px",
      fontSize: "10px",
      fontWeight: "600",
      letterSpacing: "0.08em",
      color: UI.textDim,
      textTransform: "uppercase",
    });
    evidenceTitle.textContent = "EVIDENCE";
    evidenceBox.appendChild(evidenceTitle);

    for (const row of evidenceRows) {
      evidenceBox.appendChild(
        createKvRow(row.label, row.value, {
          mono: true,
          color: row.highlight ? UI.block : UI.textSecondary,
        }),
      );
    }

    container.appendChild(evidenceBox);
  }

  return createSection(title, container);
}

function collectEditorialReasons(explanation, security, decision) {
  const list = [];

  if (typeof explanation?.summary === "string" && explanation.summary.trim()) {
    list.push(formatReason(explanation.summary.trim()));
  }

  if (Array.isArray(explanation?.reasons)) {
    for (const r of explanation.reasons) {
      if (typeof r === "string" && r.trim()) {
        const formatted = formatReason(r);
        if (!list.includes(formatted)) {
          list.push(formatted);
        }
      }
    }
  }

  if (list.length === 0 && Array.isArray(security?.reasons)) {
    for (const r of security.reasons) {
      if (typeof r === "string" && r.trim()) {
        const formatted = formatReason(r);
        if (!list.includes(formatted)) {
          list.push(formatted);
        }
      }
    }
  }

  return list;
}

function extractEvidenceRows(tokenReports, security) {
  const rows = [];

  for (const report of tokenReports) {
    const states = Array.isArray(report?.contractPrivileges?.state)
      ? report.contractPrivileges.state
      : [];

    for (const s of states) {
      const label = humanizeStateCode(s.code);
      let val = s.value ?? s.rawValue ?? "Unknown";

      if (s.unit === "PERCENT") {
        const num = Number(val);
        if (Number.isFinite(num)) {
          val = `${(num / 100).toFixed(2)}%`;
        }
      }

      rows.push({
        label,
        value: String(val),
        highlight: s.code?.includes("TAX") && Number(s.value) > 2000,
      });
    }

    if (report.ownerAddress || report.owner) {
      rows.push({
        label: "Owner",
        value: formatAddress(report.ownerAddress || report.owner),
      });
    }
  }

  if (rows.length === 0 && security?.simulation?.revertReason) {
    rows.push({
      label: "Simulation Revert",
      value: security.simulation.revertReason,
      highlight: true,
    });
  }

  return rows;
}

function getFallbackExplanation(decision) {
  if (decision === "BLOCK") {
    return "On-chain inspection detected critical threat conditions. Execution stopped to protect funds.";
  }
  if (decision === "REVIEW") {
    return "Nalar flagged non-standard contract parameters that warrant verification before continuing.";
  }
  return "Transaction simulation completed with no malicious indicators detected.";
}

/* ============================================
   2b. Intent vs Actual Execution Contrast
   ============================================ */

function createIntentComparisonSection(userIntent, txSummary, actualAction, intentMatch) {
  const container = document.createElement("div");

  // Grid comparison
  const grid = document.createElement("div");
  Object.assign(grid.style, {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  });

  // User request
  const requestRow = document.createElement("div");
  const requestLabel = document.createElement("div");
  Object.assign(requestLabel.style, {
    fontSize: "10px",
    fontWeight: "600",
    letterSpacing: "0.08em",
    color: UI.textDim,
    textTransform: "uppercase",
    marginBottom: "3px",
  });
  requestLabel.textContent = "YOUR REQUEST";

  const requestVal = document.createElement("div");
  Object.assign(requestVal.style, {
    fontSize: "13px",
    color: UI.text,
    lineHeight: "1.5",
  });
  requestVal.textContent = userIntent || "Not explicitly declared.";
  requestRow.appendChild(requestLabel);
  requestRow.appendChild(requestVal);
  grid.appendChild(requestRow);

  // Actual transaction effect
  const actualRow = document.createElement("div");
  const actualLabel = document.createElement("div");
  Object.assign(actualLabel.style, {
    fontSize: "10px",
    fontWeight: "600",
    letterSpacing: "0.08em",
    color: UI.textDim,
    textTransform: "uppercase",
    marginBottom: "3px",
  });
  actualLabel.textContent = "ACTUAL TRANSACTION";

  const actualVal = document.createElement("div");
  Object.assign(actualVal.style, {
    fontSize: "13px",
    color: UI.textSecondary,
    lineHeight: "1.5",
  });
  actualVal.textContent = txSummary.description || humanizeAction(actualAction);
  actualRow.appendChild(actualLabel);
  actualRow.appendChild(actualVal);
  grid.appendChild(actualRow);

  // Match indicator
  if (typeof intentMatch === "boolean") {
    const matchRow = document.createElement("div");
    Object.assign(matchRow.style, {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      paddingTop: "8px",
      borderTop: `1px solid ${UI.borderMuted}`,
    });

    const matchKey = document.createElement("span");
    Object.assign(matchKey.style, {
      fontSize: "10px",
      fontWeight: "600",
      letterSpacing: "0.08em",
      color: UI.textDim,
      textTransform: "uppercase",
    });
    matchKey.textContent = "INTENT MATCH";

    const matchVal = document.createElement("span");
    Object.assign(matchVal.style, {
      fontSize: "11px",
      fontWeight: "600",
      letterSpacing: "0.06em",
      color: intentMatch ? UI.allow : UI.block,
    });
    matchVal.textContent = intentMatch ? "MATCHED" : "MISMATCH DETECTED";

    matchRow.appendChild(matchKey);
    matchRow.appendChild(matchVal);
    grid.appendChild(matchRow);
  }

  container.appendChild(grid);
  return createSection("EXECUTION VERIFICATION", container);
}

/* ============================================
   2c. Semantic Transaction Summary & Flow
   ============================================ */

function createTransactionFlow(summary, contractAddress) {
  const container = document.createElement("div");

  const details = Array.isArray(summary.details) ? summary.details : [];

  if (details.length > 0) {
    const flowList = document.createElement("div");
    Object.assign(flowList.style, {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      padding: "8px 0",
    });

    for (const detail of details) {
      const item = document.createElement("div");
      Object.assign(item.style, {
        fontSize: "13px",
        color: UI.textSecondary,
        fontFamily: detail.includes("0x") ? UI.monoFamily : UI.fontFamily,
      });
      item.textContent = detail;
      flowList.appendChild(item);
    }

    container.appendChild(flowList);
  }

  if (contractAddress) {
    const contractRow = createKvRow("Target Contract", formatAddress(contractAddress), {
      mono: true,
    });
    container.appendChild(contractRow);
  }

  return container;
}

/* ============================================
   2d. Scam Intelligence Section
   ============================================ */

function createScamIntelligenceSection(tokenReports) {
  const container = document.createElement("div");
  Object.assign(container.style, {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  });

  for (const report of tokenReports) {
    const block = document.createElement("div");
    Object.assign(block.style, {
      display: "flex",
      flexDirection: "column",
      gap: "8px",
    });

    // Token & Risk Row
    const headerRow = document.createElement("div");
    Object.assign(headerRow.style, {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: "12px",
    });

    const tokenName = document.createElement("span");
    Object.assign(tokenName.style, {
      fontSize: "14px",
      fontWeight: "600",
      color: UI.text,
    });
    tokenName.textContent =
      report.tokenName || report.name || formatAddress(report.token || report.tokenAddress);

    const level = String(report.riskLevel || "UNKNOWN").toUpperCase();
    const score = safeNumber(report.riskScore);
    const scoreColor =
      level === "CRITICAL" || level === "HIGH"
        ? UI.block
        : level === "MEDIUM"
          ? UI.review
          : UI.allow;

    const riskBadge = document.createElement("span");
    Object.assign(riskBadge.style, {
      fontSize: "11px",
      fontWeight: "600",
      fontFamily: UI.monoFamily,
      color: scoreColor,
    });
    riskBadge.textContent = `${level} · ${score}`;

    headerRow.appendChild(tokenName);
    headerRow.appendChild(riskBadge);
    block.appendChild(headerRow);

    // Findings
    const findings = Array.isArray(report.findings) ? report.findings : [];
    for (const f of findings) {
      const findingEl = document.createElement("div");
      Object.assign(findingEl.style, {
        fontSize: "12px",
        color: UI.textSecondary,
        lineHeight: "1.5",
      });
      findingEl.textContent = `· ${f.title || f.description || "Security condition detected."}`;
      block.appendChild(findingEl);
    }

    // Intelligence badges
    const badgesRow = document.createElement("div");
    Object.assign(badgesRow.style, {
      display: "flex",
      gap: "6px",
      marginTop: "4px",
    });

    badgesRow.appendChild(createBadge("BNB INTELLIGENCE", { color: UI.textDim, bg: UI.bg1 }));
    badgesRow.appendChild(createBadge("ON-CHAIN EVIDENCE", { color: UI.textSecondary, bg: UI.bg2 }));
    block.appendChild(badgesRow);

    container.appendChild(block);
  }

  return createSection("SCAM INTELLIGENCE", container);
}

/* ============================================
   2e. Technical Details Grid
   ============================================ */

function createTechnicalGrid(security, action, functionName, contractAddress, chainId, simulation, intentMatch, selector) {
  const container = document.createElement("div");
  Object.assign(container.style, {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    paddingTop: "4px",
  });

  if (chainId) {
    container.appendChild(createKvRow("Chain", String(chainId), { mono: true }));
  }

  if (contractAddress) {
    container.appendChild(createKvRow("Contract", contractAddress, { mono: true }));
  }

  container.appendChild(createKvRow("Action", humanizeAction(action)));

  if (functionName) {
    container.appendChild(createKvRow("Function", functionName, { mono: true }));
  }

  if (selector) {
    container.appendChild(createKvRow("Selector", selector, { mono: true }));
  }

  const simStatus = simulation?.status || (simulation?.success === true ? "SUCCESS" : simulation?.success === false ? "REVERTED" : null);
  if (simStatus) {
    container.appendChild(
      createKvRow("Simulation", String(simStatus).toUpperCase(), {
        mono: true,
        color: simStatus === "SUCCESS" ? UI.allow : UI.block,
      }),
    );
  }

  if (typeof intentMatch === "boolean") {
    container.appendChild(
      createKvRow("Intent Match", intentMatch ? "MATCHED" : "MISMATCH", {
        mono: true,
        color: intentMatch ? UI.allow : UI.block,
      }),
    );
  }

  return container;
}

/* ============================================
   3. Fixed Footer Actions
   ============================================ */

function createDecisionFooter(decision, root, onContinue, onCancel) {
  const footer = document.createElement("div");

  Object.assign(footer.style, {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "16px 24px",
    background: UI.panelBg,
    borderTop: `1px solid ${UI.border}`,
    flexShrink: "0",
  });

  const note = document.createElement("div");
  Object.assign(note.style, {
    fontSize: "11px",
    color: UI.textDim,
    lineHeight: "1.4",
  });

  if (decision === "BLOCK") {
    note.textContent = "Transaction was not forwarded to your wallet.";

    const closeBtn = createButton("Close", "primary");
    closeBtn.addEventListener("click", () => {
      root.remove();
      if (onCancel) onCancel("[Nalar] Transaction blocked.");
    });

    footer.appendChild(note);
    footer.appendChild(closeBtn);
  } else if (decision === "REVIEW") {
    note.textContent = "Verification required before proceeding.";

    const actions = document.createElement("div");
    Object.assign(actions.style, { display: "flex", gap: "8px" });

    const cancelBtn = createButton("Cancel", "secondary");
    const continueBtn = createButton("Review & Continue", "primary");

    cancelBtn.addEventListener("click", () => {
      root.remove();
      if (onCancel) onCancel("[Nalar] Transaction cancelled.");
    });

    continueBtn.addEventListener("click", () => {
      root.remove();
      if (onContinue) onContinue();
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(continueBtn);

    footer.appendChild(note);
    footer.appendChild(actions);
  } else {
    note.textContent = "Cleared for wallet execution.";

    const actions = document.createElement("div");
    Object.assign(actions.style, { display: "flex", gap: "8px" });

    const cancelBtn = createButton("Cancel", "secondary");
    const continueBtn = createButton("Continue", "primary");

    cancelBtn.addEventListener("click", () => {
      root.remove();
      if (onCancel) onCancel("[Nalar] Transaction cancelled.");
    });

    continueBtn.addEventListener("click", () => {
      root.remove();
      if (onContinue) onContinue();
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(continueBtn);

    footer.appendChild(note);
    footer.appendChild(actions);
  }

  return footer;
}
