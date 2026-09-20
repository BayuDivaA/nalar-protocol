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

/**
 * Deterministically constructs a rich, human-first structured explanation.
 * Adheres strictly to antislop rules: no buzzwords, fact/meaning/impact hierarchy,
 * and conditional language for unproven loss outcomes.
 */
export function buildDeterministicExplanation(input: GenerateExplanationInput): SecurityExplanation {
  const isBlock = input.decision === "BLOCK";
  const isReview = input.decision === "REVIEW";

  // 1. Analyze threat signals
  let sellTaxPercent: number | null = null;
  let hasOwnerControl = false;
  const findingCodes = new Set<string>();

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
          findingCodes.add(f.code);
        }
        if (f.code?.includes("OWNER_CONTROLLED")) {
          hasOwnerControl = true;
        }
      }
    }
  }

  if (Array.isArray(input.transactionThreats)) {
    for (const t of input.transactionThreats) {
      if (t.code) {
        findingCodes.add(t.code);
      }
    }
  }

  const isUnlimitedApproval = findingCodes.has("UNLIMITED_ALLOWANCE");
  const isUnexpectedSpender = findingCodes.has("UNEXPECTED_SPENDER");
  const isSimFailed = input.simulation && !input.simulation.success;
  const isMismatch = !input.intentMatch || input.comparison.overall === "MISMATCH" || input.comparison.matches === false;
  const isUncertain = input.comparison.overall === "UNCERTAIN";

  const compOverall: "MATCH" | "MISMATCH" | "UNKNOWN" =
    input.comparison.overall === "MATCH" || (input.intentMatch && input.comparison.matches !== false && input.comparison.overall !== "UNCERTAIN" && input.comparison.overall !== "MISMATCH")
      ? "MATCH"
      : input.comparison.overall === "MISMATCH" || !input.intentMatch || input.comparison.matches === false
        ? "MISMATCH"
        : "UNKNOWN";

  // 2. Derive headline, whyStopped, userImpact, and whatThisMeans
  let headline = isBlock ? "Transaction Blocked" : isReview ? "Review Recommended" : "Transaction Verified";
  let whyTitle = isBlock ? "Why Nalar stopped this transaction" : isReview ? "Why Nalar recommends review" : "Transaction verified";
  let primaryReason = input.reasons.length > 0 ? input.reasons[0]! : "Security evaluation completed.";
  let userImpact = "Nalar evaluated the transaction against deterministic safety rules.";
  let whatThisMeans = "Nalar verified that the on-chain parameters adhere to your intent and security policy.";

  // A. Critical Block Cases
  if (isBlock) {
    if (sellTaxPercent !== null && sellTaxPercent >= 20) {
      headline = `Unusually high sell tax detected (${sellTaxPercent.toFixed(0)}%)`;
      primaryReason = `The token contract reports a configured ${sellTaxPercent.toFixed(0)}% sell tax.`;
      userImpact = "The contract is configured to take an unusually large portion from a sale. If enforced during a sale, you could receive substantially less than expected.";
      whatThisMeans = "Even though buying this token may succeed, the contract contains rules that could prevent you from selling or take most of your funds on sale.";
    } else if (isUnlimitedApproval || isUnexpectedSpender) {
      headline = "Unrestricted token spending permission";
      primaryReason = "This transaction grants permission to spend your tokens without a fixed limit.";
      userImpact = "An unrestricted allowance permits the spender contract to transfer your tokens at any time without asking for confirmation again.";
      whatThisMeans = "You are giving this contract permission to spend your tokens without a small spending limit. If the contract is vulnerable or malicious, your balance could be drained.";
    } else if (isSimFailed) {
      headline = "Transaction simulation failed";
      primaryReason = "The blockchain node rejected this transaction during test execution and it would revert.";
      userImpact = "Submitting this transaction will forfeit the network gas fee without completing your intended action.";
      whatThisMeans = "The smart contract rejected the transaction during on-chain simulation. The transaction cannot succeed in its current state.";
    } else if (isMismatch) {
      headline = "Intent mismatch detected";
      primaryReason = input.comparison.summary || (input.comparison.mismatches[0] ?? "The transaction differs from your requested action.");
      if (input.comparison.outputToken?.status === "MISMATCH") {
        userImpact = `You will receive ${input.comparison.outputToken.actual} instead of your expected ${input.comparison.outputToken.expected}.`;
        whatThisMeans = `You asked to receive ${input.comparison.outputToken.expected}, but this transaction is configured to receive ${input.comparison.outputToken.actual}. If you proceed, you will not receive ${input.comparison.outputToken.expected}.`;
      } else if (input.comparison.inputToken?.status === "MISMATCH") {
        userImpact = `You will spend ${input.comparison.inputToken.actual} instead of your intended ${input.comparison.inputToken.expected}.`;
        whatThisMeans = `You asked to spend ${input.comparison.inputToken.expected}, but this transaction is configured to spend ${input.comparison.inputToken.actual}.`;
      } else {
        userImpact = "The wallet request is configured to execute an action that does not match what you asked to do.";
        whatThisMeans = "Nalar compared your plain-language intent with the transaction payload and found that the actual parameters differ from your request.";
      }
    } else if (input.policy.reasons.length > 0) {
      headline = "Policy restriction triggered";
      primaryReason = input.policy.reasons[0]!;
      userImpact = "The requested interaction violates your security firewall policy rules.";
      whatThisMeans = "This action is explicitly restricted by safety policies to prevent unauthorized contract operations.";
    }
  }
  // B. Review Cases
  else if (isReview) {
    if (isMismatch) {
      headline = "Intent mismatch detected";
      primaryReason = input.comparison.summary || (input.comparison.mismatches[0] ?? "The transaction differs from your requested action.");
      if (input.comparison.outputToken?.status === "MISMATCH") {
        userImpact = `You will receive ${input.comparison.outputToken.actual} instead of your expected ${input.comparison.outputToken.expected}.`;
        whatThisMeans = `You asked to receive ${input.comparison.outputToken.expected}, but this transaction will swap for ${input.comparison.outputToken.actual} instead.`;
      } else if (input.comparison.inputToken?.status === "MISMATCH") {
        userImpact = `You will spend ${input.comparison.inputToken.actual} instead of your intended ${input.comparison.inputToken.expected}.`;
        whatThisMeans = `You asked to spend ${input.comparison.inputToken.expected}, but this transaction will spend ${input.comparison.inputToken.actual} instead.`;
      } else if (input.comparison.amount?.status === "MISMATCH") {
        userImpact = `The transaction amount (${input.comparison.amount.actual}) differs from your intended amount (${input.comparison.amount.expected}).`;
        whatThisMeans = `You asked to transact ${input.comparison.amount.expected}, but the contract is configured for ${input.comparison.amount.actual}.`;
      } else {
        userImpact = "The transaction parameters do not fully align with what you asked to do.";
        whatThisMeans = "Nalar found differences between your requested intent and what the blockchain transaction actually does.";
      }
    } else if (isUncertain) {
      headline = "Intent could not be verified";
      primaryReason = "Could not clearly verify your intent from the provided description.";
      userImpact = "Please verify the contract address, token symbols, and amounts in your wallet before confirming.";
      whatThisMeans = "Nalar was unable to extract specific token and amount targets from your intent description to confirm a match.";
    } else if (findingCodes.has("UNVERIFIED_CONTRACT")) {
      headline = "Unverified smart contract";
      primaryReason = "The destination contract source code is not verified on the block explorer.";
      userImpact = "The contract logic cannot be independently inspected for backdoors or unexpected transfer fees.";
      whatThisMeans = "You are interacting with a contract whose source code is unverified. This increases the risk of unexpected behaviors.";
    } else if (findingCodes.has("SELL_SIMULATION_UNAVAILABLE")) {
      headline = "Sell simulation unavailable";
      primaryReason = "Sell simulation could not be completed on-chain.";
      userImpact = "It could not be independently confirmed that tokens purchased can be sold back freely.";
      whatThisMeans = "While purchasing tokens may work, the ability to sell them later has not been proven by on-chain simulation.";
    } else if (findingCodes.has("CONTRACT_TARGET_IS_EOA")) {
      headline = "Target is a personal wallet";
      primaryReason = "The destination address is an externally owned account (EOA), not a verified smart contract.";
      userImpact = "Funds sent will go directly to an individual's private wallet with no automated contract safeguards.";
      whatThisMeans = "You are sending assets directly to another person's wallet rather than interacting with a decentralized application.";
    } else {
      headline = "Transaction requires verification";
      primaryReason = input.reasons[0] ?? "This transaction exceeds normal review thresholds.";
      userImpact = "Please verify the recipient, spending amounts, and contract details before signing.";
      whatThisMeans = "The transaction carries values or permissions that warrant double-checking, but does not present an immediate critical threat.";
    }
  }
  // C. Allow Cases
  else {
    headline = "Transaction cleared for signing";
    primaryReason = "The transaction matches what you asked to do and passed all automated checks.";
    userImpact = "No high-risk patterns or policy violations were detected on BNB Chain.";
    whatThisMeans = "Nalar verified that the on-chain execution path matches your intent with no hidden allowances or dangerous contract configurations.";
  }

  // 3. User intent breakdown
  const intentSummary = input.normalizedIntent?.description ?? input.intent;
  const intentAction = input.normalizedIntent?.action ?? "UNKNOWN";
  const intentInputToken = input.normalizedIntent?.tokenIn ?? (input.actualValueNative ? `${input.actualValueNative}` : undefined);
  const intentOutputToken = input.normalizedIntent?.tokenOut ?? undefined;

  const userIntent = {
    summary: intentSummary,
    action: intentAction,
    input: intentInputToken,
    expectedOutput: intentOutputToken,
    status: compOverall,
  };

  // 4. Actual transaction breakdown
  const txSummary = input.transactionSummary?.summary ?? input.transactionSummary?.description ?? input.actualAction;
  const actualInputDisplay = input.transactionSummary?.input?.amount ? `${input.transactionSummary.input.amount} ${input.transactionSummary.input.symbol ?? ""}`.trim() : input.actualValueNative;
  const actualOutputDisplay = input.transactionSummary?.output?.amount ? `${input.transactionSummary.output.amount} ${input.transactionSummary.output.symbol ?? ""}`.trim() : (input.transactionSummary?.output?.symbol ?? undefined);

  const actualTransaction = {
    summary: txSummary,
    action: input.transactionSummary?.action ?? input.actualAction,
    input: actualInputDisplay,
    output: actualOutputDisplay,
    target: input.transactionSummary?.target ?? undefined,
  };

  // 5. Comparison
  let compSummary = input.comparison.summary;
  if (!compSummary || compOverall === "MATCH") {
    if (compOverall === "MATCH" && isBlock) {
      compSummary = "The transaction matches your request, but Nalar blocked it because the target token was found to have a critical security risk.";
    } else if (compOverall === "MATCH") {
      compSummary = "The transaction matches what you asked to do.";
    } else {
      compSummary = input.comparison.mismatches?.[0] ?? "The transaction differs from your requested action.";
    }
  }

  const comparison = {
    status: compOverall,
    summary: compSummary,
    details: input.comparison.mismatches,
  };

  // 6. Security evidence list
  const evidence: SecurityEvidenceItem[] = [];

  if (sellTaxPercent !== null) {
    evidence.push({
      label: "Sell tax",
      value: `${sellTaxPercent.toFixed(0)}%`,
      explanation: `The token contract reports a configured ${sellTaxPercent.toFixed(0)}% sell tax.`,
      source: "ON-CHAIN",
    });
  }

  if (hasOwnerControl) {
    evidence.push({
      label: "Owner control",
      value: "Detected",
      explanation: "The token owner can modify contract parameters or trading configurations.",
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
    value: input.comparison.overall === "MATCH" ? "Matched" : input.comparison.overall === "MISMATCH" ? "Mismatch" : "Uncertain",
    explanation: input.comparison.summary,
    source: "INTENT",
  });

  if (input.policy.reasons.length > 0) {
    evidence.push({
      label: "Policy evaluation",
      value: input.policy.allowed ? "Allowed" : "Forbidden",
      explanation: input.policy.reasons[0]!,
      source: "POLICY",
    });
  }

  return {
    title: isBlock ? "Transaction Blocked" : isReview ? "Review Required" : "Transaction Verified",
    headline,
    summary: primaryReason,
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
  };
}

