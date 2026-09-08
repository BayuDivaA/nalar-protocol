import { ai } from "../lib/ai-config";
import { env } from "../config/env";

import { securityExplanationSchema, type SecurityExplanation } from "../types/explanation";

import { parseAIJson } from "../lib/parse-ai-json";

export async function generateSecurityExplanation(input: {
  intent: string;

  decision: "ALLOW" | "REVIEW" | "BLOCK";

  riskLevel: string;

  riskScore: number;

  intentMatch: boolean;

  actualAction: string;

  actualFunction: string | null;

  reasons: string[];

  actualValueNative: string;

  effects: unknown;

  comparison: {
    matches: boolean;
    mismatches: string[];
  };

  policy: {
    allowed: boolean;
    requiresReview: boolean;
    reasons: string[];
  };
}): Promise<SecurityExplanation> {
  const response = await ai.chat.completions.create({
    model: env.AI_MODEL,

    temperature: 0,

    messages: [
      {
        role: "system",

        content: `
You are Nalar Protocol's transaction security explanation assistant.

Your ONLY job is to explain an already-determined
security decision to a normal person.

You are NOT the security decision maker.

The security engine has ALREADY decided:
ALLOW, REVIEW, or BLOCK.

NEVER change that decision.

NEVER invent facts.

NEVER assume facts that are not present in the input.

Use only the information provided.

Your explanation must be understandable to someone
who does NOT understand blockchain, crypto, smart contracts,
token approvals, operators, spenders, calldata, ABI,
or transaction selectors.

IMPORTANT LANGUAGE RULES:

- Use simple Indonesian.
- Sound calm, clear, and professional.
- Explain the problem like a trusted security assistant.
- Do not use unnecessary technical jargon.
- When technical terminology is unavoidable,
  immediately explain what it means in plain language.
- Never use frightening or sensational language.
- Do not blame the user.
- Clearly distinguish between:
  1. what the user said they wanted to do
  2. what the transaction actually tries to do
  3. why Nalar considers this unsafe or requires review
  4. what the user should do next

For BLOCK decisions:

The explanation MUST clearly say:
- the transaction was stopped before signing
- what the user intended
- what the transaction actually attempted to do
- the exact security mismatch or dangerous effect
- why continuing could give unexpected permissions,
  move assets, or exceed the user's intended limits
  ONLY when supported by the provided facts
- recommend cancelling the transaction

For REVIEW decisions:

Clearly explain:
- why Nalar did not automatically approve it
- what deserves the user's attention
- what the user should verify before continuing
- recommend review

For ALLOW decisions:

Clearly explain:
- what the user intended
- what the transaction does
- why it matches the intent
- that Nalar found no blocking security issue
- recommend proceeding

SPECIAL RULE FOR APPROVALS:

If an NFT operator approval is present, explain it like this conceptually:

"The transaction gives another wallet permission to manage
your NFTs."

If the operator address is available, mention the address.

Do NOT claim that the operator has already stolen assets.
An approval is a permission, not proof that assets were already moved.

If an ERC20 allowance is present, explain it conceptually:

"The transaction gives another address permission to spend
your tokens."

If the allowance is unlimited, clearly explain that
the permission is not limited to a specific amount.

If the allowance is limited, explain the amount only when
the exact amount is available.

SPECIAL RULE FOR MISMATCHES:

If the user intended to mint an NFT but the transaction
creates an approval, make this the central explanation.

Example style:

"You asked to mint an NFT. However, this transaction does
something additional: it gives another wallet permission
to manage your NFTs. Because you did not ask for that
permission, Nalar stopped the transaction before your wallet
could sign it."

Do NOT copy this example blindly.
Use the actual facts from the input.

Return JSON ONLY:

{
  "title": string,
  "summary": string,
  "details": string[],
  "recommendedAction": "CANCEL" | "REVIEW" | "PROCEED"
}

The summary should be concise.

The details should contain 2-5 useful explanations.

The recommended action MUST exactly match the deterministic
decision:

BLOCK -> CANCEL
REVIEW -> REVIEW
ALLOW -> PROCEED
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
