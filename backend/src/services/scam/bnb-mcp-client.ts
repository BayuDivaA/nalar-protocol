import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

type JsonObject = Record<string, unknown>;

export interface BnbMcpClient {
  connect(): Promise<void>;
  close(): Promise<void>;

  getErc20TokenInfo(input: { address: string; network: string }): Promise<unknown>;

  readContract(input: { contractAddress: string; abi: unknown[]; functionName: string; args?: unknown[]; network: string }): Promise<unknown>;
}

export class BnbChainMcpClient implements BnbMcpClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;

  async connect(): Promise<void> {
    if (this.client) {
      return;
    }

    const command = process.env.BNB_MCP_COMMAND ?? "npx";

    const packageName = process.env.BNB_MCP_PACKAGE ?? "@bnb-chain/mcp@latest";

    const client = new Client({
      name: "nalar-protocol-investigator",
      version: "1.0.0",
    });

    const transport = new StdioClientTransport({
      command,
      args: ["-y", packageName],
      env: {
        ...process.env,

        // Explicitly keep the investigator read-only.
        PRIVATE_KEY: "",
      },
    });

    await client.connect(transport);

    this.client = client;
    this.transport = transport;
  }

  async close(): Promise<void> {
    const client = this.client;

    this.client = null;
    this.transport = null;

    if (client) {
      await client.close();
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
}
