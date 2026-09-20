import { Client, type Transport, SSEClientTransport } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

type JsonObject = Record<string, unknown>;

export interface BnbMcpClient {
  connect(): Promise<void>;
  close(): Promise<void>;

  getErc20TokenInfo(input: { address: string; network: string }): Promise<unknown>;

  readContract(input: { contractAddress: string; abi: unknown[]; functionName: string; args?: unknown[]; network: string }): Promise<unknown>;
  isContract(input: { address: string; network: string }): Promise<unknown>;

  getLatestBlock(input: { network: string }): Promise<unknown>;

  getTransaction(input: { txHash: string; network: string }): Promise<unknown>;

  getTransactionReceipt(input: { txHash: string; network: string }): Promise<unknown>;
}

export class BnbChainMcpClient implements BnbMcpClient {
  private client: Client | null = null;
  private transport: Transport | null = null;
  private connectPromise: Promise<void> | null = null;

  async connect(): Promise<void> {
    if (this.client) {
      return;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = (async () => {
      const transportMode = process.env.BNB_MCP_TRANSPORT ?? "stdio";

      console.log(`[MCP] Initializing client with transport: ${transportMode}`);

      const client = new Client({
        name: "nalar-protocol-investigator",
        version: "1.0.0",
      });

      let transport: Transport;

      if (transportMode === "sse" || transportMode === "http") {
        const urlStr = process.env.BNB_MCP_URL;
        if (!urlStr) {
          throw new Error("BNB_MCP_URL is required when BNB_MCP_TRANSPORT is 'sse' or 'http'.");
        }

        const authToken = process.env.MCP_AUTH_TOKEN || process.env.BNB_MCP_AUTH_TOKEN || process.env.BNB_MCP_SHARED_SECRET;
        const headers: Record<string, string> = {};

        if (authToken) {
          headers["Authorization"] = `Bearer ${authToken}`;
        }

        console.log(`[MCP] Connecting to remote SSE server at ${new URL(urlStr).origin}...`);

        transport = new SSEClientTransport(new URL(urlStr), {
          requestInit: { headers },
          authProvider: authToken
            ? {
                token: async () => authToken,
              }
            : undefined,
        });
      } else {
        const command = process.env.BNB_MCP_COMMAND ?? "npx";
        const packageName = process.env.BNB_MCP_PACKAGE ?? "@bnb-chain/mcp@latest";

        console.log(`[MCP] Spawning local official MCP process: ${command} ${packageName}...`);

        transport = new StdioClientTransport({
          command,
          args: ["-y", packageName],
          env: {
            ...process.env,
            PRIVATE_KEY: "", // Strictly read-only
          },
        });
      }

      transport.onclose = () => {
        console.log("[MCP] Transport closed. Resetting connection state.");
        this.client = null;
        this.transport = null;
      };

      transport.onerror = (error) => {
        console.warn("[MCP] Transport error:", error instanceof Error ? error.message : String(error));
        this.client = null;
        this.transport = null;
      };

      this.transport = transport;

      const defaultConnectTimeout = transportMode === "stdio" ? 30000 : 10000;
      const connectTimeoutMs = Number(process.env.MCP_CONNECT_TIMEOUT_MS || defaultConnectTimeout);
      let connectTimer: NodeJS.Timeout | undefined;
      const connectTimeoutPromise = new Promise<never>((_, reject) => {
        connectTimer = setTimeout(() => {
          reject(new Error(`BNB MCP connection timed out after ${connectTimeoutMs}ms`));
        }, connectTimeoutMs);
      });

      try {
        await Promise.race([client.connect(transport), connectTimeoutPromise]);
        console.log("[MCP] Connected successfully.");
        this.client = client;
      } catch (err) {
        try {
          if ("close" in transport && typeof (transport as { close?: () => Promise<void> }).close === "function") {
            await (transport as { close: () => Promise<void> }).close();
          }
        } catch {
          // ignore
        }
        this.client = null;
        this.transport = null;
        throw err;
      } finally {
        if (connectTimer) clearTimeout(connectTimer);
      }
    })();

    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  async close(): Promise<void> {
    const client = this.client;
    const transport = this.transport;

    this.client = null;
    this.transport = null;

    if (client) {
      try {
        await client.close();
      } catch {
        // Ignore close errors
      }
    }
    if (transport && "close" in transport && typeof (transport as { close?: () => Promise<void> }).close === "function") {
      try {
        await (transport as { close: () => Promise<void> }).close();
      } catch {
        // Ignore close errors
      }
    }
    console.log("[MCP] Disconnected.");
  }

  private async callTool(name: string, args: JsonObject): Promise<unknown> {
    await this.connect();

    if (!this.client) {
      throw new Error("BNB MCP client is not connected.");
    }

    const timeoutMs = Number(process.env.MCP_TIMEOUT_MS || 10000);

    const callPromise = this.client.callTool({
      name,
      arguments: args,
    });

    let toolTimer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      toolTimer = setTimeout(() => {
        reject(new Error(`BNB MCP tool call timed out after ${timeoutMs}ms: ${name}`));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([callPromise, timeoutPromise]);

      const text = result.content
        ?.filter((item) => item.type === "text")
        .map((item) => item.text)
        .join("\n");

      // MCP can report a logical contract-read failure inside
      // a successful tool response as plain text.
      if (result.isError) {
        throw new Error(text || `BNB MCP tool failed: ${name}`);
      }

      if (text && /Error reading contract:/i.test(text)) {
        throw new Error(text);
      }

      return result;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (/closed|disconnected|abort|not connected/i.test(errMsg)) {
        console.warn("[MCP] Connection lost during tool call. Resetting client state.");
        this.client = null;
        this.transport = null;
      }
      throw err;
    } finally {
      if (toolTimer) {
        clearTimeout(toolTimer);
      }
    }
  }

  async getErc20TokenInfo(input: { address: string; network: string }): Promise<unknown> {
    return this.callTool("get_erc20_token_info", {
      tokenAddress: input.address,
      network: input.network,
    });
  }

  async readContract(input: { contractAddress: string; abi: unknown[]; functionName: string; args?: unknown[]; network: string }): Promise<unknown> {
    return this.callTool("read_contract", {
      contractAddress: input.contractAddress,
      abi: input.abi,
      functionName: input.functionName,
      args: input.args ?? [],
      network: input.network,
    });
  }

  async isContract(input: { address: string; network: string }): Promise<unknown> {
    return this.callTool("is_contract", {
      address: input.address,
      network: input.network,
    });
  }

  async getLatestBlock(input: { network: string }): Promise<unknown> {
    return this.callTool("get_latest_block", {
      network: input.network,
    });
  }

  async getTransaction(input: { txHash: string; network: string }): Promise<unknown> {
    return this.callTool("get_transaction", {
      txHash: input.txHash,
      network: input.network,
    });
  }

  async getTransactionReceipt(input: { txHash: string; network: string }): Promise<unknown> {
    return this.callTool("get_transaction_receipt", {
      txHash: input.txHash,
      network: input.network,
    });
  }
}
