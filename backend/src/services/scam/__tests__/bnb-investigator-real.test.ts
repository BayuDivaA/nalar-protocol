import { test, expect } from "bun:test";
import type { ContractEvidence } from "../evidence-provider";
import { BnbAgentInvestigator } from "../bnb-agent-investigator";

const ENABLED = process.env.BNB_MCP_REAL_TEST === "true";

test("real BNB investigator enriches token through MCP", async () => {
  if (!ENABLED) {
    console.log("Skipped: set BNB_MCP_REAL_TEST=true to run real investigator integration.");
    return;
  }

  const investigator = new BnbAgentInvestigator();

  const evidence: ContractEvidence = {
    verified: true,
    proxy: false,
    implementation: null,
    owner: null,
    codeAvailable: true,
    capabilities: [],
    accessControl: [],
    state: [],
  };

  const result = await investigator.investigate({
    chainId: 97,
    token: "0xae13d989dac2f0debff460ac112a837c89baa7cd",
    evidence,
  });

  expect(result.summary).toBeTypeOf("string");
  expect(result.summary).toContain("BNB investigation completed.");

  console.log("\nREAL INVESTIGATOR RESULT:\n");
  console.log(result.summary);
}, 30_000);
