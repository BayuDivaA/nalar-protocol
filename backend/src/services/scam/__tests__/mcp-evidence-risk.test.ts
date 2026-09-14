import { describe, expect, test } from "bun:test";
import type { Address } from "viem";

import { auditToken } from "../token-auditor";
import type { BlockchainEvidenceProvider, ContractEvidence, ScamInvestigator } from "../evidence-provider";

const TOKEN = "0x1111111111111111111111111111111111111111" as Address;

const OWNER = "0x2222222222222222222222222222222222222222" as Address;

const ROUTER = "0x3333333333333333333333333333333333333333" as Address;

const evidence: ContractEvidence = {
  verified: true,
  proxy: false,
  implementation: null,
  owner: OWNER,
  codeAvailable: true,

  capabilities: [
    {
      code: "TAX_CAPABILITY",
      category: "TAX",
      functionName: "setSellTax",
      functionSignature: "setSellTax(uint256)",
      evidenceSource: "ABI",
      confidence: "HIGH",
      access: "OWNER",
      evidence: "ABI exposes setSellTax(uint256).",
    },
  ],

  accessControl: [
    {
      mechanism: "OWNABLE",
      status: "VERIFIED",
      controller: "OWNER",
      address: OWNER,
      capabilityCodes: ["TAX_CAPABILITY"],
      evidenceSource: "ONCHAIN",
      confidence: "HIGH",
      evidence: `Current owner resolved to ${OWNER}.`,
    },
  ],

  state: [],
};

const provider: BlockchainEvidenceProvider = {
  async inspectContract() {
    return evidence;
  },
};

const investigator: ScamInvestigator = {
  async investigate() {
    return {
      summary: "BNB investigation completed. MCP contract state sellTax() returned 98%.",

      state: [
        {
          code: "CURRENT_SELL_TAX",
          label: "sellTax",
          value: "98",
          unit: "PERCENT",
          status: "KNOWN",
          evidenceSource: "ONCHAIN",
          evidence: "Read from BNB MCP read_contract().",
        },
      ],

      owner: OWNER,
    };
  },
};

describe("MCP evidence security reasoning", () => {
  test("98% sell tax produces CRITICAL scam risk", async () => {
    const result = await auditToken({
      chainId: 97,
      token: TOKEN,
      owner: OWNER,
      router: ROUTER,
      provider,
      investigator,
    });

    expect(result.findings.some((finding) => finding.code === "EXCESSIVE_SELL_TAX" && finding.severity === "CRITICAL")).toBe(true);

    expect(result.riskLevel).toBe("CRITICAL");
    expect(result.riskScore).toBeGreaterThanOrEqual(90);
  });

  test("owner-controlled excessive sell tax is correlated", async () => {
    const result = await auditToken({
      chainId: 97,
      token: TOKEN,
      owner: OWNER,
      router: ROUTER,
      provider,
      investigator,
    });

    const finding = result.findings.find((item) => item.code === "OWNER_CONTROLLED_EXCESSIVE_SELL_TAX");

    expect(finding).toBeDefined();
    expect(finding?.severity).toBe("CRITICAL");
  });

  test("MCP evidence is exposed through contractPrivileges.state", async () => {
    const result = await auditToken({
      chainId: 97,
      token: TOKEN,
      owner: OWNER,
      router: ROUTER,
      provider,
      investigator,
    });

    expect((result.contractPrivileges?.state ?? []).some((state) => state.code === "CURRENT_SELL_TAX" && state.status === "KNOWN" && state.value === "98")).toBe(true);
  });
});
