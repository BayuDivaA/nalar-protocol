// @ts-expect-error Bun supplies the test module at runtime.
import { describe, expect, test } from "bun:test";

import { parseAddressExplanation } from "../address-explanation";
import type { AddressInspection } from "../address-inspector";

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
});
