import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";

import { AddressInspectionError, inspectAddress } from "../services/address-inspector";
import { explainAddress } from "../services/address-explanation";
import { inspectTransaction, TransactionInspectionError } from "../services/transaction-inspector";

const requestSchema = z.object({
  chainId: z.number().int(),
  address: z.string().min(1).max(64).optional(),
  txHash: z.string().min(1).max(70).optional(),
  question: z.string().trim().min(1).max(500).optional(),
  history: z.array(z.object({ question: z.string().max(500), answer: z.string().max(1200) })).max(3).optional(),
}).refine((input) => Boolean(input.address) !== Boolean(input.txHash));

type Dependencies = { inspect: typeof inspectAddress; inspectTransaction?: typeof inspectTransaction; explain: typeof explainAddress };

export function createAddressExplainerRoute(deps: Dependencies = { inspect: inspectAddress, inspectTransaction, explain: explainAddress }) {
  const route = new Hono();
  route.use("/", bodyLimit({ maxSize: 6_000, onError: (c) => c.json({ error: "INVALID_INPUT", message: "Request is too large." }, 413) }));
  route.use("/", async (c, next) => {
    c.header("Cache-Control", "no-store");
    await next();
  });
  route.post("/", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "INVALID_INPUT", message: "Send a valid JSON request." }, 400);
    }
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: "INVALID_INPUT", message: "Choose a network and enter one address or transaction hash." }, 400);

    try {
      const inspection = parsed.data.txHash
        ? await (deps.inspectTransaction ?? inspectTransaction)({ chainId: parsed.data.chainId, txHash: parsed.data.txHash })
        : await deps.inspect({ chainId: parsed.data.chainId, address: parsed.data.address! });
      const answer = await deps.explain({ inspection, question: parsed.data.question, history: parsed.data.history });
      return c.json({ ...inspection, answer, aiStatus: answer ? "available" : "unavailable" });
    } catch (error) {
      if (error instanceof AddressInspectionError) {
        return c.json({ error: error.code, message: error.message }, error.code === "RPC_UNAVAILABLE" ? 503 : 400);
      }
      if (error instanceof TransactionInspectionError) {
        const status = error.code === "RPC_UNAVAILABLE" || error.code === "TRANSACTION_UNAVAILABLE" ? 503 : 400;
        return c.json({ error: error.code, message: error.message }, status);
      }
      return c.json({ error: "INSPECTION_UNAVAILABLE", message: "Blockchain data could not be checked right now. Please retry." }, 503);
    }
  });
  return route;
}

export const addressExplainerRoute = createAddressExplainerRoute();
