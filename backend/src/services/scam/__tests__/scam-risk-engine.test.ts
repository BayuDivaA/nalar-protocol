import { describe, expect, test } from "bun:test";

import type { ScamFinding } from "../findings";
import { calculateScamRisk } from "../scam-risk-engine";
import type { Address } from "viem";
import { auditToken } from "../token-auditor";

const TOKEN = "0x1111111111111111111111111111111111111111" as Address;
const USER = "0x2222222222222222222222222222222222222222" as Address;
const ROUTER = "0x3333333333333333333333333333333333333333" as Address;

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

  test("unverified contract alone does not create security risk", async () => {
    const result = await auditToken({
      chainId: 97,
      token: TOKEN,
      owner: USER,
      router: ROUTER,
      provider: {
        async inspectContract() {
          return {
            verified: false,
            proxy: false,
            implementation: null,
            owner: null,
            codeAvailable: true,
            capabilities: [],
            accessControl: [],
            state: [],
          };
        },
      },
    });

    expect(result.riskScore).toBe(0);
    expect(result.riskLevel).toBe("LOW");

    expect(result.findings.some((finding) => finding.code === "UNVERIFIED_CONTRACT")).toBe(true);
  });
});
