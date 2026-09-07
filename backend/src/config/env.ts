import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),

  BNB_RPC_URL: z.string().url(),

  TXSENTRY_DEMO_NFT: z.string().regex(/^0x[a-fA-F0-9]{40}$/),

  AI_PROVIDER: z.enum(["gemini", "openrouter", "openai"]),

  AI_API_KEY: z.string().min(1),

  AI_MODEL: z.string().min(1),
});

export const env = envSchema.parse({
  PORT: Bun.env.PORT,

  BNB_RPC_URL: Bun.env.BNB_RPC_URL,

  TXSENTRY_DEMO_NFT: Bun.env.TXSENTRY_DEMO_NFT,

  AI_PROVIDER: Bun.env.AI_PROVIDER,

  AI_API_KEY: Bun.env.AI_API_KEY,

  AI_MODEL: Bun.env.AI_MODEL,
});
