import { describe, expect, test } from "bun:test";

import { resolveContractAbi } from "../contract-resolver";

const EXTERNAL_CONTRACT = "0x63E936adccAb39D3b18EB707d0A3E2f3454465ac";

describe("Contract ABI Resolver", () => {
  test("should resolve verified external contract ABI", async () => {
    const result = await resolveContractAbi({
      chainId: 97,
      address: EXTERNAL_CONTRACT,
    });

    expect(result.found).toBe(true);
    expect(result.contract).toBeDefined();

    expect(Array.isArray(result.contract?.abi)).toBe(true);

    expect(result.contract?.verified).toBe(true);
  });

  test("should return not found for unknown contract", async () => {
    const result = await resolveContractAbi({
      chainId: 97,
      address: "0x1111111111111111111111111111111111111111",
    });

    expect(result.found).toBe(false);
  });
});
