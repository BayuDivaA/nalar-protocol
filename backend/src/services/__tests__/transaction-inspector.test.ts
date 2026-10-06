// @ts-expect-error Bun supplies the test module at runtime.
import { describe, expect, test } from "bun:test";

import { encodeFunctionData, parseAbi, type PublicClient } from "viem";

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
});
