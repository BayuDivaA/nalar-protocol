import http from "node:http";
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { BnbChainMcpClient } from "../bnb-mcp-client";
import { BnbAgentInvestigator } from "../bnb-agent-investigator";
import type { Address } from "viem";

describe("BnbChainMcpClient Remote Transport & Authentication", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("throws error when BNB_MCP_TRANSPORT is 'sse' but BNB_MCP_URL is missing", async () => {
    process.env.BNB_MCP_TRANSPORT = "sse";
    delete process.env.BNB_MCP_URL;
    delete process.env.MCP_AUTH_TOKEN;

    const client = new BnbChainMcpClient();
    await expect(client.connect()).rejects.toThrow("BNB_MCP_URL is required when BNB_MCP_TRANSPORT is 'sse'");
  });

  test("handles connection failure gracefully when remote SSE endpoint is unreachable", async () => {
    process.env.BNB_MCP_TRANSPORT = "sse";
    process.env.BNB_MCP_URL = "http://127.0.0.1:59999/sse";
    process.env.MCP_AUTH_TOKEN = "test-token";
    process.env.MCP_CONNECT_TIMEOUT_MS = "400";

    const client = new BnbChainMcpClient();
    await expect(client.connect()).rejects.toBeDefined();
    await client.close();
  });

  test("BnbChainMcpClient close handles uninitialized client safely", async () => {
    const client = new BnbChainMcpClient();
    await expect(client.close()).resolves.toBeUndefined();
  });

  test("BnbChainMcpClient callTool throws error if connect fails", async () => {
    process.env.BNB_MCP_TRANSPORT = "sse";
    process.env.BNB_MCP_URL = "http://127.0.0.1:59999/sse";
    process.env.MCP_AUTH_TOKEN = "test-token";
    process.env.MCP_CONNECT_TIMEOUT_MS = "400";

    const client = new BnbChainMcpClient();
    await expect(
      client.getErc20TokenInfo({
        address: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd",
        network: "bsc-testnet",
      }),
    ).rejects.toBeDefined();
    await client.close();
  });

  test("sends Bearer auth header when connecting to remote SSE endpoint", async () => {
    const SECRET = "secret-token-abc-123";
    let authHeaderReceived: string | undefined;

    const server = http.createServer((req, res) => {
      authHeaderReceived = req.headers.authorization;
      if (req.url === "/sse") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        res.write(`event: endpoint\ndata: /messages?sessionId=mock-1\n\n`);
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as { port: number }).port;

    try {
      process.env.BNB_MCP_TRANSPORT = "sse";
      process.env.BNB_MCP_URL = `http://127.0.0.1:${port}/sse`;
      process.env.MCP_AUTH_TOKEN = SECRET;
      process.env.MCP_CONNECT_TIMEOUT_MS = "500";

      const client = new BnbChainMcpClient();
      // connect() initiates the SSE connection which carries the Authorization header
      try {
        await client.connect();
      } catch {
        // Mock server doesn't fully complete JSON-RPC init, but SSE handshake was made
      }
      expect(authHeaderReceived).toBe(`Bearer ${SECRET}`);
      await client.close();
    } finally {
      server.close();
    }
  });

  test("enforces tool call timeout when remote tool call hangs", async () => {
    process.env.MCP_TIMEOUT_MS = "150";

    const client = new BnbChainMcpClient();

    // Mock internal client to simulate a hanging tool call
    (client as unknown as { client: unknown }).client = {
      callTool: () =>
        new Promise(() => {
          // Intentionally never resolves
        }),
    };

    await expect((client as unknown as { callTool: (name: string, args: Record<string, unknown>) => Promise<unknown> }).callTool("is_contract", { address: "0x123", network: "bsc-testnet" })).rejects.toThrow(
      "timed out after 150ms: is_contract",
    );
  });
});
