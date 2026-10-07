// @ts-expect-error Bun supplies the test module at runtime.
import { expect, test } from "bun:test";
import { decodeFunctionData, encodeFunctionData, type Address } from "viem";
import { assertDemoChain, buildDemoTransaction, collectionAbi, type DemoCollection } from "./nft-demo";

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
