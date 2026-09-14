import { describe, expect, test } from "bun:test";
import type { Address } from "viem";

import { BnbAgentInvestigator } from "../bnb-agent-investigator";
import type { BnbMcpClient } from "../bnb-mcp-client";

import type { ContractEvidence } from "../evidence-provider";

const TOKEN = "0x1111111111111111111111111111111111111111" as Address;

function createEvidence(): ContractEvidence {
  return {
    verified: false,
    proxy: null,
    implementation: null,
    owner: null,
    codeAvailable: false,
    capabilities: [],
    accessControl: [],
    state: [],
  };
}

describe("BNB investigator fallback probes", () => {
  test("probes common read-only getters when capabilities are unavailable", async () => {
    const calls: string[] = [];

    const mcp: BnbMcpClient = {
      async connect() {},
      async close() {},

      async getErc20TokenInfo() {
        return {
          name: "Demo Honeypot Token",
          symbol: "DHON",
          decimals: 18,
        };
      },

      async readContract(input) {
        calls.push(input.functionName);

        switch (input.functionName) {
          case "owner":
            return {
              content: [
                {
                  type: "text",
                  text: "0x2222222222222222222222222222222222222222",
                },
              ],
            };

          case "sellTax":
            return {
              content: [
                {
                  type: "text",
                  text: "98",
                },
              ],
            };

          default:
            throw new Error(`${input.functionName}() does not exist`);
        }
      },
    };

    const investigator = new BnbAgentInvestigator(mcp);

    const result = await investigator.investigate({
      chainId: 97,
      token: TOKEN,
      evidence: createEvidence(),
    });

    expect(calls.length).toBe(7);

    expect(calls).toContain("owner");
    expect(calls).toContain("sellTax");
    expect(calls).toContain("buyTax");
    expect(calls).toContain("paused");
    expect(calls).toContain("tradingEnabled");
    expect(calls).toContain("maxTx");
    expect(calls).toContain("maxWallet");

    expect(result.state).toBeDefined();

    expect(result.state?.some((item) => item.code === "CURRENT_SELL_TAX" && item.value === "98" && item.status === "KNOWN")).toBe(true);

    expect(result.summary).toContain("MCP contract state sellTax()");
  });
});
