/// <reference types="node" />

import { z } from "zod";

const envSchema = z
  .object({
    PORT: z.coerce.number().default(3000),

    BNB_RPC_URL: z.string().url("BNB_RPC_URL must be a valid RPC URL").default("https://data-seed-prebsc-1-s1.binance.org:8545"),

    TXSENTRY_DEMO_NFT: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "TXSENTRY_DEMO_NFT must be a 20-byte hex address")
      .default("0x0000000000000000000000000000000000000000"),

    AI_PROVIDER: z.enum(["gemini", "openrouter", "openai", "heuristics"]).default("heuristics"),

    AI_API_KEY: z.string().optional().default(""),

    AI_MODEL: z.string().optional().default("gemini-1.5-flash"),

    BNB_INVESTIGATOR_ENABLED: z
      .string()
      .optional()
      .default("false")
      .transform((val) => val === "true"),

    BNB_MCP_TRANSPORT: z.enum(["stdio", "sse", "http"]).default(process.env.VERCEL === "1" ? "sse" : "stdio"),

    BNB_MCP_URL: z.string().url("BNB_MCP_URL must be a valid URL").optional(),

    MCP_AUTH_TOKEN: z.string().min(1).optional(),

    FRONTEND_ORIGIN: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const isRemote = data.BNB_MCP_TRANSPORT === "sse" || data.BNB_MCP_TRANSPORT === "http";
    if (data.BNB_INVESTIGATOR_ENABLED && isRemote) {
      if (!data.BNB_MCP_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["BNB_MCP_URL"],
          message: "BNB_MCP_URL is required when BNB_MCP_TRANSPORT is 'sse' or 'http'",
        });
      }
      const token = data.MCP_AUTH_TOKEN || process.env.BNB_MCP_AUTH_TOKEN || process.env.BNB_MCP_SHARED_SECRET;
      if (!token) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["MCP_AUTH_TOKEN"],
          message: "MCP_AUTH_TOKEN is required when BNB_MCP_TRANSPORT is 'sse' or 'http'",
        });
      }
    }
  });

const rawEnv = {
  PORT: process.env.PORT,
  BNB_RPC_URL: process.env.BNB_RPC_URL,
  TXSENTRY_DEMO_NFT: process.env.TXSENTRY_DEMO_NFT,
  AI_PROVIDER: process.env.AI_PROVIDER,
  AI_API_KEY: process.env.AI_API_KEY,
  AI_MODEL: process.env.AI_MODEL,
  BNB_INVESTIGATOR_ENABLED: process.env.BNB_INVESTIGATOR_ENABLED,
  BNB_MCP_TRANSPORT: process.env.BNB_MCP_TRANSPORT,
  BNB_MCP_URL: process.env.BNB_MCP_URL,
  MCP_AUTH_TOKEN: process.env.MCP_AUTH_TOKEN ?? process.env.BNB_MCP_AUTH_TOKEN ?? process.env.BNB_MCP_SHARED_SECRET,
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN,
};

const parsed = envSchema.safeParse(rawEnv);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
  console.warn(`[WARN] Environment configuration warnings:\n${issues}\n`);
}

export const env = parsed.success
  ? parsed.data
  : {
      PORT: Number(process.env.PORT) || 3000,
      BNB_RPC_URL: process.env.BNB_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545",
      TXSENTRY_DEMO_NFT: process.env.TXSENTRY_DEMO_NFT || "0x0000000000000000000000000000000000000000",
      AI_PROVIDER: ((process.env.AI_PROVIDER as any) || "heuristics") as "gemini" | "openrouter" | "openai" | "heuristics",
      AI_API_KEY: process.env.AI_API_KEY || "",
      AI_MODEL: process.env.AI_MODEL || "gemini-1.5-flash",
      BNB_INVESTIGATOR_ENABLED: process.env.BNB_INVESTIGATOR_ENABLED === "true",
      BNB_MCP_TRANSPORT: (process.env.BNB_MCP_TRANSPORT as any) || (process.env.VERCEL === "1" ? "sse" : "stdio"),
      BNB_MCP_URL: process.env.BNB_MCP_URL,
      MCP_AUTH_TOKEN: process.env.MCP_AUTH_TOKEN ?? process.env.BNB_MCP_AUTH_TOKEN ?? process.env.BNB_MCP_SHARED_SECRET,
      FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN,
    };

export type Env = typeof env;
