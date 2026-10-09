// @ts-expect-error Bun supplies the test module at runtime.
import { describe, expect, test } from "bun:test";

import { encodeAbiParameters, encodeEventTopics, encodeFunctionData, parseAbi, type PublicClient } from "viem";

import { inspectTransaction } from "../transaction-inspector";
import type { BnbMcpClient } from "../scam/bnb-mcp-client";

const hash = `0x${"a".repeat(64)}` as `0x${string}`;
const from = "0x1111111111111111111111111111111111111111";
const token = "0x2222222222222222222222222222222222222222";
const spender = "0x3333333333333333333333333333333333333333";
const abi = parseAbi(["function approve(address spender,uint256 amount) returns (bool)"]);
const input = encodeFunctionData({ abi, functionName: "approve", args: [spender, 25n] });

function client(chainId: number, receipt: boolean = true): PublicClient {
  return {
    getChainId: async () => chainId,
    getTransaction: async () => ({ hash, from, to: token, value: 0n, input, blockNumber: 123n, nonce: 7 }),
    getTransactionReceipt: async () => {
      if (!receipt) throw new Error("Receipt unavailable");
      return { transactionHash: hash, status: "success", blockNumber: 123n, gasUsed: 30_000n, effectiveGasPrice: 1_000_000_000n, logs: [] };
    },
    getBlock: async () => ({ timestamp: 1_760_000_000n }),
  } as unknown as PublicClient;
}

const resolveAbi = async ({ chainId }: { chainId: number }) => ({ found: true as const, contract: { address: token as `0x${string}`, chainId, abi, source: "sourcify" as const, verified: true } });

const transferAbi = parseAbi(["event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)"]);
const mintLog = { address: token, data: "0x", topics: encodeEventTopics({ abi: transferAbi, eventName: "Transfer", args: { from: "0x0000000000000000000000000000000000000000", to: from, tokenId: 3n } }) };

function mintClient(status = "success", logs: unknown[] = [mintLog]): PublicClient {
  return {
    ...client(97),
    getTransaction: async () => ({ hash, from, to: token, value: 20_000_000_000_000_000n, input: "0x6871ee40", blockNumber: 123n, nonce: 7 }),
    getTransactionReceipt: async () => ({ transactionHash: hash, status, blockNumber: 123n, gasUsed: 30_000n, effectiveGasPrice: 1_000_000_000n, logs }),
  } as unknown as PublicClient;
}

