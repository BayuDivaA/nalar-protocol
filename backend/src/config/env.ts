/// <reference types="node" />

import { z } from "zod";

const envSchema = z
  .object({
    PORT: z.coerce.number().default(3000),

    BNB_RPC_URL: z.string().url("BNB_RPC_URL must be a valid RPC URL"),

    TXSENTRY_DEMO_NFT: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "TXSENTRY_DEMO_NFT must be a 20-byte hex address"),

    AI_PROVIDER: z.enum(["gemini", "openrouter", "openai"]),

    AI_API_KEY: z.string().min(1, "AI_API_KEY is required"),

    AI_MODEL: z.string().min(1, "AI_MODEL is required"),

    BNB_INVESTIGATOR_ENABLED: z
      .string()
      .optional()
      .default("false")
      .transform((val) => val === "true"),

    BNB_MCP_TRANSPORT: z.enum(["stdio", "sse", "http"]).default("stdio"),

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
  MCP_AUTH_TOKEN: process.env.MCP_AUTH_TOKEN ?? process.env.BNB_MCP_AUTH_TOKEN ?? process.env.BNB_MCP_SHARED_SECRET,
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN,
});

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
  console.error(`\n[FATAL] Invalid environment configuration:\n${issues}\n`);
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
