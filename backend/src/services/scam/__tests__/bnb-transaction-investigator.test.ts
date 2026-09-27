import { describe, expect, test } from "bun:test";
import { encodeFunctionData, type Address } from "viem";
import { securityAbi } from "../../../lib/abis";
import { decodeTransactionData } from "../../../lib/decoder";
import { analyzeEffects } from "../../effect-analyzer";
import { BnbTransactionInvestigator } from "../bnb-transaction-investigator";
import type { BnbMcpClient } from "../bnb-mcp-client";

const OWNER = "0x53E993819F2Bc45A029615e8634BDdEEab4F7817" as Address;
const SHARED_SPENDER = "0x2f68417A18dA681589F4eA64B9Cc9839209acfF7" as Address;
const TOKENS = [
  "0x55d398326f99059fF775485246999027B3197955",
  "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
  "0xbb4CdB9CBD36B01bD1cBaEBF2De08d9173bc095c",
] as Address[];

describe("BNB transaction evidence mapping", () => {
  test("uses each Mainnet approve calldata and token target, without reusing a prior counterparty", async () => {
    const calls: Array<{ address: string; network: string }> = [];
    const mcp = {
      async isContract(input: { address: string; network: string }) {
        calls.push(input);
        return { content: [{ type: "text", text: JSON.stringify({ isContract: true }) }] };
      },
      async getLatestBlock() { return { content: [{ type: "text", text: "{}" }] }; },
    } as BnbMcpClient;
    const investigator = new BnbTransactionInvestigator(mcp);
    const spenders = [SHARED_SPENDER, "0x1111111111111111111111111111111111111111", "0x2222222222222222222222222222222222222222"] as Address[];

    for (const [index, token] of TOKENS.entries()) {
      const spender = spenders[index]!;
      const data = encodeFunctionData({ abi: securityAbi, functionName: "approve", args: [spender, 123n] });
      const decoded = await decodeTransactionData({ chainId: 56, to: token, data });
      const effects = analyzeEffects({ from: OWNER, to: token, functionName: decoded.functionName, args: decoded.args });
      const result = await investigator.investigate({ chainId: 56, to: token, effects });
      const currentCalls = calls.slice(index * 2);

      expect(decoded.functionName).toBe("approve");
      expect(decoded.args?.[0]).toBe(spender);
      expect(effects.approvals[0]).toMatchObject({ type: "ERC20_ALLOWANCE", token, spender });
      expect(currentCalls).toEqual([{ address: token, network: "bsc" }, { address: spender, network: "bsc" }]);
      expect(result.observations[0]).toMatchObject({ type: "TARGET_CONTRACT", address: token, value: "true" });
      expect(result.observations[1]).toMatchObject({ type: "COUNTERPARTY_CONTRACT", address: spender, value: "true" });
      expect(result.contractAddresses).toEqual([token.toLowerCase(), spender.toLowerCase()]);
    }
  });

  test("keeps a shared spender when three different approvals genuinely encode it", async () => {
    const calls: string[] = [];
    const mcp = {
      async isContract({ address }: { address: string }) {
        calls.push(address);
        return { content: [{ type: "text", text: JSON.stringify({ isContract: false }) }] };
      },
      async getLatestBlock() { return {}; },
    } as BnbMcpClient;
    const investigator = new BnbTransactionInvestigator(mcp);

    for (const token of TOKENS) {
      const data = encodeFunctionData({ abi: securityAbi, functionName: "approve", args: [SHARED_SPENDER, 123n] });
      const decoded = await decodeTransactionData({ chainId: 56, to: token, data });
      const effects = analyzeEffects({ from: OWNER, to: token, functionName: decoded.functionName, args: decoded.args });
      const result = await investigator.investigate({ chainId: 56, to: token, effects });
      expect(effects.approvals[0]).toMatchObject({ token, spender: SHARED_SPENDER });
      expect(result.observations[1]).toMatchObject({ type: "COUNTERPARTY_CONTRACT", address: SHARED_SPENDER, value: "false" });
    }
    expect(calls).toEqual(TOKENS.flatMap((token) => [token, SHARED_SPENDER]));
  });

  test("unreadable MCP contract status remains unavailable, not an EOA assertion", async () => {
    const mcp = {
      async isContract() { return { content: [{ type: "text", text: JSON.stringify({ isContract: null }) }] }; },
      async getLatestBlock() { return {}; },
    } as BnbMcpClient;
    const result = await new BnbTransactionInvestigator(mcp).investigate({ chainId: 56, to: TOKENS[0]!, effects: { approvals: [], swaps: [] } });
    expect(result.available).toBe(false);
    expect(result.observations[0]).toMatchObject({ type: "TARGET_CONTRACT", value: "unavailable" });
    expect(result.contractAddresses).toEqual([]);
  });
});
