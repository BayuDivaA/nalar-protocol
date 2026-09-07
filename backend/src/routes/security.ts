import { Hono } from "hono";
import { z } from "zod";

import { getAddress, isAddress, type Hex } from "viem";

import { parseUserIntent } from "../services/intent-engine";

import { normalizeIntent } from "../services/intent-normalizer";

import { decodeTransactionData } from "../lib/decoder";

import { serializeBigInt } from "../lib/serialize";

import { simulateTransaction } from "../services/simulator";

import { analyzeEffects } from "../services/effect-analyzer";

import { resolveEffectState } from "../services/effect-state";

import { calculateRisk } from "../services/risk-engine";

import { compareIntent } from "../services/intent-comparator";

import { makeSecurityDecision } from "../services/security-decision";

import { generateSecurityExplanation } from "../services/explanation-engine";

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
     * Chain validation
     */
    if (transaction.chainId !== 97) {
      return c.json(
        {
          ok: false,
          error: "UNSUPPORTED_CHAIN",
        },
        400,
      );
    }

    /**
     * Address validation
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
     * 1. AI understands user intent.
     */
    const rawIntent = await parseUserIntent(intentText);

    /**
     * 2. Normalize intent.
     */
    const intent = normalizeIntent(rawIntent);

    /**
     * 3. Decode actual transaction.
     */
    const decoded = decodeTransactionData(data);

    /**
     * 4. Simulate transaction.
     */
    const simulation = await simulateTransaction({
      from,
      to,
      value,
      data,
    });

    /**
     * 5. Stop immediately on
     * simulation failure.
     */
    if (!simulation.success) {
      return c.json({
        ok: true,

        decision: "BLOCK",

        riskScore: 100,

        riskLevel: "CRITICAL",

        intentMatch: false,

        reason: "SIMULATION_REVERTED",

        intent: serializeBigInt(intent),

        actual: {
          action: decoded.classification.action,

          functionName: decoded.functionName ?? null,

          value: value.toString(),
        },

        simulation: {
          success: false,

          error: simulation.error,
        },
      });
    }

    /**
     * 6. Analyze transaction effects.
     */
    const effects = analyzeEffects({
      from,
      to,
      functionName: decoded.functionName,
      args: decoded.args,
    });

    /**
     * 7. Read predicted state.
     */
    const stateDiff = await resolveEffectState(effects);

    /**
     * 8. Calculate deterministic risk.
     */
    const risk = calculateRisk(stateDiff, decoded.classification.action);

    /**
     * 9. Compare human intent
     * with actual effects.
     */
    const comparison = compareIntent(intent, effects, value);

    /**
     * 10. Final security decision.
     */
    const decision = makeSecurityDecision({
      simulationSuccess: simulation.success,

      risk,

      comparison,

      effects,
    });

    let explanation;

    try {
      explanation = await generateSecurityExplanation({
        intent: intentText,

        decision: decision.decision,

        riskLevel: risk.level,

        riskScore: risk.score,

        intentMatch: comparison.matches,

        actualAction: decoded.classification.action,

        actualFunction: decoded.functionName ?? null,

        reasons: decision.reasons,
      });
    } catch (error) {
      console.error("Explanation generation failed:", error);

      explanation = {
        title: decision.decision === "BLOCK" ? "Transaction blocked" : decision.decision === "REVIEW" ? "Transaction needs review" : "Transaction appears safe",

        summary: decision.reasons[0] ?? "Security analysis completed.",

        details: decision.reasons,

        recommendedAction: decision.decision === "BLOCK" ? "CANCEL" : decision.decision === "REVIEW" ? "REVIEW" : "PROCEED",
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
        action: decoded.classification.action,

        functionName: decoded.functionName ?? null,

        selector: decoded.selector ?? null,

        value: value.toString(),

        description: decoded.classification.description,
      },

      simulation: {
        success: simulation.success,

        gasEstimate: simulation.gasEstimate,

        error: simulation.error,
      },

      effects: serializeBigInt(effects),

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
