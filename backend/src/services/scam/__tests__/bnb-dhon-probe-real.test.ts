import { describe, expect, test, setDefaultTimeout } from "bun:test";

import { BnbChainMcpClient } from "../bnb-mcp-client";

setDefaultTimeout(20_000);

const SCAM_TOKEN = "0xe56E18ff683AbF6E1aA01804FaCaeB3694FDdd35";

function viewAbi(functionName: string, outputType: string): unknown[] {
  return [
    {
      type: "function",
      name: functionName,
      inputs: [],
      outputs: [
        {
          name: "",
          type: outputType,
        },
      ],
      stateMutability: "view",
    },
  ];
}

const probes = [
  {
    functionName: "owner",
    abi: viewAbi("owner", "address"),
  },
  {
    functionName: "sellTax",
    abi: viewAbi("sellTax", "uint256"),
  },
  {
    functionName: "buyTax",
    abi: viewAbi("buyTax", "uint256"),
  },
];

describe("REAL NalarDemoToken MCP probes", () => {
  test("reads owner and tax state through BNB MCP", async () => {
    const mcp = new BnbChainMcpClient();

    try {
      const results: Record<string, unknown> = {};

      for (const probe of probes) {
        const result = await mcp.readContract({
          contractAddress: SCAM_TOKEN,
          abi: probe.abi,
          functionName: probe.functionName,
          args: [],
          network: "bsc-testnet",
        });

        results[probe.functionName] = result;

        console.log(`\n✅ ${probe.functionName}()`, JSON.stringify(result, null, 2));
      }

      console.log("\n========== NALAR DEMO TOKEN ==========");
      console.log(JSON.stringify(results, null, 2));
      console.log("======================================\n");

      expect(results.owner).toBeDefined();
      expect(results.sellTax).toBeDefined();
      expect(results.buyTax).toBeDefined();
    } finally {
      await mcp.close();
    }
  });
});
