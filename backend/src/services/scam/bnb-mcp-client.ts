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

      const client = new Client({
        name: "nalar-protocol-investigator",
        version: "1.0.0",
      });

      let transport: Transport;

      if (transportMode === "http") {
        const urlStr = process.env.BNB_MCP_URL || "http://localhost:8000/sse";
        transport = new SSEClientTransport(new URL(urlStr));
      } else {
        const command = process.env.BNB_MCP_COMMAND ?? "npx";
        const packageName = process.env.BNB_MCP_PACKAGE ?? "@bnb-chain/mcp@latest";

        transport = new StdioClientTransport({
          command,
          args: ["-y", packageName],
          env: {
            ...process.env,
            PRIVATE_KEY: "",
          },
        });
      }

      await client.connect(transport);

      this.client = client;
      this.transport = transport;
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
  }

  private async callTool(name: string, args: JsonObject): Promise<unknown> {
    await this.connect();

    if (!this.client) {
      throw new Error("BNB MCP client is not connected.");
    }

    const result = await this.client.callTool({
      name,
      arguments: args,
    });

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
