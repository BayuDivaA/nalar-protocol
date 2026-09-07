import { Hono } from "hono";
import { z } from "zod";

import { parseUserIntent } from "../services/intent-engine";

import { getAddress, isAddress, type Hex } from "viem";

import { transactionRequestSchema } from "../types/transaction";

import { decodeTransactionData } from "../lib/decoder";

import { serializeBigInt } from "../lib/serialize";

import { simulateTransaction } from "../services/simulator";

import { analyzeBasicImpact } from "../services/impact-analyzer";

import { analyzeStateDiff } from "../services/state-diff";

import { analyzeEffects } from "../services/effect-analyzer";

import { resolveEffectState } from "../services/effect-state";

import { calculateRisk } from "../services/risk-engine";

import { normalizeIntent } from "../services/intent-normalizer";

import { compareIntent } from "../services/intent-comparator";

export const transactionRoute = new Hono();

// ANALYZE ENDPOINT
transactionRoute.post("/analyze", async (c) => {
  try {
    const body = await c.req.json();

    const parsed = transactionRequestSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          error: "INVALID_TRANSACTION",
          details: parsed.error.flatten(),
        },
        400,
      );
    }

    const tx = parsed.data;

    /**
     * Chain validation
     */
    if (tx.chainId !== 97) {
      return c.json(
        {
          ok: false,
          error: "UNSUPPORTED_CHAIN",
          expectedChainId: 97,
          receivedChainId: tx.chainId,
        },
        400,
      );
    }

    /**
     * Address validation
     */
    if (!isAddress(tx.from)) {
      return c.json(
        {
          ok: false,
          error: "INVALID_FROM_ADDRESS",
        },
        400,
      );
    }

    if (!isAddress(tx.to)) {
      return c.json(
        {
          ok: false,
          error: "INVALID_TO_ADDRESS",
        },
        400,
      );
    }

    /**
     * Normalize addresses
     */
    const from = getAddress(tx.from);
    const to = getAddress(tx.to);

    /**
     * Validate bigint
     */
    let value: bigint;

    try {
      value = BigInt(tx.value);
    } catch {
      return c.json(
        {
          ok: false,
          error: "INVALID_VALUE",
        },
        400,
      );
    }

    /**
     * Decode calldata
     */
    const decoded = decodeTransactionData(tx.data as Hex);

    const effects = analyzeEffects({
      from,
      to,
      functionName: decoded.functionName,
      args: decoded.args,
    });

    const simulation = await simulateTransaction({
      from,
      to,
      value,
      data: tx.data as Hex,
    });

    const effectState = simulation.success ? await resolveEffectState(effects) : [];

    const stateDiff = simulation.success
      ? await analyzeStateDiff({
          from,
          to,
          data: tx.data as Hex,
        })
      : {
          approvals: [],
        };

    const impact = analyzeBasicImpact({
      from,
      to,
      value,
    });

    const risk = calculateRisk(effectState);

    return c.json({
      ok: true,

      transaction: {
        chainId: tx.chainId,
        from,
        to,
        value: value.toString(),
        data: tx.data,
      },

      decoded: {
        success: decoded.decoded,
        selector: decoded.selector,
        functionName: decoded.functionName ?? null,

        args: serializeBigInt(decoded.args ?? null),
      },

      security: {
        action: decoded.classification.action,

        riskLevel: decoded.classification.riskLevel,

        description: decoded.classification.description,

        spender: decoded.classification.spender ?? null,

        operator: decoded.classification.operator ?? null,

        target: decoded.classification.target ?? null,

        amount: decoded.classification.amount ?? null,
      },

      simulation: {
        success: simulation.success,

        gasEstimate: simulation.gasEstimate,

        returnData: simulation.returnData,

        error: simulation.error,
      },

      impact: {
        nativeValueSpent: impact.nativeValueSpent.toString(),

        tokenTransfers: serializeBigInt(impact.tokenTransfers),

        approvals: serializeBigInt(impact.approvals),

        nftTransfers: serializeBigInt(impact.nftTransfers),
      },

      analysis: {
        status: simulation.success ? "SIMULATION_SUCCESS" : "SIMULATION_REVERTED",

        riskScore: null,
      },

      effects: serializeBigInt(effects),

      stateDiff: serializeBigInt(effectState),

      risk,
    });
  } catch (error) {
    console.error(error);

    return c.json(
      {
        ok: false,
        error: "INVALID_REQUEST",
      },
      400,
    );
  }
});

// INTENT ENDPOINT
transactionRoute.post("/intent", async (c) => {
  try {
    const body = await c.req.json();

    const schema = z.object({
      message: z.string().min(1).max(2000),
    });

    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          error: "INVALID_INTENT_REQUEST",
          details: parsed.error.flatten(),
        },
        400,
      );
    }

    const intent = await parseUserIntent(parsed.data.message);

    return c.json({
      ok: true,
      input: parsed.data.message,
      intent,
    });
  } catch (error) {
    console.error("Intent parsing failed:", error);

    return c.json(
      {
        ok: false,
        error: "INTENT_ANALYSIS_FAILED",
      },
      500,
    );
  }
});

// COMPARE ENDPOINT
transactionRoute.post("/compare", async (c) => {
  try {
    const body = await c.req.json();

    const schema = z.object({
      intent: z.string().min(1),

      transaction: z.object({
        from: z.string(),
        to: z.string(),
        value: z.string(),
        data: z.string(),
      }),
    });

    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          error: "INVALID_COMPARE_REQUEST",
        },
        400,
      );
    }

    const input = parsed.data;

    /**
     * AI understands human intent.
     */
    const rawIntent = await parseUserIntent(input.intent);

    /**
     * Convert BNB → wei.
     */
    const normalizedIntent = normalizeIntent(rawIntent);

    const from = getAddress(input.transaction.from);

    const to = getAddress(input.transaction.to);

    const value = BigInt(input.transaction.value);

    const data = input.transaction.data as Hex;

    /**
     * Decode transaction.
     */
    const decoded = decodeTransactionData(data);

    /**
     * Extract semantic effects.
     */
    const effects = analyzeEffects({
      from,
      to,
      functionName: decoded.functionName,
      args: decoded.args,
    });

    /**
     * Compare human intent
     * against actual transaction.
     */
    const comparison = compareIntent(normalizedIntent, effects, value);

    return c.json({
      ok: true,

      intent: {
        action: normalizedIntent.action,

        quantity: normalizedIntent.quantity,

        maxValueNative: normalizedIntent.maxValueNative,

        maxValueWei: normalizedIntent.maxValueWei?.toString() ?? null,

        allowApproval: normalizedIntent.allowApproval,
      },

      actual: {
        action: decoded.classification.action,

        functionName: decoded.functionName ?? null,

        value: value.toString(),
      },

      effects: serializeBigInt(effects),

      comparison,
    });
  } catch (error) {
    console.error("[INTENT ROUTE] ERROR:", error);

    return c.json(
      {
        ok: false,
        error: "INTENT_ANALYSIS_FAILED",
      },
      500,
    );
  }
});
