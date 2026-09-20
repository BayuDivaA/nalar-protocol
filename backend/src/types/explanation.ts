import { z } from "zod";

export const securityEvidenceItemSchema = z.object({
  label: z.string(),
  value: z.string(),
  explanation: z.string(),
  source: z.preprocess(
    (val) => {
      const str = String(val || "")
        .toUpperCase()
        .replace(/[-\s]/g, "_");
      if (str.includes("CHAIN")) return "ON-CHAIN";
      if (str.includes("SIM")) return "SIMULATION";
      if (str.includes("TX") || str.includes("TRANS")) return "TRANSACTION";
      if (str.includes("POLIC") || str.includes("RULE")) return "POLICY";
      if (str.includes("INTENT")) return "INTENT";
      if (str.includes("MCP") || str.includes("BNB")) return "BNB_MCP";
      return "POLICY";
    },
    z.enum(["ON-CHAIN", "SIMULATION", "TRANSACTION", "POLICY", "INTENT", "BNB_MCP"]),
  ),
});

export type SecurityEvidenceItem = z.infer<typeof securityEvidenceItemSchema>;

export const securityExplanationSchema = z.object({
  // Backward-compatible core fields
  title: z.string(),
  summary: z.string(),
  details: z.preprocess((val) => {
    if (typeof val === "string") return [val];
    if (Array.isArray(val)) return val.map(String);
    return [];
  }, z.array(z.string())),
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
      details: z.preprocess((val) => {
        if (typeof val === "string") return [val];
        if (Array.isArray(val)) return val.map(String);
        return undefined;
      }, z.array(z.string()).optional()),
    })
    .optional(),
  evidence: z.array(securityEvidenceItemSchema).optional(),

  // Diagnostic generator metadata (developer-facing)
  meta: z
    .object({
      generator: z.enum(["AI", "DETERMINISTIC"]),
      provider: z.string().optional(),
      model: z.string().optional(),
      fallbackReason: z.string().optional(),
    })
    .optional(),
});

export type SecurityExplanation = z.infer<typeof securityExplanationSchema>;
