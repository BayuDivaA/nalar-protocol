// @ts-expect-error Bun supplies the test module at runtime.
import { expect, test } from "bun:test";
import { decodeFunctionData, encodeFunctionData, encodeFunctionResult, type Address } from "viem";
import { assertDemoChain, buildDemoTransaction, collectionAbi, demoReceiptStatus, readDemoCollection, type DemoCollection } from "./nft-demo";

const address = "0x1111111111111111111111111111111111111111" as Address;
const operator = "0x2222222222222222222222222222222222222222" as Address;
const collection: DemoCollection = { address, name: "Test editions", price: 12345n, minted: 7n, maximum: 888n, image: "data:image/svg+xml;base64,PHN2Zy8+", trap: null };

test("normal mint uses the current contract and on-chain price, not preset calldata or value", () => {
  const tx = buildDemoTransaction(collection, "normal");
  expect(tx.to).toBe(address);
  expect(tx.value).toBe(12345n);
  expect(decodeFunctionData({ abi: collectionAbi, data: tx.data }).functionName).toBe("safeMint");
  expect(buildDemoTransaction({ ...collection, price: 0n }, "normal").value).toBe(0n);
});

test("trap uses the exact request and operator read from its current contract", () => {
  const data = encodeFunctionData({ abi: collectionAbi, functionName: "setApprovalForAll", args: [operator, true] });
  const current = { ...collection, trap: { address: operator, operator, target: address, value: 0n, data } };
  const tx = buildDemoTransaction(current, "trap");
  expect(tx).toEqual({ to: address, value: 0n, data });
  const decoded = decodeFunctionData({ abi: collectionAbi, data: tx.data });
  expect(decoded.functionName).toBe("setApprovalForAll");
  expect(decoded.args).toEqual([operator, true]);
});

test("missing trap or mismatched transaction target never produces an approval request", () => {
  expect(() => buildDemoTransaction(collection, "trap")).toThrow();
  const data = encodeFunctionData({ abi: collectionAbi, functionName: "setApprovalForAll", args: [operator, true] });
  expect(() => buildDemoTransaction({ ...collection, trap: { address: operator, operator, target: operator, value: 0n, data } }, "trap")).toThrow();
});

test("wrong operator, native value or action from a trap fails closed", () => {
  const data = encodeFunctionData({ abi: collectionAbi, functionName: "setApprovalForAll", args: [operator, true] });
  const trap = { address: operator, operator, target: address, value: 0n, data };
  expect(() => buildDemoTransaction({ ...collection, trap: { ...trap, operator: address } }, "trap")).toThrow();
  expect(() => buildDemoTransaction({ ...collection, trap: { ...trap, value: 1n } }, "trap")).toThrow();
  expect(() => buildDemoTransaction({ ...collection, trap: { ...trap, data: encodeFunctionData({ abi: collectionAbi, functionName: "safeMint" }) } }, "trap")).toThrow();
});

test("sold-out normal mint is rejected without disabling the independent approval test", () => {
  expect(() => buildDemoTransaction({ ...collection, minted: 888n }, "normal")).toThrow("sold out");
});

test("Mainnet and unknown network context are rejected; Testnet is accepted", async () => {
  await assertDemoChain({ request: async () => "0x61" });
  await expect(assertDemoChain({ request: async () => "0x38" })).rejects.toThrow("BNB Testnet");
  await expect(assertDemoChain({ request: async () => null })).rejects.toThrow("BNB Testnet");
});

test("a successful cancellation or different replacement never confirms the original mint or approval", () => {
  expect(demoReceiptStatus({ status: "success" }, "cancelled")).toBe("cancelled");
  expect(demoReceiptStatus({ status: "success" }, "replaced")).toBe("replaced");
  expect(demoReceiptStatus({ status: "success" }, "repriced")).toBe("confirmed");
  expect(demoReceiptStatus({ status: "reverted" }, "repriced")).toBe("reverted");
  expect(demoReceiptStatus({ status: "success" })).toBe("confirmed");
  expect(demoReceiptStatus({ status: "reverted" })).toBe("reverted");
});

test("a payment contract or non-NFT target is rejected before NFT metadata is requested", async () => {
  for (const reverts of [false, true]) {
    const calls: string[] = [];
    await expect(readDemoCollection({ request: async ({ method, params }) => {
      if (method === "eth_chainId") return "0x61";
      if (method === "eth_getCode") return "0x6000";
      const call = params?.[0] as { data: string };
      calls.push(call.data.slice(0, 10));
      if (call.data.startsWith("0x01ffc9a7")) {
        if (reverts) throw { code: 3, message: "execution reverted", data: "0x" };
        return `0x${"0".repeat(64)}`;
      }
      throw { code: 3, message: "execution reverted", data: "0x" };
    } }, address)).rejects.toThrow("not a compatible NFT collection");
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every(selector => selector === "0x01ffc9a7")).toBe(true);
  }
});

test("collection metadata is read from the validated current NFT target", async () => {
  const calls: string[] = [];
  const current = await readDemoCollection({ request: async ({ method, params }) => {
    if (method === "eth_chainId") return "0x61";
    if (method === "eth_getCode") return "0x6000";
    const call = params?.[0] as { data: `0x${string}`; to: string };
    expect(call.to.toLowerCase()).toBe(address.toLowerCase());
    calls.push(call.data.slice(0, 10));
    if (call.data.startsWith("0x01ffc9a7")) return `0x${"0".repeat(63)}1`;
    const { functionName } = decodeFunctionData({ abi: collectionAbi, data: call.data });
    switch (functionName) {
      case "name": return encodeFunctionResult({ abi: collectionAbi, functionName, result: collection.name });
      case "getMintPrice": return encodeFunctionResult({ abi: collectionAbi, functionName, result: collection.price });
      case "totalSupply": return encodeFunctionResult({ abi: collectionAbi, functionName, result: collection.minted });
      case "MAX_SUPPLY": return encodeFunctionResult({ abi: collectionAbi, functionName, result: collection.maximum });
      case "previewImage": return encodeFunctionResult({ abi: collectionAbi, functionName, result: collection.image });
      default: throw new Error("Unexpected metadata call");
    }
  } }, address);
  expect(current).toEqual(collection);
  expect(calls[0]).toBe("0x01ffc9a7");
});

test("RPC failure during contract validation is not replaced with collection data", async () => {
  await expect(readDemoCollection({ request: async ({ method }) => {
    if (method === "eth_chainId") return "0x61";
    if (method === "eth_getCode") return "0x6000";
    throw new Error("RPC unavailable");
  } }, address)).rejects.toThrow("RPC unavailable");
});
