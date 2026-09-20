import { z } from "zod";

export const securityEvidenceItemSchema = z.object({
  label: z.string(),
  value: z.string(),
  explanation: z.string(),
  source: z.enum(["ON-CHAIN", "SIMULATION", "TRANSACTION", "POLICY", "INTENT", "BNB_MCP"]),
});

export type SecurityEvidenceItem = z.infer<typeof securityEvidenceItemSchema>;

export const securityExplanationSchema = z.object({
  // Backward-compatible core fields
  title: z.string(),
  summary: z.string(),
  details: z.array(z.string()),
  recommendedAction: z.enum(["CANCEL", "REVIEW", "PROCEED"]),

  // Structured human-first fields for Phase 4
  headline: z.string().optional(),
  whyStopped: z
    .object({
      title: z.string(),
      primaryReason: z.string(),
      userImpact: z.string(),
    })
    .optional(),
  whatThisMeans: z.string().optional(),
  userIntent: z
    .object({
      summary: z.string(),
      action: z.string(),
      input: z.string().optional(),
      expectedOutput: z.string().optional(),
      status: z.enum(["MATCH", "MISMATCH", "UNKNOWN"]),
    })
    .optional(),
  actualTransaction: z
    .object({
      summary: z.string(),
      action: z.string(),
      input: z.string().optional(),
      output: z.string().optional(),
      target: z.string().optional(),
    })
    .optional(),
  comparison: z
    .object({
      status: z.enum(["MATCH", "MISMATCH", "UNKNOWN"]),
      summary: z.string(),
      details: z.array(z.string()).optional(),
    })
    .optional(),
  evidence: z.array(securityEvidenceItemSchema).optional(),
});

export type SecurityExplanation = z.infer<typeof securityExplanationSchema>;
