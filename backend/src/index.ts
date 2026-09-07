import { Hono } from "hono";
import { cors } from "hono/cors";

import { env } from "./config/env";
import { healthRoute } from "./routes/health";
import { transactionRoute } from "./routes/transactions";
import { securityRoute } from "./routes/security";

const app = new Hono();

app.use(
  "/api/*",
  cors({
    origin: "http://localhost:3000",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);

app.get("/", (c) => {
  return c.json({
    name: "TxSentry API",
    version: "0.1.0",
    description: "AI-powered transaction intent firewall for Web3",
  });
});

app.route("/health", healthRoute);
app.route("/api/transactions", transactionRoute);
app.route("/api/transactions/security-check", securityRoute);

export default {
  port: env.PORT,
  fetch: app.fetch,
};
