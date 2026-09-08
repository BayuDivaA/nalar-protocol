import { describe, expect, test } from "bun:test";

import { resolveTokenMetadata } from "../token-resolver";

describe("Token Resolver", () => {
  test("should handle a non-token address safely", async () => {
    const result = await resolveTokenMetadata("0x0000000000000000000000000000000000000000");

    expect(result.address).toBe("0x0000000000000000000000000000000000000000");

    expect(result.symbol).toBeNull();

    expect(result.decimals).toBeNull();
  });
});
