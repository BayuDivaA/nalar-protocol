import { decodeAbiParameters, type Address, type Hex } from "viem";

export type UniversalRouterCommand =
  | "V3_SWAP_EXACT_IN"
  | "V3_SWAP_EXACT_OUT"
  | "V2_SWAP_EXACT_IN"
  | "V2_SWAP_EXACT_OUT"
  | "PERMIT2_TRANSFER_FROM"
  | "PERMIT2_PERMIT_BATCH"
  | "SWEEP"
  | "TRANSFER"
  | "PAY_PORTION"
  | "PERMIT2_PERMIT"
  | "WRAP_ETH"
  | "UNWRAP_WETH"
  | "PERMIT2_TRANSFER_FROM_BATCH"
  | "BALANCE_CHECK_ERC20"
  | "INFI_SWAP"
  | "STABLE_SWAP_EXACT_IN"
  | "STABLE_SWAP_EXACT_OUT"
  | "EXECUTE_SUB_PLAN"
  | "UNKNOWN";

export interface UniversalRouterDecodedCommand {
  index: number;
  rawCommand: number;
  command: UniversalRouterCommand;
  allowRevert: boolean;
  input: Hex;
}

export interface UniversalRouterAnalysis {
  isUniversalRouter: true;
  commands: UniversalRouterDecodedCommand[];
}

const COMMAND_NAMES: Record<number, UniversalRouterCommand> = {
  0x00: "V3_SWAP_EXACT_IN",
  0x01: "V3_SWAP_EXACT_OUT",
  0x02: "PERMIT2_TRANSFER_FROM",
  0x03: "PERMIT2_PERMIT_BATCH",
  0x04: "SWEEP",
  0x05: "TRANSFER",
  0x06: "PAY_PORTION",

  0x08: "V2_SWAP_EXACT_IN",
  0x09: "V2_SWAP_EXACT_OUT",
  0x0a: "PERMIT2_PERMIT",
  0x0b: "WRAP_ETH",
  0x0c: "UNWRAP_WETH",
  0x0d: "PERMIT2_TRANSFER_FROM_BATCH",
  0x0e: "BALANCE_CHECK_ERC20",

  0x10: "INFI_SWAP",

  0x21: "EXECUTE_SUB_PLAN",

  0x22: "STABLE_SWAP_EXACT_IN",
  0x23: "STABLE_SWAP_EXACT_OUT",
};

function hexByteToNumber(value: string): number {
  return Number.parseInt(value, 16);
}

export function analyzeUniversalRouterCommands(input: { commands: Hex; inputs: readonly Hex[] }): UniversalRouterAnalysis {
  const commandsHex = input.commands.slice(2);

  if (commandsHex.length % 2 !== 0) {
    throw new Error("Universal Router commands must contain complete bytes.");
  }

  const commandCount = commandsHex.length / 2;

  if (commandCount !== input.inputs.length) {
    throw new Error(`Universal Router command/input length mismatch: ${commandCount} commands, ${input.inputs.length} inputs.`);
  }

  const commands: UniversalRouterDecodedCommand[] = [];

  for (let i = 0; i < commandCount; i++) {
    const byteHex = commandsHex.slice(i * 2, i * 2 + 2);

    const rawCommand = hexByteToNumber(byteHex);

    /**
     * PancakeSwap/Universal Router:
     *
     * 0x80 = FLAG_ALLOW_REVERT
     * 0x3f = COMMAND_TYPE_MASK
     */
    const allowRevert = (rawCommand & 0x80) !== 0;

    const commandType = rawCommand & 0x3f;

    commands.push({
      index: i,
      rawCommand,
      command: COMMAND_NAMES[commandType] ?? "UNKNOWN",
      allowRevert,
      input: input.inputs[i]!,
    });
  }

  return {
    isUniversalRouter: true,
    commands,
  };
}
