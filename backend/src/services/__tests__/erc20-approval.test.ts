import { describe, expect, test } from "bun:test";

import { encodeAbiParameters, encodeFunctionData } from "viem";

import { securityAbi } from "../../lib/abis";
import { analyzeEffects } from "../effect-analyzer";
import { calculateRisk } from "../risk-engine";

const TOKEN = "0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565";

const USER = "0x53E993819F2Bc45A029615e8634BDdEEab4F7817";

const SPENDER = "0x3333333333333333333333333333333333333333";

const MAX_UINT256 = 2n ** 256n - 1n;

describe("ERC20 Approval Security", () => {
  test("limited approval should produce HIGH risk", () => {
    const amount = 100_000_000n;

    const data = encodeFunctionData({
      abi: securityAbi,
      functionName: "approve",
      args: [SPENDER, amount],
    });

    const selector = data.slice(0, 10);

    expect(selector).toBe("0x095ea7b3");

    const decodedArgs = [SPENDER, amount] as const;

    const effects = analyzeEffects({
      to: TOKEN,
      from: USER,
      functionName: "approve",
      args: decodedArgs,
    });

    expect(effects.approvals).toHaveLength(1);

    const approval = effects.approvals[0]!;

    expect(approval.type).toBe("ERC20_ALLOWANCE");

    if (approval.type !== "ERC20_ALLOWANCE") {
      throw new Error("Expected ERC20 allowance effect.");
    }

    expect(approval.spender).toBe(SPENDER);
    expect(approval.amount).toBe(amount);
    expect(approval.unlimited).toBe(false);

    const risk = calculateRisk([], "TOKEN_APPROVAL", effects.approvals);

    expect(risk.level).toBe("HIGH");
    expect(risk.score).toBe(60);
  });

  test("unlimited approval should produce CRITICAL risk", () => {
    const data = encodeFunctionData({
      abi: securityAbi,
      functionName: "approve",
      args: [SPENDER, MAX_UINT256],
    });

    expect(data.slice(0, 10)).toBe("0x095ea7b3");

    const decodedArgs = [SPENDER, MAX_UINT256] as const;

    const effects = analyzeEffects({
      to: TOKEN,
      from: USER,
      functionName: "approve",
      args: decodedArgs,
    });

    expect(effects.approvals).toHaveLength(1);

    const approval = effects.approvals[0]!;

    expect(approval.type).toBe("ERC20_ALLOWANCE");

    if (approval.type !== "ERC20_ALLOWANCE") {
      throw new Error("Expected ERC20 allowance effect.");
    }

    expect(approval.spender).toBe(SPENDER);
    expect(approval.amount).toBe(MAX_UINT256);
    expect(approval.unlimited).toBe(true);

    const risk = calculateRisk([], "TOKEN_APPROVAL", effects.approvals);

    expect(risk.level).toBe("CRITICAL");
    expect(risk.score).toBe(90);
  });

  test("permit grants the same allowance evidence as approve", () => {
    const effects = analyzeEffects({
      to: TOKEN,
      from: USER,
      functionName: "permit",
      args: [USER, SPENDER, MAX_UINT256, 1n, 27, "0x" + "00".repeat(32), "0x" + "00".repeat(32)],
    });

    expect(effects.approvals).toHaveLength(1);
    expect(effects.approvals[0]).toMatchObject({ type: "ERC20_ALLOWANCE", owner: USER, spender: SPENDER, unlimited: true, sourceFunction: "permit" });
  });

  test("finds a hidden approval inside multicall bytes", () => {
    const approvalCall = encodeFunctionData({ abi: securityAbi, functionName: "approve", args: [SPENDER, MAX_UINT256] });
    const effects = analyzeEffects({ to: TOKEN, from: USER, functionName: "multicall", args: [[approvalCall]] });

    expect(effects.approvals).toHaveLength(1);
    expect(effects.approvals[0]).toMatchObject({ type: "ERC20_ALLOWANCE", spender: SPENDER, unlimited: true });
  });

  test("finds Permit2 approval hidden inside Universal Router execution", () => {
    const permitInput = encodeAbiParameters(
      [
        {
          type: "tuple",
          components: [
            { name: "details", type: "tuple", components: [{ name: "token", type: "address" }, { name: "amount", type: "uint160" }, { name: "expiration", type: "uint48" }, { name: "nonce", type: "uint48" }] },
            { name: "spender", type: "address" },
            { name: "sigDeadline", type: "uint256" },
          ],
        },
        { type: "bytes" },
      ],
      [{ details: { token: TOKEN, amount: 2n ** 160n - 1n, expiration: 0, nonce: 0 }, spender: SPENDER, sigDeadline: 1n }, "0x"],
    );

    const effects = analyzeEffects({ to: SPENDER, from: USER, functionName: "execute", protocol: "PancakeSwap", args: ["0x0a", [permitInput]] });

    expect(effects.approvals).toHaveLength(1);
    expect(effects.approvals[0]).toMatchObject({ type: "ERC20_ALLOWANCE", token: TOKEN, spender: SPENDER, sourceFunction: "permit2" });
  });
});
