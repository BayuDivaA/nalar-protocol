import { ai } from "../lib/ai-config";
import { env } from "../config/env";
import { securityExplanationSchema, type SecurityExplanation, type SecurityEvidenceItem } from "../types/explanation";
import { parseAIJson } from "../lib/parse-ai-json";
import type { IntentComparison } from "./intent-comparator";

export interface GenerateExplanationInput {
  intent: string;
  decision: "ALLOW" | "REVIEW" | "BLOCK";
  riskLevel: string;
  riskScore: number;
  intentMatch: boolean;
  actualAction: string;
  actualFunction: string | null;
  reasons: string[];
  actualValueNative: string;
  effects: unknown;
  comparison: IntentComparison;
  policy: {
    allowed: boolean;
    requiresReview: boolean;
    reasons: string[];
  };
  normalizedIntent?: {
    action?: string;
    quantity?: number | null;
    tokenIn?: string | null;
    tokenOut?: string | null;
    description?: string;
  };
  transactionSummary?: {
    title?: string;
    action?: string;
    valueNative?: string | null;
    target?: string | null;
    description?: string;
    details?: string[];
    summary?: string;
    protocol?: string | null;
    input?: {
      amount?: string | null;
      symbol?: string | null;
      address?: string | null;
    } | null;
    output?: {
      amount?: string | null;
      symbol?: string | null;
      address?: string | null;
    } | null;
  };
  simulation?: {
    success: boolean;
    gasEstimate?: string | null;
    error?: string | null;
  };
  scamAnalyses?: Array<{
    token?: string;
    riskScore?: number;
    riskLevel?: string;
    findings?: Array<{ code?: string; title?: string; severity?: string; description?: string }>;
    contractPrivileges?: {
      state?: Array<{ code?: string; label?: string; value?: string | number; unit?: string }>;
      accessControl?: Array<{ role?: string; holder?: string; capability?: string }>;
    };
  }>;
  transactionThreats?: Array<{
    code?: string;
    severity?: string;
    title?: string;
    description?: string;
    evidence?: string;
    source?: string;
  }>;
}

export interface HumanizedFinding {
  headline: string;
  fact: string;
  meaning: string;
  impact: string;
}

/**
 * Translates low-level technical finding codes into human-readable facts,
 * real-world meanings, and user impact.
 */
