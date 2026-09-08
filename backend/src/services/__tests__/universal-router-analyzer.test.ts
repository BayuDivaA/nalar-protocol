import { describe, expect, test } from "bun:test";

import { analyzeUniversalRouterCommands } from "../universal-router-analyzer";

describe("Universal Router Command Analyzer", () => {
  test("should decode V3 swap command", () => {
    const result = analyzeUniversalRouterCommands({
      commands: "0x00",
      inputs: ["0x1234"],
    });

    expect(result.isUniversalRouter).toBe(true);

    expect(result.commands).toHaveLength(1);

    const command = result.commands[0]!;

    expect(command.index).toBe(0);

    expect(command.rawCommand).toBe(0x00);

    expect(command.command).toBe("V3_SWAP_EXACT_IN");

    expect(command.allowRevert).toBe(false);

    expect(command.input).toBe("0x1234");
  });

  test("should detect allow-revert flag", () => {
    const result = analyzeUniversalRouterCommands({
      commands: "0x80",
      inputs: ["0x"],
    });

    const command = result.commands[0]!;

    expect(command.rawCommand).toBe(0x80);

    expect(command.command).toBe("V3_SWAP_EXACT_IN");

    expect(command.allowRevert).toBe(true);
  });

  test("should decode multiple commands", () => {
    const result = analyzeUniversalRouterCommands({
      commands: "0x0b0008",
      inputs: ["0x01", "0x02", "0x03"],
    });

    expect(result.commands).toHaveLength(3);

    expect(result.commands[0]!.command).toBe("WRAP_ETH");

    expect(result.commands[1]!.command).toBe("V3_SWAP_EXACT_IN");

    expect(result.commands[2]!.command).toBe("V2_SWAP_EXACT_IN");
  });

  test("should reject mismatched command/input count", () => {
    expect(() =>
      analyzeUniversalRouterCommands({
        commands: "0x0001",
        inputs: ["0x"],
      }),
    ).toThrow("command/input length mismatch");
  });
});
