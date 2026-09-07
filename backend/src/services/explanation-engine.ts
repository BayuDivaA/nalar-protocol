import { ai } from "../lib/ai-config";
import { env } from "../config/env";

import { securityExplanationSchema, type SecurityExplanation } from "../types/explanation";

import { parseAIJson } from "../lib/parse-ai-json";

export async function generateSecurityExplanation(input: {
  intent: string;

  decision: string;

  riskLevel: string;

  riskScore: number;

  intentMatch: boolean;

  actualAction: string;

  actualFunction: string | null;

  reasons: string[];
}): Promise<SecurityExplanation> {
  const response = await ai.chat.completions.create({
    model: env.AI_MODEL,

    temperature: 0,

    messages: [
      {
        role: "system",

        content: `
You are a Web3 security explanation assistant.

Your job is to explain a deterministic
security decision to a normal human.

Do NOT make a new security decision.

Do NOT change the provided decision.

Do NOT invent facts.

Use only the provided information.

Return JSON only:

{
  "title": string,
  "summary": string,
  "details": string[],
  "recommendedAction":
    "CANCEL" | "REVIEW" | "PROCEED"
}

Rules:

- Use simple language.
- Avoid blockchain jargon where possible.
- Explain what the user intended.
- Explain what the transaction actually does.
- Explain why the security engine made its decision.
- If decision is BLOCK, recommendedAction
  must be CANCEL.
- If decision is REVIEW, recommendedAction
  must be REVIEW.
- If decision is ALLOW, recommendedAction
  must be PROCEED.
`,
      },

      {
        role: "user",

        content: JSON.stringify(input),
      },
    ],
  });

  const raw = response.choices[0]?.message?.content;

  if (!raw) {
    throw new Error("AI returned empty explanation.");
  }

  const json = parseAIJson(raw);

  const parsed = securityExplanationSchema.safeParse(json);

  if (!parsed.success) {
    console.error(parsed.error.flatten());

    throw new Error("AI returned invalid explanation schema.");
  }

  return parsed.data;
}
