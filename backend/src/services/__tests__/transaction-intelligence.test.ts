import { describe, expect, test } from "bun:test";

import { analyzeTransactionIntelligence } from "../transaction-intelligence";

describe("Transaction Intelligence", () => {
  test("should analyze local TxSentry contract", async () => {
    const result = await analyzeTransactionIntelligence({
      chainId: 97,
      to: "0x4ACCcd7a3d2e2a7c99BE0ea035B40cE03C7A14d1",
      data: "0x6871ee40",
    });

    expect(result.decoded).toBe(true);
    expect(result.functionName).toBe("safeMint");
    expect(result.classification.action).toBe("MINT");
    expect(result.abiSource).toBe("local");
  });

  test("should analyze external verified contract", async () => {
    const result = await analyzeTransactionIntelligence({
      chainId: 97,
      to: "0x63E936adccAb39D3b18EB707d0A3E2f3454465ac",
      data: "0xb6b55f2500000000000000000000000000000000000000000000000000000000000f4240",
    });

    expect(result.decoded).toBe(true);
    expect(result.functionName).toBe("deposit");
    expect(result.classification.action).toBe("DEPOSIT");
    expect(result.abiSource).toBe("sourcify");
    expect(result.contractVerified).toBe(true);
  });
});
