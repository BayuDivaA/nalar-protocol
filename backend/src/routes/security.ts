import { Hono } from "hono";
import { z } from "zod";
import { getAddress, isAddress, type Hex } from "viem";
import { parseUserIntent } from "../services/intent-engine";
import { normalizeIntent } from "../services/intent-normalizer";
import { serializeBigInt } from "../lib/serialize";
import { simulateTransaction } from "../services/simulator";
import { analyzeEffects } from "../services/effect-analyzer";
import { resolveEffectState } from "../services/effect-state";
import { calculateRisk, mergeScamRisk } from "../services/risk-engine";
import { compareIntent } from "../services/intent-comparator";
import { makeSecurityDecision } from "../services/security-decision";
import { generateSecurityExplanation } from "../services/explanation-engine";
import { defaultPolicy, evaluatePolicy } from "../services/policy";
import { analyzeTransactionIntelligence } from "../services/transaction-intelligence";
import { translateTransaction } from "../services/transaction-translator";
import { enrichSwapEffect } from "../services/enrich-swap";
import { auditSwapTokens } from "../services/scam/token-auditor";
import { calculateScamRisk } from "../services/scam/scam-risk-engine";
import { buildTransactionScamContext } from "../services/scam/transaction-scam-context";
import { BnbAgentInvestigator } from "../services/scam/bnb-agent-investigator";

export const securityRoute = new Hono();

const securityCheckSchema = z.object({
  intent: z.string().min(1).max(2000),

  transaction: z.object({
    chainId: z.number().int().positive(),

    from: z.string().regex(/^0x[a-fA-F0-9]{40}$/),

    to: z.string().regex(/^0x[a-fA-F0-9]{40}$/),

    value: z.string().regex(/^\d+$/),

    data: z.string().regex(/^0x([a-fA-F0-9]{2})*$/),
  }),
});

export const bnbAgentInvestigator =
  process.env.BNB_INVESTIGATOR_ENABLED === "true"
    ? new BnbAgentInvestigator()
    : undefined;