export function humanizeFinding(code: string, metadata?: Record<string, any>): HumanizedFinding {
  switch (code) {
    case "EXCESSIVE_SELL_TAX": {
      const taxStr = metadata?.sellTaxPercent !== undefined && metadata?.sellTaxPercent !== null ? `${Number(metadata.sellTaxPercent).toFixed(0)}%` : "an unusually high";
      return {
        headline: metadata?.sellTaxPercent !== undefined ? `An unusually high sell fee was found (${taxStr})` : "An unusually high sell fee was found",
        fact: metadata?.sellTaxPercent !== undefined ? `The token contract reports a configured ${taxStr} sell tax.` : "The token contract reports an unusually high sell tax.",
        meaning: "This is an unusually large fee applied to selling.",
        impact: "If enforced during a sale, you could receive substantially less than expected.",
      };
    }

    case "OWNER_CONTROLLED_EXCESSIVE_SELL_TAX":
    case "OWNER_CONTROLLED_TAX":
    case "OWNER_MODIFIABLE_TAX": {
      return {
        headline: "The contract owner can control the sell fee",
        fact: "The contract allows an owner or administrator to adjust transfer or sell fees.",
        meaning: "The sell fee could change or be set to a high percentage by the contract owner.",
        impact: "If the owner changes the fee later, selling your tokens could become costly or impossible.",
      };
    }

    case "UNVERIFIED_CONTRACT": {
      return {
        headline: "The contract could not be fully verified",
        fact: "The contract source is not verified.",
        meaning: "Nalar has less publicly verifiable information available to inspect.",
        impact: "This makes it harder to independently confirm how the contract behaves.",
      };
    }

    case "SELL_SIMULATION_UNAVAILABLE": {
      return {
        headline: "Nalar could not verify the sell path",
        fact: "The sell simulation could not be completed.",
        meaning: "Nalar could not independently test what would happen during a sale.",
        impact: "You have less evidence about whether the token can be sold as expected.",
      };
    }

    case "UNLIMITED_ALLOWANCE": {
      return {
        headline: "This transaction gives broad spending permission",
        fact: "The approval is not limited to a specific token amount.",
        meaning: "The spender may be able to use that permission more broadly than a limited approval.",
        impact: "If the spender is unsafe or compromised, this permission could put your tokens at risk.",
      };
    }

    case "UNEXPECTED_SPENDER": {
      const spender = metadata?.spender ? ` (${metadata.spender})` : "";
      return {
        headline: "The spender address is unfamiliar",
        fact: `The contract requesting spending permission${spender} is not recognized as a known exchange or protocol router.`,
        meaning: "An unfamiliar contract is asking for permission to access your tokens.",
        impact: "If this contract is untrusted or malicious, it could transfer approved tokens without your direct confirmation.",
      };
    }

    case "UNEXPECTED_NFT_OPERATOR": {
      return {
        headline: "This transaction gives control over your NFTs",
        fact: "The transaction grants operator rights over your NFT collection.",
        meaning: "The designated operator would be able to transfer or manage NFTs on your behalf.",
        impact: "If the operator is malicious, they could transfer your NFTs without further approval.",
      };
    }

    case "CONTRACT_TARGET_IS_EOA": {
      return {
        headline: "Target is a personal wallet",
        fact: "The destination address is an externally owned account (EOA), not a smart contract.",
        meaning: "Funds sent will go directly to an individual's private wallet with no automated contract safeguards.",
        impact: "You are sending assets directly to a personal wallet rather than interacting with a verified decentralized application.",
      };
    }

    case "SIMULATION_FAILED":
    case "SIMULATION_REVERT": {
      const err = metadata?.error ? ` (reverted with ${metadata.error})` : "";
      return {
        headline: "The transaction simulation failed",
        fact: `The blockchain node rejected this transaction during test execution${err}.`,
        meaning: "The transaction would likely revert or fail if submitted to the network in its current state.",
        impact: "Submitting this transaction will forfeit network gas fees without completing your intended action.",
      };
    }

    case "HONEYPOT_DETECTED":
    case "FAILED_SELL_SIMULATION": {
      return {
        headline: "Tokens may not be sellable",
        fact: "An attempted sell simulation reverted on-chain.",
        meaning: "The token contract blocked selling during automated testing.",
        impact: "If you purchase these tokens, you may be unable to sell them back for other assets.",
      };
    }

    case "INTENT_MISMATCH": {
      return {
        headline: "This transaction does something different from what you asked for",
        fact: metadata?.detail || "The on-chain transaction parameters differ from what you asked to do.",
        meaning: "The transaction will execute different actions, tokens, or amounts than you intended.",
        impact: "Continuing could cause you to complete an unintended transaction or lose assets.",
      };
    }

    default: {
      const title = metadata?.title || code.replace(/_/g, " ").toLowerCase();
      const desc = metadata?.description || `Security signal detected: ${code}.`;
      return {
        headline: "This transaction needs your attention",
        fact: desc,
        meaning: `Nalar identified a security condition (${title}) that requires verification.`,
        impact: "Review the transaction details in your wallet before confirming.",
      };
    }
  }
}

export interface HumanExplanationContext {
  decision: "ALLOW" | "REVIEW" | "BLOCK";
  riskLevel: string;
  riskScore: number;
  userIntent: {
    raw: string;
    action: string;
    quantity: number | null;
    tokenIn: string | null;
    tokenOut: string | null;
    description: string;
  };
  actualTransaction: {
    action: string;
    functionName: string | null;
    valueNative: string;
    target: string | null;
    summary: string;
    protocol: string | null;
    input: { amount?: string | null; symbol?: string | null; address?: string | null } | null;
    output: { amount?: string | null; symbol?: string | null; address?: string | null } | null;
  };
  intentComparison: {
    matches: boolean;
    overall: "MATCH" | "MISMATCH" | "UNCERTAIN";
    mismatches: string[];
    action: { status: string; expected?: string; actual?: string };
    inputToken: { status: string; expected?: string; actual?: string };
    outputToken: { status: string; expected?: string; actual?: string };
    amount: { status: string; expected?: string | number; actual?: string | number };
    recipient: { status: string; expected?: string; actual?: string };
    summary: string;
  };
  simulation: {
    success: boolean;
    gasEstimate: string | null;
    error: string | null;
  };
  securityFindings: Array<{
    code: string;
    severity?: string;
    title?: string;
    humanized: HumanizedFinding;
  }>;
  contractState: {
    sellTaxPercent: number | null;
    hasOwnerControl: boolean;
  };
  policyResult: {
    allowed: boolean;
    requiresReview: boolean;
    reasons: string[];
  };
  transactionThreats: Array<{
    code: string;
    severity?: string;
    title?: string;
    humanized: HumanizedFinding;
  }>;
}

