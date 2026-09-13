import { describe, expect, test } from "bun:test";

import type { ScamFinding } from "../findings";
import { calculateScamRisk } from "../scam-risk-engine";

const finding = (overrides: Partial<ScamFinding> = {}): ScamFinding => ({
  code: "UNVERIFIED_CONTRACT",
  severity: "MEDIUM",
  title: "Contract source is unverified",
  description: "The contract ABI could not be verified.",
  source: "CONTRACT",
  ...overrides,
});

describe("Scam risk engine", () => {
  test("keeps an empty evidence set low risk", () => {
    expect(calculateScamRisk([])).toEqual({ score: 0, level: "LOW", reasons: [] });
  });

  test("does not make an unverified contract automatically critical", () => {
    const result = calculateScamRisk([finding()]);

    expect(result.level).toBe("MEDIUM");
    expect(result.score).toBeLessThan(80);
  });

  test("treats a verified failed sell simulation as critical", () => {
    const result = calculateScamRisk([
      finding({
        code: "SELL_SIMULATION_FAILED",
        severity: "CRITICAL",
        title: "Sell simulation failed",
        description: "A simulated sell reverted.",
        source: "SIMULATION",
      }),
    ]);

    expect(result.level).toBe("CRITICAL");
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  test("caps lower-severity aggregation below critical", () => {
    const result = calculateScamRisk([
      finding(),
      finding({ code: "LIQUIDITY_LOW", title: "Low liquidity" }),
      finding({ code: "HOLDER_CONCENTRATION_HIGH", title: "Concentrated holders" }),
      finding({ code: "OWNER_CAN_CHANGE_TAX", title: "Configurable tax" }),
    ]);

    expect(result.level).not.toBe("CRITICAL");
  });
});