export async function generateSecurityExplanation(input: GenerateExplanationInput): Promise<SecurityExplanation> {
  const fallback = (): SecurityExplanation => buildDeterministicExplanation(input);

  if (env.AI_PROVIDER === "heuristics" || !env.AI_API_KEY) {
    return fallback();
  }

  try {
    const response = await ai.chat.completions.create({
      model: env.AI_MODEL,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `
You are Nalar Protocol's transaction security explanation assistant.

Your ONLY job is to explain an already-determined security decision to a normal person in clear, calm, professional language.

You are NOT the security decision maker. The security engine has ALREADY decided: ALLOW, REVIEW, or BLOCK. NEVER change that decision.

NEVER invent facts. NEVER assume facts that are not present in the input.

LANGUAGE RULES:
- Use simple, direct, accessible English.
- Sound calm, clear, and professional.
- Explain the problem like a trusted security assistant.
- Do not use empty AI buzzwords (e.g. "unlock", "elevate", "cutting-edge", "game-changer", "seamless").
- Clearly distinguish:
  1. What the user intended
  2. What the transaction actually tries to do
  3. Why Nalar stopped or flagged it
  4. What this means for the user

STRICT CONDITIONALITY & EVIDENCE RULES:
- Never convert a configured tax into a guaranteed financial loss.
- If the evidence shows sellTax = 9800 (98%):
  Say: "The token contract reports a configured 98% sell tax."
  And: "If enforced during a sale, you could receive substantially less than expected."
  Do NOT say: "You will lose 98%" unless on-chain simulation proved that outcome.
- If unlimited approval: Explain that the permission is not limited to a specific amount.
- If limited approval: Explain the exact amount only if available.
- If NFT operator approval: Explain that this gives permission to manage all NFTs in the collection.
- When intentMatch is true but decision is BLOCK: Explain that the transaction matches what the user asked, but Nalar blocked it because the target token contains an independent critical risk.
- When intentMatch is false: Explain ONLY the mismatch fields present in comparison.mismatches. Do not invent amount mismatches if only tokens differ.

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

The recommended action MUST match the deterministic decision:
BLOCK -> CANCEL
REVIEW -> REVIEW
ALLOW -> PROCEED
`,
        },
        {
          role: "user",
          content: JSON.stringify(input),
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
      console.error("[AI] Explanation schema validation failed:", parsed.error.flatten());
      return fallback();
    }

    return parsed.data;
  } catch (error) {
    console.warn("[AI] Explanation generation failed, falling back to deterministic builder:", error instanceof Error ? error.message : String(error));
    return fallback();
  }
}
