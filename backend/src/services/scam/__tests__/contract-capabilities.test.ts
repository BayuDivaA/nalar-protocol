import { describe, expect, test } from "bun:test";

import { detectContractCapabilities } from "../contract-capabilities";

describe("Contract capability detector", () => {
  test("ignores a clean ERC20 ABI", () => {
    const capabilities = detectContractCapabilities([
      { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [], outputs: [] },
      { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [], outputs: [] },
      { type: "function", name: "balanceOf", stateMutability: "view", inputs: [], outputs: [] },
    ]);

    expect(capabilities).toEqual([]);
  });

  test("maps dangerous functions to explicit capability categories", () => {
    const capabilities = detectContractCapabilities([
      {
        type: "function",
        name: "mint",
        stateMutability: "nonpayable",
        inputs: [
          { name: "to", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        outputs: [],
      },
      { type: "function", name: "setSellTax", stateMutability: "nonpayable", inputs: [{ name: "tax", type: "uint256" }], outputs: [] },
      { type: "function", name: "blacklist", stateMutability: "nonpayable", inputs: [{ name: "account", type: "address" }], outputs: [] },
      { type: "function", name: "pause", stateMutability: "nonpayable", inputs: [], outputs: [] },
      { type: "function", name: "upgradeTo", stateMutability: "nonpayable", inputs: [{ name: "implementation", type: "address" }], outputs: [] },
    ]);

    expect(capabilities.map((item) => item.code)).toEqual(["MINT_CAPABILITY", "TAX_CAPABILITY", "BLACKLIST_CAPABILITY", "PAUSE_CAPABILITY", "UPGRADE_CAPABILITY"]);
    expect(capabilities[1]).toMatchObject({ category: "TAX", functionSignature: "setSellTax(uint256)", evidenceSource: "ABI", confidence: "HIGH" });
  });

  test("detects ownership and role-management evidence without claiming control", () => {
    const capabilities = detectContractCapabilities([
      { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
      { type: "function", name: "hasRole", stateMutability: "view", inputs: [{ type: "bytes32" }, { type: "address" }], outputs: [{ type: "bool" }] },
      { type: "function", name: "grantRole", stateMutability: "nonpayable", inputs: [{ type: "bytes32" }, { type: "address" }], outputs: [] },
    ]);

    expect(capabilities.map((item) => item.code)).toEqual(["OWNERSHIP_CAPABILITY", "ACCESS_CONTROL_CAPABILITY", "ACCESS_CONTROL_CAPABILITY"]);
    expect(capabilities.every((item) => item.access === "UNKNOWN")).toBe(true);
  });

  test("detects common tax, blacklist, limits, and upgrade variants", () => {
    const capabilities = detectContractCapabilities([
      {
        type: "function",
        name: "updateTax",
        stateMutability: "nonpayable",
        inputs: [{ name: "tax", type: "uint256" }],
        outputs: [],
      },
      {
        type: "function",
        name: "blockAddress",
        stateMutability: "nonpayable",
        inputs: [{ name: "account", type: "address" }],
        outputs: [],
      },
      {
        type: "function",
        name: "setMaxTransaction",
        stateMutability: "nonpayable",
        inputs: [{ name: "amount", type: "uint256" }],
        outputs: [],
      },
      {
        type: "function",
        name: "setImplementation",
        stateMutability: "nonpayable",
        inputs: [{ name: "implementation", type: "address" }],
        outputs: [],
      },
    ]);

    expect(capabilities.map((item) => item.code)).toEqual(["TAX_CAPABILITY", "BLACKLIST_CAPABILITY", "LIMITS_CAPABILITY", "UPGRADE_CAPABILITY"]);
  });
});