describe("Transaction inspection", () => {
  test.each([56, 97] as const)("reads chain %i transaction and decoded call without a security verdict", async (chainId) => {
    const report = await inspectTransaction({ chainId, txHash: hash }, { clientFactory: () => client(chainId), resolveAbi, mcpEnabled: false });
    expect(report.kind).toBe("transaction");
    expect(report.chainId).toBe(chainId);
    expect(report.explorerUrl).toBe(`${chainId === 56 ? "https://bscscan.com" : "https://testnet.bscscan.com"}/tx/${hash}`);
    expect(report.facts.find((fact) => fact.id === "from")?.value).toBe(from);
    expect(report.facts.find((fact) => fact.id === "to")?.value).toBe(token);
    expect(report.facts.find((fact) => fact.id === "function")?.value).toBe("approve");
    expect(report.facts.find((fact) => fact.id === "argument_spender")?.value).toBe(spender);
    expect(report.facts.find((fact) => fact.id === "execution")?.value).toBe("Executed");
    expect(JSON.stringify(report)).not.toContain("riskScore");
  });

  test("wrong RPC chain and malformed hash are rejected before any result", async () => {
    await expect(inspectTransaction({ chainId: 56, txHash: hash }, { clientFactory: () => client(97) })).rejects.toMatchObject({ code: "RPC_UNAVAILABLE" });
    await expect(inspectTransaction({ chainId: 56, txHash: "0xabc" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  test("missing receipt is unknown, not a successful transaction", async () => {
    const report = await inspectTransaction({ chainId: 56, txHash: hash }, { clientFactory: () => client(56, false), resolveAbi, mcpEnabled: false });
    expect(report.facts.some((fact) => fact.id === "execution")).toBe(false);
    expect(report.unknowns.join(" ")).toContain("receipt");
  });

  test("BNB MCP evidence is ignored when it belongs to another transaction", async () => {
    const mcp = {
      getTransaction: async () => ({ content: [{ type: "text", text: JSON.stringify({ hash: `0x${"b".repeat(64)}`, from, to: token }) }] }),
      getTransactionReceipt: async () => ({ content: [{ type: "text", text: JSON.stringify({ transactionHash: hash }) }] }),
      close: async () => {},
    } as unknown as BnbMcpClient;
    const report = await inspectTransaction({ chainId: 56, txHash: hash }, { clientFactory: () => client(56), resolveAbi, mcpClientFactory: () => mcp, mcpEnabled: true });
    expect(report.sources.mcp).toBe("unavailable");
    expect(report.facts.some((fact) => fact.source === "BNB_MCP")).toBe(false);
  });

  test("BNB MCP confirms only the current hash on the selected network", async () => {
    const requests: Array<{ txHash: string; network: string }> = [];
    const mcp = {
      getTransaction: async (request: { txHash: string; network: string }) => {
        requests.push(request);
        return { content: [{ type: "text", text: JSON.stringify({ hash, from, to: token, chainId: 97 }) }] };
      },
      getTransactionReceipt: async (request: { txHash: string; network: string }) => {
        requests.push(request);
        return { content: [{ type: "text", text: JSON.stringify({ transactionHash: hash, chainId: 97 }) }] };
      },
      close: async () => {},
    } as unknown as BnbMcpClient;
    const report = await inspectTransaction({ chainId: 97, txHash: hash }, { clientFactory: () => client(97), resolveAbi, mcpClientFactory: () => mcp, mcpEnabled: true });
    expect(report.sources.mcp).toBe("available");
    expect(report.facts.find((fact) => fact.id === "mcp_lookup")?.value).toBe("Matched this transaction");
    expect(requests).toEqual([{ txHash: hash, network: "bsc-testnet" }, { txHash: hash, network: "bsc-testnet" }]);
  });

  test("ABI for another contract is not used to decode this transaction", async () => {
    const wrongAbi = async ({ chainId }: { chainId: number }) => ({ found: true as const, contract: { address: spender as `0x${string}`, chainId, abi, source: "sourcify" as const, verified: true } });
    const report = await inspectTransaction({ chainId: 56, txHash: hash }, { clientFactory: () => client(56), resolveAbi: wrongAbi, mcpEnabled: false });
    expect(report.facts.some((fact) => fact.id === "function")).toBe(false);
    expect(report.unknowns.join(" ")).toContain("interface");
  });

  test("missing full ABI still exposes a qualified local call match and the recorded NFT mint", async () => {
    const report = await inspectTransaction({ chainId: 97, txHash: hash }, { clientFactory: () => mintClient(), resolveAbi: async () => ({ found: false }), mcpEnabled: false });
    expect(report.sources.abi).toBe("unavailable");
    expect(report.facts.find((fact) => fact.id === "function_candidate")?.value).toBe("safeMint()");
    expect(report.facts.some((fact) => fact.id === "function")).toBe(false);
    expect(report.facts.find((fact) => fact.id === "event_0_action")?.value).toBe("Mint record (ERC-721 layout)");
    expect(report.facts.find((fact) => fact.id === "event_0_token_id")?.value).toBe("3");
    expect(report.facts.find((fact) => fact.id === "event_0_to")?.addressUrl).toBe(`https://testnet.bscscan.com/address/${from}`);
    expect(report.unknowns.join(" ")).toContain("implementation");
  });

  test("local signatures reject non-canonical calldata rather than inventing a function", async () => {
    const custom = { ...mintClient(), getTransaction: async () => ({ hash, from, to: token, value: 0n, input: "0x6871ee4000", blockNumber: null, nonce: 7 }) } as unknown as PublicClient;
    const report = await inspectTransaction({ chainId: 97, txHash: hash }, { clientFactory: () => custom, resolveAbi: async () => ({ found: false }), mcpEnabled: false });
    expect(report.facts.some((fact) => fact.id === "function_candidate")).toBe(false);
    expect(report.facts.some((fact) => fact.id.startsWith("event_"))).toBe(false);
  });

  test("reverted execution does not report a mint even if an RPC supplies logs", async () => {
    const report = await inspectTransaction({ chainId: 97, txHash: hash }, { clientFactory: () => mintClient("reverted"), resolveAbi: async () => ({ found: false }), mcpEnabled: false });
    expect(report.facts.find((fact) => fact.id === "execution")?.value).toBe("Reverted");
    expect(report.facts.some((fact) => fact.id.startsWith("event_"))).toBe(false);
  });

  test("ERC20 Transfer amounts stay in raw units and are not treated as NFT IDs", async () => {
    const erc20 = parseAbi(["event Transfer(address indexed from,address indexed to,uint256 value)"]);
    const log = { address: spender, topics: encodeEventTopics({ abi: erc20, eventName: "Transfer", args: { from, to: token } }), data: encodeAbiParameters([{ type: "uint256" }], [25n]) };
    const report = await inspectTransaction({ chainId: 97, txHash: hash }, { clientFactory: () => mintClient("success", [log]), resolveAbi: async () => ({ found: false }), mcpEnabled: false });
    expect(report.facts.find((fact) => fact.id === "event_0_amount")?.value).toBe("25");
    expect(report.facts.find((fact) => fact.id === "event_0_amount")?.note).toContain("raw units");
    expect(report.facts.some((fact) => fact.id === "event_0_token_id")).toBe(false);
    expect(report.facts.find((fact) => fact.id === "event_0_contract")?.value).toBe(spender);
  });

  test("malformed events are skipped and large event lists are bounded", async () => {
    const report = await inspectTransaction({ chainId: 97, txHash: hash }, { clientFactory: () => mintClient("success", [{ ...mintLog, topics: ["0x1234"] }, ...Array.from({ length: 20 }, () => mintLog)]), resolveAbi: async () => ({ found: false }), mcpEnabled: false });
    expect(report.facts.some((fact) => fact.id.startsWith("event_0_"))).toBe(false);
    expect(report.facts.filter((fact) => /event_\d+_action/.test(fact.id))).toHaveLength(12);
    expect(report.unknowns.join(" ")).toContain("12");
  });
});
