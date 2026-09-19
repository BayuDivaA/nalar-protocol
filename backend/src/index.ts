import { Hono } from "hono";
import { cors } from "hono/cors";

import { env } from "./config/env";
import { healthRoute } from "./routes/health";
import { transactionRoute } from "./routes/transactions";
import { securityRoute } from "./routes/security";

const app = new Hono();

const defaultLocalOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
];

const configuredOrigins = env.FRONTEND_ORIGIN
  ? env.FRONTEND_ORIGIN.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  : [];

const allowedOrigins = new Set([...defaultLocalOrigins, ...configuredOrigins]);

app.use(
  "/api/*",
  cors({
    origin: (origin) => {
      if (!origin) return "*";
      if (allowedOrigins.has(origin)) return origin;
      if (origin.startsWith("chrome-extension://") || origin.startsWith("moz-extension://")) {
        return origin;
      }
      return undefined;
    },
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
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

export default app;