/**
 * Extracts and synthesizes verified transaction facts, intent comparisons,
 * simulation findings, and threat signals into a clean human explanation context.
 */
export function buildHumanExplanationContext(input: GenerateExplanationInput): HumanExplanationContext {
  let sellTaxPercent: number | null = null;
  let hasOwnerControl = false;

  const securityFindings: Array<{
    code: string;
    severity?: string;
    title?: string;
    humanized: HumanizedFinding;
  }> = [];

  if (Array.isArray(input.scamAnalyses)) {
    for (const report of input.scamAnalyses) {
      const state = report.contractPrivileges?.state ?? [];
      for (const item of state) {
        if (item.code === "CURRENT_SELL_TAX") {
          const num = Number(item.value);
          if (Number.isFinite(num)) {
            sellTaxPercent = num > 100 ? num / 100 : num;
          }
        }
      }
      const findings = report.findings ?? [];
      for (const f of findings) {
        if (f.code) {
          if (f.code.includes("OWNER_CONTROLLED")) {
            hasOwnerControl = true;
          }
          securityFindings.push({
            code: f.code,
            severity: f.severity,
            title: f.title,
            humanized: humanizeFinding(f.code, { ...f, sellTaxPercent }),
          });
        }
      }
    }
  }

  const transactionThreats: Array<{
    code: string;
    severity?: string;
    title?: string;
    humanized: HumanizedFinding;
  }> = [];

  if (Array.isArray(input.transactionThreats)) {
    for (const t of input.transactionThreats) {
      if (t.code) {
        transactionThreats.push({
          code: t.code,
          severity: t.severity,
          title: t.title,
          humanized: humanizeFinding(t.code, { ...t, sellTaxPercent }),
        });
      }
    }
  }

  if (input.simulation && !input.simulation.success) {
    securityFindings.unshift({
      code: "SIMULATION_FAILED",
      severity: "CRITICAL",
      title: "Transaction simulation reverted",
      humanized: humanizeFinding("SIMULATION_FAILED", { error: input.simulation.error }),
    });
  }

  const actualSummary = humanizeActualTransactionSummary(input);

  return {
    decision: input.decision,
    riskLevel: input.riskLevel,
    riskScore: input.riskScore,
    userIntent: {
      raw: input.intent,
      action: input.normalizedIntent?.action || "UNKNOWN",
      quantity: input.normalizedIntent?.quantity ?? null,
      tokenIn: input.normalizedIntent?.tokenIn ?? null,
      tokenOut: input.normalizedIntent?.tokenOut ?? null,
      description: input.normalizedIntent?.description || input.intent,
    },
    actualTransaction: {
      action: input.transactionSummary?.action || input.actualAction,
      functionName: input.actualFunction,
      valueNative: input.actualValueNative,
      target: input.transactionSummary?.target ?? null,
      summary: actualSummary,
      protocol: input.transactionSummary?.protocol ?? null,
      input: input.transactionSummary?.input ?? null,
      output: input.transactionSummary?.output ?? null,
    },
    intentComparison: {
      matches: input.comparison.matches,
      overall: input.comparison.overall,
      mismatches: input.comparison.mismatches || [],
      action: {
        status: input.comparison.action?.status || "UNSPECIFIED",
        expected: input.comparison.action?.expected,
        actual: input.comparison.action?.actual,
      },
      inputToken: {
        status: input.comparison.inputToken?.status || "UNSPECIFIED",
        expected: input.comparison.inputToken?.expected,
        actual: input.comparison.inputToken?.actual,
      },
      outputToken: {
        status: input.comparison.outputToken?.status || "UNSPECIFIED",
        expected: input.comparison.outputToken?.expected,
        actual: input.comparison.outputToken?.actual,
      },
      amount: {
        status: input.comparison.amount?.status || "UNSPECIFIED",
        expected: input.comparison.amount?.expected,
        actual: input.comparison.amount?.actual,
      },
      recipient: {
        status: input.comparison.recipient?.status || "UNSPECIFIED",
        expected: input.comparison.recipient?.expected,
        actual: input.comparison.recipient?.actual,
      },
      summary: input.comparison.summary,
    },
    simulation: {
      success: input.simulation ? input.simulation.success : true,
      gasEstimate: input.simulation?.gasEstimate ?? null,
      error: input.simulation?.error ?? null,
    },
    securityFindings,
    contractState: {
      sellTaxPercent,
      hasOwnerControl,
    },
    policyResult: {
      allowed: input.policy.allowed,
      requiresReview: input.policy.requiresReview,
      reasons: input.policy.reasons,
    },
    transactionThreats,
  };
}

