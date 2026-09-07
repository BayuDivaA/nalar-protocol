import { z } from "zod";

export const securityExplanationSchema = z.object({
  title: z.string(),

  summary: z.string(),

  details: z.array(z.string()),

  recommendedAction: z.enum(["CANCEL", "REVIEW", "PROCEED"]),
});

export type SecurityExplanation = z.infer<typeof securityExplanationSchema>;
