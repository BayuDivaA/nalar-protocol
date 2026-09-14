import { describe, expect, test } from "bun:test";
import type { Address } from "viem";

import { BnbAgentInvestigator } from "../bnb-agent-investigator";

const SCAM_TOKEN = "0xe56E18ff683AbF6E1aA01804FaCaeB3694FDdd35" as Address;

describe("REAL NALAR ScamToken investigator", () => {
  test("BNB MCP state becomes deterministic evidence", async () => {
    const investigator = new BnbAgentInvestigator();

    const result = await investigator.investigate({
      chainId: 97,
      token: SCAM_TOKEN,
      evidence: {
        verified: false,
        proxy: false,
        implementation: null,
        owner: null,
        codeAvailable: true,
        capabilities: [],
        accessControl: [],
        state: [],
      },
    });

    console.log("\n========== REAL INVESTIGATOR ==========");
    console.log(result.summary);
    console.log("\nSTATE:");
    console.log(JSON.stringify(result.state, null, 2));
    console.log("\nOWNER:");
    console.log(result.owner);
    console.log("=======================================\n");

    expect(result.summary).toContain("BNB investigation completed.");

    expect(result.owner).toBe("0x53E993819F2Bc45A029615e8634BDdEEab4F7817");

    expect(result.state?.some((item) => item.code === "CURRENT_SELL_TAX" && item.value === "9800" && item.unit === "PERCENT" && item.status === "KNOWN")).toBe(true);

    expect(result.state?.some((item) => item.code === "CURRENT_BUY_TAX" && item.value === "0" && item.status === "KNOWN")).toBe(true);
  });
});
