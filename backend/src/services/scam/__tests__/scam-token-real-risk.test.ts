import { describe, expect, test } from "bun:test";
import type { Address } from "viem";

import { auditToken } from "../token-auditor";
import { BnbAgentInvestigator } from "../bnb-agent-investigator";

const SCAM_TOKEN = "0xe56E18ff683AbF6E1aA01804FaCaeB3694FDdd35" as Address;

const OWNER = "0x53E993819F2Bc45A029615e8634BDdEEab4F7817" as Address;

const ROUTER = "0x87FD5305E6a40F378da124864B2D479c2028BD86" as Address;

describe("REAL ScamToken security analysis", () => {
  test("real MCP sell tax produces critical risk", async () => {
    const investigator = new BnbAgentInvestigator();

    const result = await auditToken({
      chainId: 97,
      token: SCAM_TOKEN,
      owner: OWNER,
      router: ROUTER,
      investigator,
    });

    console.log("\n========== REAL SCAM ANALYSIS ==========");
    console.log(
      JSON.stringify(
        {
          riskScore: result.riskScore,
          riskLevel: result.riskLevel,
          findings: result.findings,
          contractPrivileges: result.contractPrivileges,
          agentAnalysis: result.agentAnalysis,
        },
        (_key, value) => (typeof value === "bigint" ? value.toString() : value),
        2,
      ),
    );
    console.log("========================================\n");

    expect(result.riskLevel).toBe("CRITICAL");

    expect(result.findings.some((finding) => finding.code === "EXCESSIVE_SELL_TAX" && finding.severity === "CRITICAL")).toBe(true);

    expect((result.contractPrivileges?.state ?? []).some((state) => state.code === "CURRENT_SELL_TAX" && state.value === "9800")).toBe(true);
  });
});
