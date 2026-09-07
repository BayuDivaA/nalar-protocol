import { ai } from "../lib/ai-config";
import { env } from "../config/env";

const response = await ai.chat.completions.create({
  model: env.AI_MODEL,

  messages: [
    {
      role: "system",
      content: "You are a Web3 security assistant. Answer briefly.",
    },
    {
      role: "user",
      content: "Explain what an NFT mint is in one sentence.",
    },
  ],
});

console.log(response.choices[0]?.message?.content);
