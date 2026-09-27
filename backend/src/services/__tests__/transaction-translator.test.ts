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

test("approval spender and NFT operator are not transaction recipients", () => {
  const owner = "0x53E993819F2Bc45A029615e8634BDdEEab4F7817";
  const token = "0x55d398326f99059fF775485246999027B3197955";
  const spender = "0x2f68417A18dA681589F4eA64B9Cc9839209acfF7";
  const base = { chainId: 56, from: owner, to: token, value: 0n };

  const erc20 = translateTransaction({ ...base, action: "TOKEN_APPROVAL", effects: { swaps: [], approvals: [{ type: "ERC20_ALLOWANCE", token, owner, spender, amount: 1n, unlimited: false, sourceFunction: "approve" }] } });
  expect(erc20.target).toBe(token);
  expect(erc20.recipient).toBeUndefined();
  expect(erc20.details).toContain(`Spender: ${spender}`);

  const nft = translateTransaction({ ...base, action: "NFT_APPROVAL", effects: { swaps: [], approvals: [{ type: "ERC721_OPERATOR", token, owner, operator: spender, approved: true, sourceFunction: "setApprovalForAll" }] } });
  expect(nft.target).toBe(token);
  expect(nft.recipient).toBeUndefined();
  expect(nft.details).toContain(`Operator: ${spender}`);
});
