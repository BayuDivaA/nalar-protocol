/// <reference types="node" />

import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),

  BNB_RPC_URL: z.string().url("BNB_RPC_URL must be a valid RPC URL"),

  TXSENTRY_DEMO_NFT: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "TXSENTRY_DEMO_NFT must be a 20-byte hex address"),

  AI_PROVIDER: z.enum(["gemini", "openrouter", "openai"]),

  AI_API_KEY: z.string().min(1, "AI_API_KEY is required"),

  AI_MODEL: z.string().min(1, "AI_MODEL is required"),

  BNB_INVESTIGATOR_ENABLED: z
    .string()
    .optional()
    .default("false")
    .transform((val) => val === "true"),

  BNB_MCP_TRANSPORT: z.enum(["stdio", "http"]).default("stdio"),

  BNB_MCP_URL: z.string().url("BNB_MCP_URL must be a valid URL").optional(),

  FRONTEND_ORIGIN: z.string().optional(),
});

const parsed = envSchema.safeParse({
  PORT: process.env.PORT,
  BNB_RPC_URL: process.env.BNB_RPC_URL,
  TXSENTRY_DEMO_NFT: process.env.TXSENTRY_DEMO_NFT,
  AI_PROVIDER: process.env.AI_PROVIDER,
  AI_API_KEY: process.env.AI_API_KEY,
  AI_MODEL: process.env.AI_MODEL,
  BNB_INVESTIGATOR_ENABLED: process.env.BNB_INVESTIGATOR_ENABLED,
  BNB_MCP_TRANSPORT: process.env.BNB_MCP_TRANSPORT,
  BNB_MCP_URL: process.env.BNB_MCP_URL,
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN,
});

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  console.error(`\n[FATAL] Invalid environment configuration:\n${issues}\n`);
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
