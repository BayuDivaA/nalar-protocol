// @ts-expect-error Bun supplies the test module at runtime.
import { describe, expect, test } from "bun:test";

import { parseAddressExplanation } from "../address-explanation";
import type { AddressInspection } from "../address-inspector";
import type { TransactionInspection } from "../transaction-inspector";

const inspection: AddressInspection = {
  chainId: 56,
  network: "BNB Mainnet",
  address: "0x53E993819F2Bc45A029615e8634BDdEEab4F7817",
  explorerUrl: "https://bscscan.com/address/0x53E993819F2Bc45A029615e8634BDdEEab4F7817",
  checkedAt: "2026-10-04T00:00:00.000Z",
  facts: [{ id: "state_current_sell_tax", label: "sellTax", value: "9800", source: "RPC", checkedAt: "2026-10-04T00:00:00.000Z", note: "Unit and effect are unknown." }],
  unknowns: [],
  sources: { rpc: "available", abi: "available", mcp: "not_checked" },
};

describe("Address explanation output guard", () => {
  test("accepts bilingual plain-language output tied to an observed fact", () => {
    const result = parseAddressExplanation(JSON.stringify({ english: "The contract reports a configured value of 9800. Its effect is not established here.", indonesian: "Kontrak mencatat nilai konfigurasi 9800. Dampaknya belum dapat dipastikan di sini.", factIds: ["state_current_sell_tax"] }), inspection);
    expect(result?.factIds).toEqual(["state_current_sell_tax"]);
  });

  test("rejects fabricated fact references", () => {
    expect(parseAddressExplanation(JSON.stringify({ english: "A value was read.", indonesian: "Ada nilai yang terbaca.", factIds: ["made_up"] }), inspection)).toBeNull();
  });

  test("rejects verdict language, even with valid citations", () => {
    expect(parseAddressExplanation(JSON.stringify({ english: "This token is safe.", indonesian: "Ada data yang terbaca.", factIds: ["state_current_sell_tax"] }), inspection)).toBeNull();
  });

  test("rejects a percentage or certain loss from an unverified tax unit", () => {
    expect(parseAddressExplanation(JSON.stringify({ english: "The configured tax is 98%.", indonesian: "Pajak yang diatur 98%.", factIds: ["state_current_sell_tax"] }), inspection)).toBeNull();
    expect(parseAddressExplanation(JSON.stringify({ english: "You will lose funds.", indonesian: "Dana akan hilang.", factIds: ["state_current_sell_tax"] }), inspection)).toBeNull();
  });

  test("rejects malformed and uncited output", () => {
    expect(parseAddressExplanation("not json", inspection)).toBeNull();
    expect(parseAddressExplanation(JSON.stringify({ english: "A value was read.", indonesian: "Ada nilai yang terbaca.", factIds: [] }), inspection)).toBeNull();
  });

  test("accepts a longer structured explanation without changing the bilingual response shape", () => {
    const english = `Observed value\n\n${"The contract reports 9800; its unit and effect are not established. ".repeat(24)}`;
    const result = parseAddressExplanation(JSON.stringify({ english, indonesian: "Nilai tercatat\n\nKontrak mencatat 9800. Satuan dan dampaknya belum diketahui.", factIds: ["state_current_sell_tax"] }), inspection);
    expect(english.length).toBeGreaterThan(1200);
    expect(result?.english).toBe(english.trim());
    expect(result?.factIds).toEqual(["state_current_sell_tax"]);
  });

  test("a local signature match cannot be explained as a verified called function", () => {
    const transaction: TransactionInspection = { kind: "transaction", chainId: 97, network: "BNB Testnet", hash: `0x${"a".repeat(64)}`, explorerUrl: "https://testnet.bscscan.com", checkedAt: inspection.checkedAt, facts: [{ id: "function_candidate", label: "Signature match", value: "safeMint()", source: "ABI", checkedAt: inspection.checkedAt }], unknowns: [], sources: { rpc: "available", abi: "unavailable", mcp: "not_checked" } };
    expect(parseAddressExplanation(JSON.stringify({ english: "The request ran safeMint().", indonesian: "Permintaan menjalankan safeMint().", factIds: ["function_candidate"] }), transaction)).toBeNull();
    expect(parseAddressExplanation(JSON.stringify({ english: "The data matches safeMint(), but the target implementation is not verified.", indonesian: "Data cocok dengan safeMint(), tetapi implementasi tujuan belum terverifikasi.", factIds: ["function_candidate"] }), transaction)).not.toBeNull();
  });

  test("does not expose model writing instructions as an explanation", () => {
    expect(parseAddressExplanation(JSON.stringify({ english: "Never present a signature match as an established called function.", indonesian: "Kontrak mencatat 9800.", factIds: ["state_current_sell_tax"] }), inspection)).toBeNull();
  });
});
