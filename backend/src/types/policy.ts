import { z } from "zod";

export const policySchema = z.object({
  maxSpendBNB: z.string().regex(/^\d+(\.\d+)?$/),

  allowedActions: z.array(z.enum(["SWAP", "STAKE", "DEPOSIT", "WITHDRAW", "CLAIM", "REGISTER", "TOKEN_APPROVAL", "NFT_APPROVAL", "TOKEN_TRANSFER", "TOKEN_TRANSFER_FROM", "NFT_TRANSFER", "MINT", "UNKNOWN"])),

  forbiddenActions: z.array(z.enum(["SWAP", "STAKE", "DEPOSIT", "WITHDRAW", "CLAIM", "REGISTER", "TOKEN_APPROVAL", "NFT_APPROVAL", "TOKEN_TRANSFER", "TOKEN_TRANSFER_FROM", "NFT_TRANSFER", "MINT", "UNKNOWN"])),

  requireReviewAboveBNB: z.string().regex(/^\d+(\.\d+)?$/),
});

export type Policy = z.infer<typeof policySchema>;

export interface PolicyEvaluation {
  allowed: boolean;

  requiresReview: boolean;

  reasons: string[];
}
