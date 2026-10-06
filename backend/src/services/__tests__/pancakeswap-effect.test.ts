import { describe, expect, spyOn, test } from "bun:test";

import { encodeAbiParameters, encodeFunctionData, type Address, type Hex } from "viem";

import { pancakeswapUniversalRouterAbi } from "../../lib/protocols/pancakeswap";

import { analyzeEffects } from "../effect-analyzer";

import { decodeTransactionData } from "../../lib/decoder";
import { getWbnbAddress } from "../../config/networks";
import { compareIntent } from "../intent-comparator";
import type { NormalizedIntent } from "../intent-normalizer";
import { analyzeTransactionThreats } from "../scam/transaction-threat-analyzer";
import { calculateRisk } from "../risk-engine";
import { defaultPolicy, evaluatePolicy } from "../policy";
import { makeSecurityDecision } from "../security-decision";

const ROUTER = "0x87FD5305E6a40F378da124864B2D479c2028BD86" as Address;

const USER = "0x53E993819F2Bc45A029615e8634BDdEEab4F7817" as Address;

const TOKEN_IN = "0x1111111111111111111111111111111111111111" as Address;

const TOKEN_OUT = "0x2222222222222222222222222222222222222222" as Address;

const PATH = `0x${TOKEN_IN.slice(2)}0001f4${TOKEN_OUT.slice(2)}` as `0x${string}`;
const MAINNET_ROUTER = "0xd9C500DfF816a1Da21A48A732d3498Bf09dc9AEB" as Address;
const MAINNET_WBNB = getWbnbAddress(56)!;
const BUSD = "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56" as Address;
const VALUE = 2_000_000_000_000n;
const SWAP_INTENT: NormalizedIntent = {
  action: "SWAP", quantity: null, tokenIn: "BNB", tokenOut: BUSD,
  maxValueNative: null, nativeCurrency: null, maxValueWei: null,
  allowApproval: false, targetAddress: null, description: "Swap BNB for BUSD",
};

