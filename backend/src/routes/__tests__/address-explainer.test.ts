// @ts-expect-error Bun supplies the test module at runtime.
import { describe, expect, test } from "bun:test";

import { createAddressExplainerRoute } from "../address-explainer";
import { AddressInspectionError, inspectAddress, type AddressInspection } from "../../services/address-inspector";
import type { TransactionInspection } from "../../services/transaction-inspector";

const address = "0x53E993819F2Bc45A029615e8634BDdEEab4F7817";

function sample(chainId: 56 | 97): AddressInspection {
  const explorer = chainId === 56 ? "https://bscscan.com" : "https://testnet.bscscan.com";
  return {
    chainId,
    network: chainId === 56 ? "BNB Mainnet" : "BNB Testnet",
    address,
    explorerUrl: `${explorer}/address/${address}`,
    checkedAt: "2026-10-04T00:00:00.000Z",
    facts: [{ id: "code", label: "Code at this address", value: "Not present", source: "RPC", checkedAt: "2026-10-04T00:00:00.000Z" }],
    unknowns: ["This does not prove who controls the address."],
    sources: { rpc: "available", abi: "unavailable", mcp: "not_checked" },
  };
}

function post(route: ReturnType<typeof createAddressExplainerRoute>, body: unknown) {
  return route.request("/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

describe("Address Explainer route", () => {
  test.each([56, 97] as const)("uses chain %i facts and explorer without a decision", async (chainId) => {
    let inspectedChain = 0;
    const route = createAddressExplainerRoute({
      inspect: async (input) => { inspectedChain = input.chainId; return sample(chainId); },
      explain: async () => null,
    });
    const response = await post(route, { chainId, address });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(inspectedChain).toBe(chainId);
    expect(body.explorerUrl).toBe(`${chainId === 56 ? "https://bscscan.com" : "https://testnet.bscscan.com"}/address/${address}`);
    expect(body.aiStatus).toBe("unavailable");
    expect(body.facts).toHaveLength(1);
    expect(body.decision).toBeUndefined();
    expect(body.riskScore).toBeUndefined();
  });

  test("rejects malformed input before inspection", async () => {
    const route = createAddressExplainerRoute({ inspect: async () => { throw new Error("must not inspect"); }, explain: async () => null });
    const response = await post(route, { chainId: "56", address });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("INVALID_INPUT");
  });

  test("rejects oversized requests without calling providers", async () => {
    const route = createAddressExplainerRoute({ inspect: async () => { throw new Error("must not inspect"); }, explain: async () => null });
    const response = await post(route, { chainId: 56, address, question: "x".repeat(7_000) });
    expect(response.status).toBe(413);
    expect((await response.json()).error).toBe("INVALID_INPUT");
  });

  test("unsupported chain and invalid address are rejected before RPC fallback", async () => {
    await expect(inspectAddress({ chainId: 1, address })).rejects.toMatchObject({ code: "UNSUPPORTED_NETWORK" });
    await expect(inspectAddress({ chainId: 56, address: "not-an-address" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  test("RPC failure is explicit, not an empty or safe report", async () => {
    const route = createAddressExplainerRoute({
      inspect: async () => { throw new AddressInspectionError("RPC_UNAVAILABLE", "Could not read BNB Mainnet."); },
      explain: async () => { throw new Error("must not explain"); },
    });
    const response = await post(route, { chainId: 56, address });
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toBe("RPC_UNAVAILABLE");
    expect(body.answer).toBeUndefined();
  });

  test("AI failure keeps observed facts visible", async () => {
    const route = createAddressExplainerRoute({ inspect: async () => sample(97), explain: async () => null });
    const response = await post(route, { chainId: 97, address, question: "What is this?" });
    const body = await response.json();
    expect(body.facts[0].source).toBe("RPC");
    expect(body.answer).toBeNull();
  });

  test.each([56, 97] as const)("accepts a transaction hash on chain %i without a decision", async (chainId) => {
    const txHash = `0x${"a".repeat(64)}` as `0x${string}`;
    const report: TransactionInspection = {
      kind: "transaction", chainId, network: chainId === 56 ? "BNB Mainnet" : "BNB Testnet", hash: txHash,
      explorerUrl: `${chainId === 56 ? "https://bscscan.com" : "https://testnet.bscscan.com"}/tx/${txHash}`,
      checkedAt: "2026-10-05T00:00:00.000Z", facts: [], unknowns: [],
      sources: { rpc: "available", abi: "unavailable", mcp: "not_checked" },
    };
    const route = createAddressExplainerRoute({
      inspect: async () => { throw new Error("address inspector must not run"); },
      inspectTransaction: async (input) => { expect(input.chainId).toBe(chainId); expect(input.txHash).toBe(txHash); return report; },
      explain: async () => null,
    });
    const response = await post(route, { chainId, txHash });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.kind).toBe("transaction");
    expect(body.explorerUrl).toBe(report.explorerUrl);
    expect(body.decision).toBeUndefined();
  });
});