/**
 * Produces a clear, plain-English summary of what the transaction actually does.
 * Never falls back to generic "Swap tokens" when structured transaction data exists.
 */
function humanizeActualTransactionSummary(input: GenerateExplanationInput): string {
  const ts = input.transactionSummary;

  if (ts?.summary && !ts.summary.toLowerCase().includes("swap tokens")) {
    return ts.summary;
  }

  const action = ts?.action || input.actualAction;

  if (action === "TOKEN_APPROVAL") {
    const symbol = ts?.input?.symbol || "tokens";
    const hasUnlimited = input.transactionThreats?.some((t) => t.code === "UNLIMITED_ALLOWANCE");
    if (hasUnlimited) {
      return `Allow this contract to spend your ${symbol} without a fixed spending limit.`;
    }
    if (ts?.input?.amount) {
      return `Allow this contract to spend ${ts.input.amount} ${symbol}.`;
    }
    return `Allow this contract to spend your ${symbol}.`;
  }

  if (action === "TRANSFER") {
    const amount = ts?.input?.amount || input.actualValueNative;
    const symbol = ts?.input?.symbol || (input.actualValueNative.includes("BNB") ? "BNB" : "tokens");
    const target = ts?.target || "recipient";
    const targetDisplay = target.length > 12 ? `${target.slice(0, 6)}...${target.slice(-4)}` : target;
    return `Send ${amount} to ${targetDisplay}.`;
  }

  if (action === "SWAP") {
    const inAmt = ts?.input?.amount ? `${ts.input.amount} ` : "";
    const inSym = ts?.input?.symbol || (input.actualValueNative ? input.actualValueNative : "tBNB");
    const outAmt = ts?.output?.amount ? `${ts.output.amount} ` : "";
    const outSym = ts?.output?.symbol || "tokens";
    const protocol = ts?.protocol ? ` through ${ts.protocol}` : "";
    if (outSym !== "tokens" || inSym !== "tokens") {
      return `Swap ${inAmt}${inSym} for ${outAmt}${outSym}${protocol}.`.replace(/\s+/g, " ");
    }
  }

  if (ts?.description && !ts.description.toLowerCase().includes("swap tokens")) {
    return ts.description;
  }

  return ts?.title || input.actualAction;
}

/**
 * Deterministically constructs a rich, human-first structured explanation.
 * Adheres strictly to antislop rules: no buzzwords, fact/meaning/impact hierarchy,
 * and conditional language for unproven loss outcomes.
 */
