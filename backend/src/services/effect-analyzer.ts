import { decodeAbiParameters, decodeFunctionData, isHex, type Address, type Hex } from "viem";

import { analyzeUniversalRouterCommands } from "./universal-router-analyzer";

import { decodeV3SwapExactIn } from "./universal-router-swap-decoder";
import { decodeV2SwapExactIn } from "./universal-router-v2-swap-decoder";
import { securityAbi } from "../lib/abis";

/**
 * ==================================================
 * ERC20 ALLOWANCE
 * ==================================================
 */
export interface ERC20AllowanceEffect {
  type: "ERC20_ALLOWANCE";

  token: Address;

  owner: Address;

  spender: Address;

  amount: bigint;

  unlimited: boolean;

  sourceFunction: "approve" | "permit" | "permit2";
}

/**
 * ==================================================
 * ERC721 OPERATOR APPROVAL
 * ==================================================
 */
export interface ERC721ApprovalEffect {
  type: "ERC721_OPERATOR";

  token: Address;

  owner: Address;

  operator: Address;

  approved: boolean;

  sourceFunction: "setApprovalForAll" | "maliciousApproval";
}

/**
 * ==================================================
 * SWAP
 * ==================================================
 */
export interface SwapEffect {
  type: "SWAP";

  protocol: "PancakeSwap";

  tokenIn: Address;

  tokenOut: Address;

  amountIn: bigint;

  amountOutMin: bigint;

  recipient: Address;

  payerIsUser: boolean;

  path: Hex;

  hopTokens: Address[];

  fees: number[];

  tokenInSymbol?: string | null;

  tokenOutSymbol?: string | null;

  tokenInDecimals?: number | null;

  tokenOutDecimals?: number | null;
}

/**
 * ==================================================
 * APPROVAL UNION
 * ==================================================
 */
export type ApprovalEffect = ERC20AllowanceEffect | ERC721ApprovalEffect;

/**
 * ==================================================
 * MINT EFFECT
 * ==================================================
 */
export interface MintEffect {
  type: "MINT";

  contract: Address;

  recipient: Address;

  quantity: number | null;
}

/**
 * ==================================================
 * TRANSACTION EFFECTS
 * ==================================================
 */
export interface TransactionEffects {
  approvals: ApprovalEffect[];

  swaps: SwapEffect[];

  mints?: MintEffect[];
}

/**
 * ==================================================
 * CONSTANTS
 * ==================================================
 */
const MAX_UINT256 = 2n ** 256n - 1n;

/**
 * ==================================================
 * INPUT
 * ==================================================
 */
export interface AnalyzeEffectsInput {
  to: Address;

  from: Address;

  functionName?: string;

  args?: readonly unknown[];

  /**
   * Identifies a known protocol.
   *
   * Currently:
   * - PancakeSwap
   */
  protocol?: string;
}

/**
 * ==================================================
 * TYPE HELPERS
 * ==================================================
 */

/**
 * Safely read an address-like value from decoded ABI
 * arguments.
 */
function getAddressArgument(value: unknown): Address | undefined {
  if (typeof value !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    return undefined;
  }

  return value as Address;
}

/**
 * Safely read a bigint ABI argument.
 */
function getBigIntArgument(value: unknown): bigint | undefined {
  return typeof value === "bigint" ? value : undefined;
}

/**
 * Safely determine whether a value is a readonly
 * array of hex strings.
 */
function isHexArray(value: unknown): value is readonly Hex[] {
  return Array.isArray(value) && value.every((item) => isHex(item));
}

function decodePermit2Single(input: Hex): { token: Address; spender: Address; amount: bigint } | null {
  try {
    const [permit] = decodeAbiParameters(
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
      input,
    );

    const decoded = permit as { details: { token: Address; amount: bigint }; spender: Address };
    return { token: decoded.details.token, spender: decoded.spender, amount: decoded.details.amount };
  } catch {
    return null;
  }
}

