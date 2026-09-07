import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),

  BNB_RPC_URL: z.string().url().min(1),

  TXSENTRY_DEMO_NFT: z.string().regex(/^0x[a-fA-F0-9]{40}$/),

  OPENAI_API_KEY: z.string().min(1),

  OPENAI_MODEL: z.string().default("gpt-5.6"),
});

export const env = envSchema.parse({
  PORT: Bun.env.PORT,

  BNB_RPC_URL: Bun.env.BNB_RPC_URL,

  TXSENTRY_DEMO_NFT: Bun.env.TXSENTRY_DEMO_NFT,

  OPENAI_API_KEY: Bun.env.OPENAI_API_KEY,

  OPENAI_MODEL: Bun.env.OPENAI_MODEL,
});