export function buildDeterministicExplanation(input: GenerateExplanationInput): SecurityExplanation {
  const context = buildHumanExplanationContext(input);
  const isBlock = input.decision === "BLOCK";
  const isReview = input.decision === "REVIEW";

  const findingCodeSet = new Set(context.securityFindings.map((f) => f.code));
  const threatCodeSet = new Set(context.transactionThreats.map((t) => t.code));

  const isSimFailed = !context.simulation.success;
  const isMismatch = !input.intentMatch || context.intentComparison.overall === "MISMATCH" || context.intentComparison.matches === false;
  const isUncertain = context.intentComparison.overall === "UNCERTAIN";

  const compOverall: "MATCH" | "MISMATCH" | "UNKNOWN" =
    context.intentComparison.overall === "MATCH" || (input.intentMatch && context.intentComparison.matches !== false && !isUncertain && !isMismatch) ? "MATCH" : isMismatch ? "MISMATCH" : "UNKNOWN";

  // 1. Headlines (humanized decision headlines)
  let headline = isBlock ? "The transaction was stopped" : isReview ? "This transaction needs your attention" : "The transaction passed Nalar's checks";
  const whyTitle = isBlock ? "Why Nalar stopped this transaction" : isReview ? "Why Nalar recommends review" : "Transaction verified";

  let primaryReason = input.reasons.length > 0 ? input.reasons[0]! : "Security evaluation completed.";
  let userImpact = "Nalar evaluated the transaction against deterministic safety rules.";
  let whatThisMeans = "Nalar verified that the on-chain parameters adhere to your intent and security policy.";
  let summaryText = primaryReason;

  // A. Excessive Sell Tax Case
  if (context.contractState.sellTaxPercent !== null && context.contractState.sellTaxPercent >= 20) {
    const taxNum = context.contractState.sellTaxPercent.toFixed(0);
    const h = humanizeFinding("EXCESSIVE_SELL_TAX", { sellTaxPercent: context.contractState.sellTaxPercent });
    headline = `An unusually high sell fee was found (${taxNum}%)`;
    summaryText = h.fact;
    primaryReason = h.fact;
    userImpact = "The contract is configured to take an unusually large portion from a sale. If enforced during a sale, you could receive substantially less than expected.";
    whatThisMeans = "This is an unusually large fee applied to selling. Even if buying succeeds, selling later could result in receiving significantly less or being unable to exit your position.";
  }
  // B. Unlimited Allowance
  else if (threatCodeSet.has("UNLIMITED_ALLOWANCE")) {
    const h = humanizeFinding("UNLIMITED_ALLOWANCE");
    headline = h.headline;
    summaryText = h.fact;
    primaryReason = "This transaction grants permission to spend your tokens without a fixed limit.";
    userImpact = h.impact;
    whatThisMeans = "You are giving this contract permission to spend your tokens without a small spending limit. If the contract is vulnerable or malicious, your balance could be drained.";
  }
  // C. NFT Operator Approval
  else if (threatCodeSet.has("UNEXPECTED_NFT_OPERATOR")) {
    const h = humanizeFinding("UNEXPECTED_NFT_OPERATOR");
    headline = h.headline;
    summaryText = h.fact;
    primaryReason = h.fact;
    userImpact = h.impact;
    whatThisMeans = h.meaning;
  }
  // D. Simulation Failure
  else if (isSimFailed) {
    const h = humanizeFinding("SIMULATION_FAILED", { error: context.simulation.error });
    headline = h.headline;
    summaryText = h.fact;
    primaryReason = "The blockchain node rejected this transaction during test execution and it would revert.";
    userImpact = h.impact;
    whatThisMeans = "The smart contract rejected the transaction during on-chain simulation. The transaction cannot succeed in its current state.";
  }
  // E. Intent Mismatch Case
  else if (isMismatch) {
    headline = "This transaction does something different from what you asked for";
    summaryText = "This transaction does something different from what you asked for.";

    if (context.intentComparison.outputToken.status === "MISMATCH") {
      const spendPart = context.userIntent.quantity && context.userIntent.tokenIn ? `use ${context.userIntent.quantity} ${context.userIntent.tokenIn} to ` : context.userIntent.quantity ? `use ${context.userIntent.quantity} to ` : "";
      const expectedOut = context.intentComparison.outputToken.expected || context.userIntent.tokenOut || "the requested token";
      const actualOut = context.intentComparison.outputToken.actual || context.actualTransaction.output?.symbol || "another token";

      primaryReason = `You asked to ${spendPart}buy ${expectedOut}, but the transaction is configured to receive ${actualOut}.`;
      userImpact = "Continuing could cause you to complete a different swap from the one you intended.";
      whatThisMeans = `Nalar stopped this because the transaction will deliver ${actualOut} instead of the ${expectedOut} you asked to purchase.`;
    } else if (context.intentComparison.inputToken.status === "MISMATCH") {
      const expectedIn = context.intentComparison.inputToken.expected || context.userIntent.tokenIn || "the requested token";
      const actualIn = context.intentComparison.inputToken.actual || "another token";

      primaryReason = `You asked to spend ${expectedIn}, but the transaction is configured to spend ${actualIn}.`;
      userImpact = `Continuing would spend ${actualIn} instead of your intended ${expectedIn}.`;
      whatThisMeans = `Nalar stopped this because the transaction will spend ${actualIn} instead of the ${expectedIn} you intended to spend.`;
    } else if (context.intentComparison.amount.status === "MISMATCH") {
      const expectedAmt = context.intentComparison.amount.expected;
      const actualAmt = context.intentComparison.amount.actual;

      primaryReason = `You asked to transact ${expectedAmt}, but the transaction is configured for ${actualAmt}.`;
      userImpact = `Continuing would transact ${actualAmt} instead of your intended amount of ${expectedAmt}.`;
      whatThisMeans = `Nalar stopped this because the transaction amount (${actualAmt}) does not match what you asked to transact (${expectedAmt}).`;
    } else {
      primaryReason = context.intentComparison.summary || (context.intentComparison.mismatches[0] ?? "The transaction differs from your requested action.");
      userImpact = "Continuing could execute an action or transfer that differs from what you intended.";
      whatThisMeans = "Nalar found differences between your requested intent and what the blockchain transaction actually does.";
    }
  }
  // F. Owner Controlled Tax
  else if (findingCodeSet.has("OWNER_CONTROLLED_EXCESSIVE_SELL_TAX") || findingCodeSet.has("OWNER_CONTROLLED_TAX") || context.contractState.hasOwnerControl) {
    const h = humanizeFinding("OWNER_CONTROLLED_TAX");
    headline = h.headline;
    summaryText = h.fact;
    primaryReason = h.fact;
    userImpact = h.impact;
    whatThisMeans = h.meaning;
  }
  // G. Unverified Contract (Review)
  else if (findingCodeSet.has("UNVERIFIED_CONTRACT")) {
    const h = humanizeFinding("UNVERIFIED_CONTRACT");
    headline = h.headline;
    summaryText = h.fact;
    primaryReason = "The contract source is not verified on the block explorer.";
    userImpact = h.impact;
    whatThisMeans = "Nalar could not independently verify the contract's published source code, so there is less publicly verifiable information available to inspect.";
  }
  // H. Sell Simulation Unavailable (Review)
  else if (findingCodeSet.has("SELL_SIMULATION_UNAVAILABLE")) {
    const h = humanizeFinding("SELL_SIMULATION_UNAVAILABLE");
    headline = h.headline;
    summaryText = h.fact;
    primaryReason = "The sell simulation could not be completed on-chain.";
    userImpact = h.impact;
    whatThisMeans = "Nalar could not independently test what would happen during a sale. While buying may work, the ability to sell has not been proven by on-chain simulation.";
  }
  // I. Personal Wallet / EOA Target
  else if (findingCodeSet.has("CONTRACT_TARGET_IS_EOA")) {
    const h = humanizeFinding("CONTRACT_TARGET_IS_EOA");
    headline = h.headline;
    summaryText = h.fact;
    primaryReason = h.fact;
    userImpact = h.impact;
    whatThisMeans = h.meaning;
  }
  // J. Uncertain Intent
  else if (isUncertain) {
    headline = "Intent could not be verified";
    summaryText = "Could not clearly verify your intent from the provided description.";
    primaryReason = summaryText;
    userImpact = "Please verify the contract address, token symbols, and amounts in your wallet before confirming.";
    whatThisMeans = "Nalar was unable to extract specific token and amount targets from your intent description to confirm a match.";
  }
  // K. Policy Restriction
  else if (context.policyResult.reasons.length > 0) {
    headline = isBlock ? "The transaction was stopped" : "This transaction needs your attention";
    summaryText = context.policyResult.reasons[0]!;
    primaryReason = summaryText;
    userImpact = "The requested interaction asks for permissions or actions that exceed your configured security policy.";
    whatThisMeans = "Nalar stopped this because the transaction asks for a permission or action you did not request.";
  }
  // L. Allow / Safe Cleared
  else if (!isBlock && !isReview) {
    headline = "The transaction passed Nalar's checks";
    summaryText = "The transaction matches what you asked to do and passed all automated checks.";
    primaryReason = summaryText;
    userImpact = "No high-risk patterns or policy violations were detected on BNB Chain.";
    whatThisMeans = "Nalar verified that the on-chain execution path matches your intent with no hidden allowances or dangerous contract configurations.";
  }

  // 2. User Intent Breakdown
  const intentInputToken = context.userIntent.tokenIn || (input.actualValueNative ? `${input.actualValueNative}` : undefined);
  const intentOutputToken = context.userIntent.tokenOut || undefined;

  const userIntent = {
    summary: context.userIntent.description,
    action: context.userIntent.action,
    input: intentInputToken,
    expectedOutput: intentOutputToken,
    status: compOverall,
  };

  // 3. Actual Transaction Breakdown
  const actualInputDisplay = context.actualTransaction.input?.amount ? `${context.actualTransaction.input.amount} ${context.actualTransaction.input.symbol ?? ""}`.trim() : input.actualValueNative;
  const actualOutputDisplay = context.actualTransaction.output?.amount ? `${context.actualTransaction.output.amount} ${context.actualTransaction.output.symbol ?? ""}`.trim() : (context.actualTransaction.output?.symbol ?? undefined);

  const actualTransaction = {
    summary: context.actualTransaction.summary,
    action: context.actualTransaction.action,
    input: actualInputDisplay,
    output: actualOutputDisplay,
    target: context.actualTransaction.target ?? undefined,
  };

  // 4. Comparison Summary
  let compSummary = context.intentComparison.summary;
  if (!compSummary || compOverall === "MATCH") {
    if (compOverall === "MATCH" && isBlock) {
      compSummary = "The transaction matches your request, but Nalar blocked it because the target token was found to have a critical security risk.";
    } else if (compOverall === "MATCH") {
      compSummary = "The transaction matches what you asked to do.";
    } else {
      compSummary = primaryReason;
    }
  } else if (isMismatch && context.intentComparison.outputToken.status === "MISMATCH") {
    compSummary = primaryReason;
  }

  const comparison = {
    status: compOverall,
    summary: compSummary,
    details: context.intentComparison.mismatches.length > 0 ? context.intentComparison.mismatches : [primaryReason],
  };

  // 5. Evidence List
  const evidence: SecurityEvidenceItem[] = [];

  if (context.contractState.sellTaxPercent !== null) {
    evidence.push({
      label: "Sell tax",
      value: `${context.contractState.sellTaxPercent.toFixed(0)}%`,
      explanation: `The token contract reports a configured ${context.contractState.sellTaxPercent.toFixed(0)}% sell tax.`,
      source: "ON-CHAIN",
    });
  }

  if (context.contractState.hasOwnerControl) {
    evidence.push({
      label: "Owner control",
      value: "Detected",
      explanation: "The contract allows an owner or administrator to adjust transfer or sell fees.",
      source: "ON-CHAIN",
    });
  }

  if (input.simulation) {
    evidence.push({
      label: "Simulation",
      value: input.simulation.success ? "Passed" : "Reverted",
      explanation: input.simulation.success ? `Simulation completed with gas estimate ${input.simulation.gasEstimate ?? "unknown"}.` : `Execution reverted on-chain: ${input.simulation.error ?? "0x"}.`,
      source: "SIMULATION",
    });
  }

  evidence.push({
    label: "Intent check",
    value: compOverall === "MATCH" ? "Matched" : compOverall === "MISMATCH" ? "Mismatch" : "Uncertain",
    explanation: compSummary,
    source: "INTENT",
  });

  if (context.policyResult.reasons.length > 0) {
    evidence.push({
      label: "Policy evaluation",
      value: context.policyResult.allowed ? "Allowed" : "Forbidden",
      explanation: context.policyResult.reasons[0]!,
      source: "POLICY",
    });
  }

  return {
    title: isBlock ? "Transaction Blocked" : isReview ? "Review Required" : "Transaction Verified",
    headline,
    summary: summaryText,
    details: input.reasons.length > 0 ? input.reasons : [primaryReason],
    recommendedAction: isBlock ? "CANCEL" : isReview ? "REVIEW" : "PROCEED",
    whyStopped: {
      title: whyTitle,
      primaryReason,
      userImpact,
    },
    whatThisMeans,
    userIntent,
    actualTransaction,
    comparison,
    evidence,
    meta: {
      generator: "DETERMINISTIC",
      provider: env.AI_PROVIDER,
      model: env.AI_MODEL,
    },
  };
}

