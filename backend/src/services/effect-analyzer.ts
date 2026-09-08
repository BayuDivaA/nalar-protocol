import { isHex, type Address, type Hex } from "viem";

import { analyzeUniversalRouterCommands } from "./universal-router-analyzer";

import { decodeV3SwapExactIn } from "./universal-router-swap-decoder";

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

  sourceFunction: "approve";
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
 * TRANSACTION EFFECTS
 * ==================================================
 */
export interface TransactionEffects {
  approvals: ApprovalEffect[];

  swaps: SwapEffect[];
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

/**
 * ==================================================
 * MAIN EFFECT ANALYZER
 * ==================================================
 */
export function analyzeEffects(input: AnalyzeEffectsInput): TransactionEffects {
  const effects: TransactionEffects = {
    approvals: [],
    swaps: [],
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
