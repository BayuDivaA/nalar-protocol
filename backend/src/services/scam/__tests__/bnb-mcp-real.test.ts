import { test, expect } from "bun:test";

import {
  BnbChainMcpClient,
} from "../bnb-mcp-client";

const ENABLED =
  process.env.BNB_MCP_REAL_TEST === "true";

test(
  "real BNB MCP can read token information",
  async () => {
    if (!ENABLED) {
      console.log(
        "Skipped: set BNB_MCP_REAL_TEST=true to run real MCP integration.",
      );
      return;
    }

    const client = new BnbChainMcpClient();

    try {
      await client.connect();

      const result =
        await client.getErc20TokenInfo({
          address:
            "0xae13d989dac2f0debff460ac112a837c89baa7cd",
          network: "bsc-testnet",
        });

      expect(result).toBeDefined();

      console.log(
        "BNB MCP result:",
        JSON.stringify(
          result,
          null,
          2,
        ),
      );
    } finally {
      await client.close();
    }
  },
  30_000,
);