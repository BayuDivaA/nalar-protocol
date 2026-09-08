import { z } from "zod";

export const userIntentSchema = z.object({
  action: z.enum(["MINT", "TRANSFER", "SWAP", "APPROVE", "STAKE", "DEPOSIT", "WITHDRAW", "UNKNOWN"]),

  quantity: z.number().nullable(),

  /**
   * Token the user wants to spend.
   *
   * Example:
   * "USDT"
   */
  tokenIn: z.string().nullable(),

  /**
   * Token the user wants to receive.
   *
   * Example:
   * "BNB"
   */
  tokenOut: z.string().nullable(),

  maxValueNative: z.string().nullable(),

  nativeCurrency: z.enum(["BNB"]).nullable(),

  allowApproval: z.boolean(),

  targetAddress: z.string().nullable(),

  description: z.string(),
});

export type UserIntent = z.infer<typeof userIntentSchema>;