describe("PancakeSwap Effect Analysis", () => {
  for (const version of ["V2", "V3"] as const) {
    for (const withDeadline of [false, true]) {
      test(`Mainnet Infinity ${version} execute${withDeadline ? " with deadline" : ""} decodes the actual swap instead of UNKNOWN`, async () => {
        const path: Hex = `0x${MAINNET_WBNB.slice(2)}0001f4${BUSD.slice(2)}`;
        const swapInput = version === "V2"
          ? encodeAbiParameters([{ type: "address" }, { type: "uint256" }, { type: "uint256" }, { type: "address[]" }, { type: "bool" }], [USER, VALUE, 1n, [MAINNET_WBNB, BUSD], false])
          : encodeAbiParameters([{ type: "address" }, { type: "uint256" }, { type: "uint256" }, { type: "bytes" }, { type: "bool" }], [USER, VALUE, 1n, path, false]);
        const wrapInput = encodeAbiParameters([{ type: "address" }, { type: "uint256" }], ["0x0000000000000000000000000000000000000002", VALUE]);
        const commands = version === "V2" ? "0x0b08" : "0x0b00";
        const inputs = [wrapInput, swapInput];
        const data = encodeFunctionData({ abi: pancakeswapUniversalRouterAbi, functionName: "execute", args: withDeadline ? [commands, inputs, 2_000_000_000n] : [commands, inputs] });
        const sourcify = spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ abi: pancakeswapUniversalRouterAbi, match: "exact_match" })));
        try {
          const decoded = await decodeTransactionData({ chainId: 56, to: MAINNET_ROUTER, data });
          expect(decoded.functionName).toBe("execute");
          expect(decoded.protocol).toBe("PancakeSwap");
          expect(decoded.abiSource).toBe("protocol");
          expect(sourcify).not.toHaveBeenCalled();
          const effects = analyzeEffects({ from: USER, to: MAINNET_ROUTER, ...decoded });
          expect(effects.swaps).toHaveLength(1);
          expect(effects.swaps[0]).toMatchObject({ tokenIn: MAINNET_WBNB, tokenOut: BUSD, amountIn: VALUE, amountOutMin: 1n, recipient: USER, payerIsUser: false });
          const comparison = compareIntent(SWAP_INTENT, decoded.classification.action, effects, VALUE, { chainId: 56 });
          expect(comparison.action.status).toBe("MATCH");
          expect(comparison.inputToken.status).toBe("MATCH");
          expect(comparison.outputToken.status).toBe("MATCH");
          const findings = analyzeTransactionThreats({ from: USER, to: MAINNET_ROUTER, value: VALUE, action: decoded.classification.action, functionName: decoded.functionName!, protocol: decoded.protocol, contractVerified: decoded.contractVerified!, effects, intentAllowsApproval: false });
          expect(findings.some((finding) => ["ARBITRARY_EXTERNAL_CALL", "UNKNOWN_EXECUTION_PATH"].includes(finding.code))).toBe(false);
        } finally {
          sourcify.mockRestore();
        }
      });
    }
  }

  test("execute on an unregistered address or the wrong chain remains UNKNOWN and blocked", async () => {
    const data = encodeFunctionData({ abi: pancakeswapUniversalRouterAbi, functionName: "execute", args: ["0x", []] });
    const sourcify = spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ abi: pancakeswapUniversalRouterAbi, match: "exact_match" })));
    try {
      for (const context of [{ chainId: 56, to: TOKEN_OUT }, { chainId: 97, to: MAINNET_ROUTER }]) {
        const decoded = await decodeTransactionData({ ...context, data });
        expect(decoded.protocol).toBeUndefined();
        expect(decoded.classification.action).toBe("UNKNOWN");
        const effects = analyzeEffects({ from: USER, to: context.to, ...decoded });
        expect(effects.swaps).toHaveLength(0);
        const decision = makeSecurityDecision({ simulationSuccess: true, risk: calculateRisk([], "UNKNOWN"), comparison: compareIntent(SWAP_INTENT, "UNKNOWN", effects, VALUE, context), effects, policy: evaluatePolicy({ policy: defaultPolicy, action: "UNKNOWN", value: VALUE }) });
        expect(decision.decision).toBe("BLOCK");
      }
    } finally {
      sourcify.mockRestore();
    }
  });

  test("undecoded Mainnet router commands never produce a swap or ALLOW", async () => {
    const swapInput = encodeAbiParameters([{ type: "address" }, { type: "uint256" }, { type: "uint256" }, { type: "address[]" }, { type: "bool" }], [USER, VALUE, 1n, [MAINNET_WBNB, BUSD], false]);
    const errors = spyOn(console, "error").mockImplementation(() => {});
    try {
      for (const commands of ["0x10", "0x3f", "0x1008", "0x3f08", "0xbf08", "0x2108", "0x0908", "0x0808", "0x0008"]) {
        const inputs: Hex[] = commands.length > 4 ? ["0x", swapInput] : ["0x"];
        const data = encodeFunctionData({ abi: pancakeswapUniversalRouterAbi, functionName: "execute", args: [commands as Hex, inputs] });
        const decoded = await decodeTransactionData({ chainId: 56, to: MAINNET_ROUTER, data });
        const effects = analyzeEffects({ from: USER, to: MAINNET_ROUTER, ...decoded });
        expect(effects.swaps).toHaveLength(0);
        const action = decoded.classification.action;
        const comparison = compareIntent(SWAP_INTENT, action, effects, VALUE, { chainId: 56 });
        expect(comparison.matches).toBe(false);
        const decision = makeSecurityDecision({ simulationSuccess: true, risk: calculateRisk([], action), comparison, effects, policy: evaluatePolicy({ policy: defaultPolicy, action, value: VALUE }) });
        expect(decision.decision).not.toBe("ALLOW");
      }
    } finally {
      errors.mockRestore();
    }
  });

  test("should convert execute() into SWAP effect", async () => {
    /**
     * Build the inner V3 swap input.
     */
    const innerInput = (await import("viem")).encodeAbiParameters([{ type: "address" }, { type: "uint256" }, { type: "uint256" }, { type: "bytes" }, { type: "bool" }], [USER, 10_000_000n, 9_000_000n, PATH, true]);

    /**
     * Build Universal Router execute().
     *
     * command 0x00 =
     * V3_SWAP_EXACT_IN
     */
    const data = encodeFunctionData({
      abi: pancakeswapUniversalRouterAbi,
      functionName: "execute",
      args: ["0x00", [innerInput]],
    });

    const decoded = await decodeTransactionData({
      chainId: 97,
      to: ROUTER,
      data,
    });

    expect(decoded.decoded).toBe(true);

    expect(decoded.functionName).toBe("execute");

    expect(decoded.abiSource).toBe("protocol");

    expect(decoded.protocol).toBe("PancakeSwap");

    const effects = analyzeEffects({
      from: USER,
      to: ROUTER,
      functionName: decoded.functionName,
      args: decoded.args,
      protocol: decoded.protocol,
    });

    expect(effects.swaps).toHaveLength(1);

    const swap = effects.swaps[0]!;

    expect(swap.type).toBe("SWAP");

    expect(swap.protocol).toBe("PancakeSwap");

    expect(swap.tokenIn).toBe(TOKEN_IN);

    expect(swap.tokenOut).toBe(TOKEN_OUT);

    expect(swap.amountIn).toBe(10_000_000n);

    expect(swap.amountOutMin).toBe(9_000_000n);

    expect(swap.recipient).toBe(USER);

    expect(swap.payerIsUser).toBe(true);
  });
});