export async function generateSecurityExplanation(input: GenerateExplanationInput): Promise<SecurityExplanation> {
  console.log("[AI] Explanation generation started");

  const buildFallback = (reason: string): SecurityExplanation => {
    const deterministic = buildDeterministicExplanation(input);
    return {
      ...deterministic,
      meta: {
        generator: "DETERMINISTIC",
        provider: env.AI_PROVIDER,
        model: env.AI_MODEL,
        fallbackReason: reason,
      },
    };
  };

  if (env.AI_PROVIDER === "heuristics") {
    console.log(`[AI] Explanation generation failed\nprovider=${env.AI_PROVIDER}\nmodel=${env.AI_MODEL}\nreason=HEURISTICS_PROVIDER`);
    return buildFallback("HEURISTICS_PROVIDER");
  }

  if (!env.AI_API_KEY || env.AI_API_KEY === "YOUR_AI_API_KEY") {
    console.log(`[AI] Explanation generation failed\nprovider=${env.AI_PROVIDER}\nmodel=${env.AI_MODEL}\nreason=MISSING_API_KEY`);
    return buildFallback("MISSING_API_KEY");
  }

  try {
    console.log(`[AI] provider=${env.AI_PROVIDER}`);
    console.log(`[AI] model=${env.AI_MODEL}`);
    console.log("[AI] request started");

    const context = buildHumanExplanationContext(input);

    const response = await ai.chat.completions.create({
      model: env.AI_MODEL,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `
You translate verified blockchain security facts into simple language for normal users.

Your ONLY job is to explain an already-determined security decision to a normal person in clear, calm, accessible English.

You are NOT the security decision maker. The security engine has ALREADY decided: ALLOW, REVIEW, or BLOCK. NEVER change that decision.

CORE PRINCIPLE:
OBSERVED FACT -> WHAT IT MEANS -> USER IMPACT
Never use finding codes, security-engineering jargon, or generic AI paragraphs in primary prose.

STRICT RULES:
- Never invent evidence or facts. Use only the verified facts provided in the input context.
- Never change the decision (ALLOW, REVIEW, BLOCK), risk level, risk score, or comparison status.
- Never introduce unsupported technical claims.
- Do not repeat raw finding codes (e.g. EXCESSIVE_SELL_TAX, UNVERIFIED_CONTRACT) in user-facing text.
- Do not use empty AI buzzwords (e.g. "unlock", "elevate", "cutting-edge", "game-changer", "seamless", "delve").
- Prefer short, clear sentences.
- Explain one cause at a time.
- State observed facts first, then explain what they mean, then explain the potential impact.
- Use conditional language when an outcome is not proven:
  - If a 98% sell tax is configured: "The token contract reports a configured 98% sell tax. If enforced during a sale, you could receive substantially less than expected." Never say "You will lose 98% of your funds" unless on-chain simulation proved that exact outcome.
  - If unlimited approval: "This transaction gives broad spending permission without a fixed limit. If the spender is unsafe or compromised, this permission could put your tokens at risk."
- Preserve token names, amounts, and addresses exactly as provided.
- Explain intent vs actual transaction explicitly:
  - If they differ, state: "This transaction does something different from what you asked for."
  - Then explain the exact difference (e.g. "You asked to use 0.002 tBNB to buy DHON, but the transaction is configured to receive BUSD.").
  - Do NOT invent amount mismatches if the amount matches.
- For headlines:
  - BLOCK: Prefer "The transaction was stopped" (or a specific humanized headline such as "An unusually high sell fee was found (98%)" or "This transaction does something different from what you asked for").
  - REVIEW: Prefer "This transaction needs your attention" (or a specific humanized headline such as "The contract could not be fully verified").
  - ALLOW: Prefer "The transaction passed Nalar's checks".
- Recommended action MUST match the decision:
  BLOCK -> CANCEL
  REVIEW -> REVIEW
  ALLOW -> PROCEED

Return JSON conforming to this schema:
{
  "title": string,
  "headline": string,
  "summary": string,
  "details": string[],
  "recommendedAction": "CANCEL" | "REVIEW" | "PROCEED",
  "whyStopped": {
    "title": string,
    "primaryReason": string,
    "userImpact": string
  },
  "whatThisMeans": string,
  "userIntent": {
    "summary": string,
    "action": string,
    "input": string,
    "expectedOutput": string,
    "status": "MATCH" | "MISMATCH" | "UNKNOWN"
  },
  "actualTransaction": {
    "summary": string,
    "action": string,
    "input": string,
    "output": string,
    "target": string
  },
  "comparison": {
    "status": "MATCH" | "MISMATCH" | "UNKNOWN",
    "summary": string,
    "details": string[]
  },
  "evidence": [
    {
      "label": string,
      "value": string,
      "explanation": string,
      "source": "ON-CHAIN" | "SIMULATION" | "TRANSACTION" | "POLICY" | "INTENT" | "BNB_MCP"
    }
  ]
}

IMPORTANT: "details" must always be a JSON array of strings, e.g. ["reason 1"].
"source" in evidence MUST be one of: "ON-CHAIN" | "SIMULATION" | "TRANSACTION" | "POLICY" | "INTENT" | "BNB_MCP".
`,
        },
        {
          role: "user",
          content: JSON.stringify({
            verifiedContext: context,
            rawInput: input,
          }),
        },
      ],
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) {
      throw new Error("AI returned empty explanation.");
    }

    const json = parseAIJson(raw);
    const parsed = securityExplanationSchema.safeParse(json);
    if (!parsed.success) {
      const issueSummary = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
      throw new Error(`Explanation schema validation failed: ${issueSummary}`);
    }

    console.log("[AI] Explanation generation succeeded");

    return {
      ...parsed.data,
      meta: {
        generator: "AI",
        provider: env.AI_PROVIDER,
        model: env.AI_MODEL,
      },
    };
  } catch (error) {
    const safeReason = error instanceof Error ? error.message : "AI explanation request failed";
    console.log(`[AI] Explanation generation failed\nprovider=${env.AI_PROVIDER}\nmodel=${env.AI_MODEL}\nreason=${safeReason}`);
    return buildFallback(safeReason);
  }
}