function decodePermit2Batch(input: Hex): { token: Address; spender: Address; amount: bigint }[] {
  try {
    const [permit] = decodeAbiParameters(
      [
        {
          type: "tuple",
          components: [
            { name: "details", type: "tuple[]", components: [{ name: "token", type: "address" }, { name: "amount", type: "uint160" }, { name: "expiration", type: "uint48" }, { name: "nonce", type: "uint48" }] },
            { name: "spender", type: "address" },
            { name: "sigDeadline", type: "uint256" },
          ],
        },
        { type: "bytes" },
      ],
      input,
    );

    const decoded = permit as { details: readonly { token: Address; amount: bigint }[]; spender: Address };
    return decoded.details.map((detail) => ({ token: detail.token, spender: decoded.spender, amount: detail.amount }));
  } catch {
    return [];
  }
}

/**
 * ==================================================
 * MAIN EFFECT ANALYZER
 * ==================================================
 */
export function analyzeEffects(input: AnalyzeEffectsInput, depth = 0): TransactionEffects {
  const effects: TransactionEffects = {
    approvals: [],
    swaps: [],
    mints: [],
  };

  /**
   * ==================================================
   * ERC20 approve(address,uint256)
   * ==================================================
   */
  if (input.functionName === "approve") {
    const spender = getAddressArgument(input.args?.[0]);

    const amount = getBigIntArgument(input.args?.[1]);

    if (spender !== undefined && amount !== undefined) {
      effects.approvals.push({
        type: "ERC20_ALLOWANCE",

        token: input.to,

        owner: input.from,

        spender,

        amount,

        unlimited: amount === MAX_UINT256,

        sourceFunction: "approve",
      });
    }
  }

  /** EIP-2612 permit authorizes the same allowance as approve without an on-chain approve call. */
  if (input.functionName === "permit") {
    const owner = getAddressArgument(input.args?.[0]);
    const spender = getAddressArgument(input.args?.[1]);
    const amount = getBigIntArgument(input.args?.[2]);

    if (owner !== undefined && spender !== undefined && amount !== undefined) {
      effects.approvals.push({ type: "ERC20_ALLOWANCE", token: input.to, owner, spender, amount, unlimited: amount === MAX_UINT256, sourceFunction: "permit" });
    }
  }

  /** Decode standard bytes[] multicalls only two levels deep to avoid hostile recursive calldata. */
  if (input.functionName === "multicall" && depth < 2 && isHexArray(input.args?.[0])) {
    for (const call of input.args[0]) {
      try {
        const decoded = decodeFunctionData({ abi: securityAbi, data: call });
        const nested = analyzeEffects({ ...input, functionName: decoded.functionName, args: decoded.args ?? [] }, depth + 1);
        effects.approvals.push(...nested.approvals);
      } catch {
        // An unknown nested call remains subject to the outer transaction's fail-safe classifier.
      }
    }
  }

  /**
   * ==================================================
   * ERC721 setApprovalForAll(address,bool)
   * ==================================================
   */
  if (input.functionName === "setApprovalForAll") {
    const operator = getAddressArgument(input.args?.[0]);

    const approved = typeof input.args?.[1] === "boolean" ? input.args[1] : undefined;

    if (operator !== undefined && approved !== undefined) {
      effects.approvals.push({
        type: "ERC721_OPERATOR",

        token: input.to,

        owner: input.from,

        operator,

        approved,

        sourceFunction: "setApprovalForAll",
      });
    }
  }

  /**
   * ==================================================
   * Demo maliciousApproval(address)
   * ==================================================
   */
  if (input.functionName === "maliciousApproval") {
    const operator = getAddressArgument(input.args?.[0]);

    if (operator !== undefined) {
      effects.approvals.push({
        type: "ERC721_OPERATOR",

        token: input.to,

        owner: input.from,

        operator,

        approved: true,

        sourceFunction: "maliciousApproval",
      });
    }
  }

  /**
   * ==================================================
   * NFT / Token Mint
   * ==================================================
   */
  if (input.functionName === "mint" || input.functionName === "safeMint") {
    let quantity: number | null = 1;
    if (input.args && input.args.length > 0) {
      if (typeof input.args[0] === "bigint") {
        quantity = Number(input.args[0]);
      } else if (input.args.length > 1 && typeof input.args[1] === "bigint") {
        quantity = Number(input.args[1]);
      }
    }
    effects.mints?.push({
      type: "MINT",
      contract: input.to,
      recipient: input.from,
      quantity,
    });
  }

  /**
   * ==================================================
   * PancakeSwap Universal Router
   *
   * execute(bytes,bytes[])
   * execute(bytes,bytes[],uint256)
   * ==================================================
   */
  if (input.functionName === "execute" && input.protocol === "PancakeSwap") {
    const commands = input.args?.[0];

    const routerInputs = input.args?.[1];

    /**
     * We expect:
     *
     * args[0] = commands
     * args[1] = inputs
     */
    if (isHex(commands) && isHexArray(routerInputs)) {
      try {
        const commandAnalysis = analyzeUniversalRouterCommands({
          commands,
          inputs: routerInputs,
        });

        /**
         * ----------------------------------------------
         * Analyze each router command
         * ----------------------------------------------
         */
        for (const command of commandAnalysis.commands) {
          /**
           * --------------------------------------------
           * V3 exact input swap
           * --------------------------------------------
           */
          if (command.command === "V3_SWAP_EXACT_IN") {
            try {
              const swap = decodeV3SwapExactIn(command.input);

              effects.swaps.push({
                type: "SWAP",

                protocol: "PancakeSwap",

                tokenIn: swap.tokenIn,

                tokenOut: swap.tokenOut,

                amountIn: swap.amountIn,

                amountOutMin: swap.amountOutMin,

                recipient: swap.recipient,

                payerIsUser: swap.payerIsUser,

                path: swap.path,

                hopTokens: swap.hopTokens,

                fees: swap.fees,
              });
            } catch (error) {
              /**
               * A malformed swap command should not
               * crash the entire transaction analyzer.
               *
               * Later the security engine can convert
               * this into an UNKNOWN / REVIEW signal.
               */
              console.error("[SWAP ANALYZER]", error);
            }
          }

          /**
           * --------------------------------------------
           * V2 exact input swap
           * --------------------------------------------
           */
          if (command.command === "V2_SWAP_EXACT_IN") {
            try {
              const swap = decodeV2SwapExactIn(command.input);

              effects.swaps.push({
                type: "SWAP",

                protocol: "PancakeSwap",

                tokenIn: swap.tokenIn,

                tokenOut: swap.tokenOut,

                amountIn: swap.amountIn,

                amountOutMin: swap.amountOutMin,

                recipient: swap.recipient,

                payerIsUser: swap.payerIsUser,

                /**
                 * V2 does not use the packed V3 path format.
                 *
                 * We keep a stable hex representation here so
                 * TransactionEffects remains compatible.
                 */
                path: command.input,

                hopTokens: swap.hopTokens,

                /**
                 * V2 has no pool-fee values encoded like V3.
                 */
                fees: [],
              });
            } catch (error) {
              console.error("[V2 SWAP ANALYZER]", error);
            }
          }

          if (command.command === "PERMIT2_PERMIT") {
            const permit = decodePermit2Single(command.input);

            if (permit) {
              effects.approvals.push({ type: "ERC20_ALLOWANCE", token: permit.token, owner: input.from, spender: permit.spender, amount: permit.amount, unlimited: permit.amount === MAX_UINT256, sourceFunction: "permit2" });
            }
          }

          if (command.command === "PERMIT2_PERMIT_BATCH") {
            for (const permit of decodePermit2Batch(command.input)) {
              effects.approvals.push({ type: "ERC20_ALLOWANCE", token: permit.token, owner: input.from, spender: permit.spender, amount: permit.amount, unlimited: permit.amount === MAX_UINT256, sourceFunction: "permit2" });
            }
          }
        }
      } catch (error) {
        /**
         * Invalid Universal Router command stream.
         *
         * We intentionally do not throw here because
         * effect analysis should remain non-destructive.
         */
        console.error("[UNIVERSAL ROUTER]", error);
      }
    }
  }

  return effects;
}
