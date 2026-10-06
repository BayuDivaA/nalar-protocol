// @ts-expect-error Bun supplies the test module at runtime.
import { describe, expect, test } from "bun:test";

import { parseAbi, type PublicClient } from "viem";

import { describeContractFunctions, inspectAddress } from "../address-inspector";
import type { BnbMcpClient } from "../scam/bnb-mcp-client";

const address = "0x53E993819F2Bc45A029615e8634BDdEEab4F7817";
const noMcp = { mcpEnabled: false };

function client(input: { chainId?: number; code?: `0x${string}`; failCode?: boolean; failBalance?: boolean }): PublicClient {
  return {
    getChainId: async () => input.chainId ?? 56,
    getCode: async () => {
      if (input.failCode) throw new Error("RPC failed");
      return input.code;
    },
    getBalance: async () => {
      if (input.failBalance) throw new Error("RPC failed");
      return 0n;
    },
  } as unknown as PublicClient;
}

describe("Address inspection RPC boundary", () => {
  test("no returned code is an observation, not an EOA claim", async () => {
    const report = await inspectAddress({ chainId: 56, address }, () => client({}), noMcp);
    expect(report.kind).toBe("address");
    expect(report.facts.find((fact) => fact.id === "code")?.value).toBe("Not present");
    expect(JSON.stringify(report)).not.toContain("EOA");
    expect(report.explorerUrl).toBe(`https://bscscan.com/address/${address}`);
  });

  test("Testnet uses chain 97 and the Testnet explorer", async () => {
    const report = await inspectAddress({ chainId: 97, address }, () => client({ chainId: 97 }), noMcp);
    expect(report.chainId).toBe(97);
    expect(report.network).toBe("BNB Testnet");
    expect(report.explorerUrl).toBe(`https://testnet.bscscan.com/address/${address}`);
    expect(report.facts.find((fact) => fact.id === "balance")?.value).toBe("0 tBNB");
  });

  test("code-read failure does not become no code", async () => {
    await expect(inspectAddress({ chainId: 56, address }, () => client({ failCode: true }), noMcp)).rejects.toMatchObject({ code: "RPC_UNAVAILABLE" });
  });

  test("RPC on the wrong chain is rejected", async () => {
    await expect(inspectAddress({ chainId: 56, address }, () => client({ chainId: 97 }), noMcp)).rejects.toMatchObject({ code: "RPC_UNAVAILABLE" });
  });

  test("balance failure leaves the code observation and marks balance unknown", async () => {
    const report = await inspectAddress({ chainId: 56, address }, () => client({ failBalance: true }), noMcp);
    expect(report.facts.find((fact) => fact.id === "code")?.value).toBe("Not present");
    expect(report.unknowns).toContain("Native balance could not be read.");
  });

  test("ABI functions are described as entry points, not source behavior", () => {
    const functions = describeContractFunctions(parseAbi([
      "function balanceOf(address owner) view returns (uint256)",
      "function approve(address spender, uint256 amount) returns (bool)",
    ]));
    expect(functions.map((item) => [item.signature, item.mode])).toEqual([
      ["balanceOf(address)", "read"], ["approve(address, uint256)", "write"],
    ]);
    expect(functions[1]?.inputs[0]).toEqual({ name: "spender", type: "address" });
  });

  test("BNB MCP contract flag is used only when it matches the RPC and requested address", async () => {
    let closed = false;
    const mcpClientFactory = (response: unknown) => () => ({
      isContract: async () => response,
      close: async () => { closed = true; },
    }) as unknown as BnbMcpClient;
    const matching = await inspectAddress({ chainId: 56, address }, () => client({}), { mcpEnabled: true, mcpClientFactory: mcpClientFactory({ content: [{ type: "text", text: JSON.stringify({ address, chainId: 56, isContract: false }) }] }) });
    expect(matching.sources.mcp).toBe("available");
    expect(closed).toBe(true);
    const wrongAddress = await inspectAddress({ chainId: 56, address }, () => client({}), { mcpEnabled: true, mcpClientFactory: mcpClientFactory({ content: [{ type: "text", text: JSON.stringify({ address: "0x0000000000000000000000000000000000000001", isContract: false }) }] }) });
    expect(wrongAddress.sources.mcp).toBe("unavailable");
    expect(wrongAddress.facts.find((fact) => fact.id === "code")?.value).toBe("Not present");
  });
});