securityRoute.post("/", async (c) => {
  try {
    const body = await c.req.json();

    const parsed = securityCheckSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          error: "INVALID_SECURITY_CHECK_REQUEST",
          details: parsed.error.flatten(),
        },
        400,
      );
    }

    const { intent: intentText, transaction } = parsed.data;

    /**
     * BNB Testnet only for MVP
     */
    if (transaction.chainId !== 97) {
      return c.json(
        {
          ok: false,
          error: "UNSUPPORTED_CHAIN",
          expectedChainId: 97,
          receivedChainId: transaction.chainId,
        },
        400,
      );
    }

    /**
     * Validate addresses
     */
    if (!isAddress(transaction.from)) {
      return c.json(
        {
          ok: false,
          error: "INVALID_FROM_ADDRESS",
        },
        400,
      );
    }

    if (!isAddress(transaction.to)) {
      return c.json(
        {
          ok: false,
          error: "INVALID_TO_ADDRESS",
        },
        400,
      );
    }

    const from = getAddress(transaction.from);

    const to = getAddress(transaction.to);

    const value = BigInt(transaction.value);

    const data = transaction.data as Hex;

    /**
     * STEP 1
     *
     * Understand user intent.
     */
    const rawIntent = await parseUserIntent(intentText);

    /**
     * STEP 2
     *
     * Normalize human-readable values
     * into blockchain units.
     */
    const intent = normalizeIntent(rawIntent);

    /**
     * STEP 3
     *
     * Decode transaction.
     */
    const intelligence = await analyzeTransactionIntelligence({
      chainId: transaction.chainId,
      to,
      data: transaction.data as Hex,
    });

    const decoded = intelligence;

    const baseAction = decoded.classification.action;

    console.log("[SWAP DEBUG][INTELLIGENCE]", {
      to,
      protocol: decoded.protocol,
      functionName: decoded.functionName,
      selector: decoded.selector,
      args: decoded.args,
      classification: decoded.classification,
    });

    /**
     * STEP 4
     *
     * Simulate transaction.
     */
    const simulation = await simulateTransaction({
      from,
      to,
      value,
      data,
    });

    /**
     * Simulation failure is an immediate
     * security failure.
     */
    if (!simulation.success) {
      const explanation = {
        title: "Transaction blocked",

        summary: "The transaction could not be safely simulated.",

        details: [simulation.error ?? "Simulation reverted."],

        recommendedAction: "CANCEL" as const,
      };

      return c.json({
        ok: true,

        decision: "BLOCK",

        riskScore: 100,

        riskLevel: "CRITICAL",

        intentMatch: false,

        intent: {
          action: intent.action,

          quantity: intent.quantity,

          maxValueNative: intent.maxValueNative,

          nativeCurrency: intent.nativeCurrency,

          maxValueWei: intent.maxValueWei?.toString() ?? null,

          allowApproval: intent.allowApproval,

          targetAddress: intent.targetAddress,

          description: intent.description,
          tokenIn: intent.tokenIn,
          tokenOut: intent.tokenOut,
        },

        actual: {
          action: baseAction,

          functionName: decoded.functionName ?? null,

          selector: decoded.selector ?? null,

          value: value.toString(),

          description: decoded.classification.description,
        },

        simulation: {
          success: false,

          gasEstimate: simulation.gasEstimate,

          error: simulation.error,
        },

        effects: null,

        stateDiff: null,

        comparison: {
          matches: false,

          mismatches: ["Transaction simulation failed."],
        },

        contract: {
          address: intelligence.to,
          abiSource: intelligence.abiSource,
          verified: intelligence.contractVerified,
        },

        transaction: {
          selector: intelligence.selector ?? null,
          functionName: intelligence.functionName ?? null,
          action: intelligence.classification.action,
        },

        reasons: ["Transaction simulation failed."],

        explanation,
      });
    }

    /**
     * STEP 5
     *
     * Analyze semantic effects.
     */
    const effects = analyzeEffects({
      from,
      to,
      functionName: decoded.functionName,
      args: decoded.args,
      protocol: decoded.protocol,
    });

    const enrichedSwaps = await Promise.all(effects.swaps.map((swap) => enrichSwapEffect(swap)));

    const analyzedEffects = {
      ...effects,
      swaps: enrichedSwaps,
    };

    const actualAction = analyzedEffects.swaps.length > 0 ? "SWAP" : decoded.classification.action;

    console.log("[SWAP DEBUG][EFFECTS]", {
      protocol: decoded.protocol,
      functionName: decoded.functionName,
      swapCount: effects.swaps.length,
      swaps: effects.swaps,
      approvals: effects.approvals,
    });

    const transactionSummary = translateTransaction({
      from,
      to,
      value,

      action: actualAction,

      functionName: decoded.functionName ?? null,

      args: decoded.args ?? [],

      effects: analyzedEffects,

      intentDescription: intent.description,
    });
    /**
     * STEP 6
     *
     * Read current blockchain state.
     */
    const stateDiff = await resolveEffectState(analyzedEffects);

    const scamAnalyses = await auditSwapTokens({
      chainId: transaction.chainId,
      owner: from,
      router: to,
      swaps: analyzedEffects.swaps,
  investigator: bnbAgentInvestigator,
    });

    const transactionScamContext = buildTransactionScamContext(scamAnalyses);

    const scamAnalysis = scamAnalyses[0] ?? null;

    const scamRisk = transactionScamContext.risk;

    /**
     * STEP 7
     *
     * Deterministic risk analysis.
     */
    const risk = mergeScamRisk(calculateRisk(stateDiff, actualAction, analyzedEffects.approvals), scamRisk);

    /**
     * STEP 8
     *
     * Compare user intent
     * with actual effects.
     */
    const comparison = compareIntent(intent, actualAction, analyzedEffects, value);

    const policyEvaluation = evaluatePolicy({
      policy: defaultPolicy,
      action: actualAction,
      value,
    });

    /**
     * Final deterministic
     * security decision.
     */
    const decision = makeSecurityDecision({
      simulationSuccess: simulation.success,
      risk,
      comparison,
      effects: analyzedEffects,
      policy: policyEvaluation,
      scamAnalyses,
    });

    /**
     * STEP 10
     *
     * AI explains the result.
     */
    let explanation;

    try {
      explanation = await generateSecurityExplanation({
        intent: intentText,

        decision: decision.decision,

        riskLevel: risk.level,

        riskScore: risk.score,

        intentMatch: comparison.matches,

        actualAction: actualAction,

        actualFunction: decoded.functionName ?? null,

        actualValueNative: `${Number(value) / 1e18} BNB`,

        reasons: decision.reasons,

        effects: serializeBigInt(effects),

        comparison,

        policy: {
          allowed: policyEvaluation.allowed,

          requiresReview: policyEvaluation.requiresReview,

          reasons: policyEvaluation.reasons,
        },
      });
    } catch (error) {
      console.error("[EXPLANATION]", error);

      explanation = {
        title: decision.decision === "BLOCK" ? "Transaction blocked" : decision.decision === "REVIEW" ? "Transaction needs review" : "Transaction appears safe",

        summary: decision.reasons[0] ?? "Security analysis completed.",

        details: decision.reasons,

        recommendedAction: decision.decision === "BLOCK" ? ("CANCEL" as const) : decision.decision === "REVIEW" ? ("REVIEW" as const) : ("PROCEED" as const),
      };
    }

    return c.json({
      ok: true,

      decision: decision.decision,

      riskScore: risk.score,

      riskLevel: risk.level,

      intentMatch: comparison.matches,

      intent: {
        action: intent.action,

        quantity: intent.quantity,

        maxValueNative: intent.maxValueNative,

        nativeCurrency: intent.nativeCurrency,

        maxValueWei: intent.maxValueWei?.toString() ?? null,

        allowApproval: intent.allowApproval,

        targetAddress: intent.targetAddress,

        description: intent.description,
      },

      actual: {
        action: actualAction,

        functionName: decoded.functionName ?? null,

        selector: decoded.selector ?? null,

        value: value.toString(),

        description: decoded.classification.description,
      },

      transactionSummary,

      simulation: {
        success: simulation.success,

        gasEstimate: simulation.gasEstimate,

        error: simulation.error,
      },

      policy: {
        maxSpendBNB: defaultPolicy.maxSpendBNB,

        allowedActions: defaultPolicy.allowedActions,

        forbiddenActions: defaultPolicy.forbiddenActions,

        requireReviewAboveBNB: defaultPolicy.requireReviewAboveBNB,

        evaluation: {
          allowed: policyEvaluation.allowed,

          requiresReview: policyEvaluation.requiresReview,

          reasons: policyEvaluation.reasons,
        },
      },

      effects: serializeBigInt(analyzedEffects),

      scamAnalysis: serializeBigInt(scamAnalysis),

      scamAnalyses: serializeBigInt(scamAnalyses),

      transactionScamContext: serializeBigInt(transactionScamContext),

      stateDiff: serializeBigInt(stateDiff),

      comparison,

      reasons: decision.reasons,

      explanation,
    });
  } catch (error) {
    console.error("[SECURITY CHECK]", error);

    return c.json(
      {
        ok: false,
        error: "SECURITY_CHECK_FAILED",
      },
      500,
    );
  }
});
