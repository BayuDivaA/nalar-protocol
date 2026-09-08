import { z } from "zod";

const transactionActionSchema = z.enum(["TOKEN_APPROVAL", "NFT_APPROVAL", "TOKEN_TRANSFER", "TOKEN_TRANSFER_FROM", "NFT_TRANSFER", "MINT", "SWAP", "STAKE", "DEPOSIT", "WITHDRAW", "CLAIM", "REGISTER", "PAYMENT", "TRANSFER", "UNKNOWN"]);

export const policySchema = z.object({
  maxSpendBNB: z.string().regex(/^\d+(\.\d+)?$/),

  allowedActions: z.array(transactionActionSchema),

  forbiddenActions: z.array(transactionActionSchema),

  requireReviewAboveBNB: z.string().regex(/^\d+(\.\d+)?$/),
});

export type Policy = z.infer<typeof policySchema>;

export interface PolicyEvaluation {
  allowed: boolean;

  requiresReview: boolean;

  reasons: string[];
}
