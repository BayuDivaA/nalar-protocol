import { expect, test } from "bun:test";
import { translateTransaction } from "../transaction-translator";

test("Mainnet transaction summary uses BNB, not tBNB", () => {
  const summary = translateTransaction({
    chainId: 56,
    from: "0x53E993819F2Bc45A029615e8634BDdEEab4F7817",
    to: "0x4ACCcd7a3d2e2a7c99BE0ea035B40cE03C7A14d1",
    value: 1_000_000_000_000_000n,
    action: "MINT",
    functionName: "mint",
    effects: { approvals: [], swaps: [] },
    targetIsContract: true,
  });
  expect(summary.description).toContain("BNB");
  expect(summary.description).not.toContain("tBNB");
  expect(summary.input?.symbol).toBe("BNB");
});
