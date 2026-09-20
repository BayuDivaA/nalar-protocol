import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import type { Address } from "viem";
import { BnbChainMcpClient } from "../bnb-mcp-client";
import { BnbAgentInvestigator } from "../bnb-agent-investigator";
import { auditToken } from "../token-auditor";
import { makeSecurityDecision } from "../../security-decision";

const SCAM_TOKEN = "0xe56E18ff683AbF6E1aA01804FaCaeB3694FDdd35" as Address;
const OWNER = "0x53E993819F2Bc45A029615e8634BDdEEab4F7817" as Address;
const ROUTER = "0x87FD5305E6a40F378da124864B2D479c2028BD86" as Address;

const GATEWAY_DIR = path.resolve(process.cwd(), "../bnb-mcp");
const PORT = 49821;
const INTERNAL_PORT = 49822;
const SECRET = "remote-e2e-secret-xyz-987";

describe("Remote MCP End-to-End Live Integration (Backend -> Remote MCP -> BSC Testnet)", () => {
  let mcpProcess: ChildProcess | null = null;
  let client: BnbChainMcpClient | null = null;
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    // Launch bnb-mcp server as child process
    mcpProcess = spawn("bun", ["src/server.ts"], {
      cwd: GATEWAY_DIR,
      env: {
        ...process.env,
        PORT: String(PORT),
        INTERNAL_MCP_PORT: String(INTERNAL_PORT),
        MCP_SHARED_SECRET: SECRET,
        BNB_RPC_URL: "https://data-seed-prebsc-1-s1.binance.org:8545",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    // Poll health check until ready (up to 20 seconds)
    let ready = false;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/health`);
        if (res.ok) {
          const body = (await res.json()) as { status?: string; ok?: boolean };
          if (body.status === "ok" || body.ok) {
            ready = true;
            break;
          }
        }
      } catch {
        // Wait and retry
      }
    }

    if (!ready) {
      if (mcpProcess) mcpProcess.kill("SIGTERM");
      throw new Error("Failed to start remote bnb-mcp server for integration test.");
    }

    process.env.BNB_MCP_TRANSPORT = "sse";
    process.env.BNB_MCP_URL = `http://127.0.0.1:${PORT}/sse`;
    process.env.MCP_AUTH_TOKEN = SECRET;
    process.env.BNB_INVESTIGATOR_ENABLED = "true";
    process.env.MCP_CONNECT_TIMEOUT_MS = "15000";
    process.env.MCP_TIMEOUT_MS = "20000";

    client = new BnbChainMcpClient();
    await client.connect();
  }, 30000);

  afterAll(async () => {
    if (client) {
      await client.close();
      client = null;
    }
    if (mcpProcess) {
      mcpProcess.kill("SIGTERM");
      mcpProcess = null;
    }
    process.env = originalEnv;
  });

  test("live NDEMO: verifies contract status over remote MCP", async () => {
    expect(client).toBeDefined();
    const isContractRes = (await client!.isContract({
      address: SCAM_TOKEN,
      network: "bsc-testnet",
    })) as { content: Array<{ type: string; text: string }> };

    const parsed = JSON.parse(isContractRes.content[0].text);
    expect(parsed.isContract).toBe(true);
  }, 20000);

  test("live NDEMO: reads token info over remote MCP", async () => {
    expect(client).toBeDefined();
    const tokenInfoRes = (await client!.getErc20TokenInfo({
      address: SCAM_TOKEN,
      network: "bsc-testnet",
    })) as { content: Array<{ type: string; text: string }> };

    const parsed = JSON.parse(tokenInfoRes.content[0].text);
    expect(parsed.name).toBe("Nalar Demo Honeypot");
    expect(parsed.symbol).toBe("NDEMO");
  }, 20000);

  test("live NDEMO: reads sellTax on-chain state over remote MCP", async () => {
    expect(client).toBeDefined();
    const sellTaxRes = (await client!.readContract({
      contractAddress: SCAM_TOKEN,
      abi: [
        {
          inputs: [],
          name: "sellTax",
          outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
          stateMutability: "view",
          type: "function",
        },
      ],
      functionName: "sellTax",
      args: [],
      network: "bsc-testnet",
    })) as { content: Array<{ type: string; text: string }> };

    expect(sellTaxRes.content[0].text).toContain("9800");
  }, 20000);

  test("live NDEMO: BnbAgentInvestigator extracts state and owner over remote MCP", async () => {
    expect(client).toBeDefined();
    const investigator = new BnbAgentInvestigator(client!);

    const investigation = await investigator.investigate({
      chainId: 97,
      token: SCAM_TOKEN,
      evidence: {
        isContract: true,
        capabilities: [
          {
            name: "sellTax",
            type: "tax",
            severity: "high",
            description: "Sell fee logic",
          },
          {
            name: "owner",
            type: "admin",
            severity: "info",
            description: "Contract owner",
          },
        ],
      },
    });

    expect(investigation.owner?.toLowerCase()).toBe(OWNER.toLowerCase());
    const sellTaxState = investigation.state?.find((s) => s.label === "sellTax");
    expect(sellTaxState).toBeDefined();
    expect(sellTaxState?.value).toBe("9800");
  }, 25000);

  test("live NDEMO: auditToken produces EXCESSIVE_SELL_TAX, riskScore 95, CRITICAL", async () => {
    expect(client).toBeDefined();
    const investigator = new BnbAgentInvestigator(client!);

    const audit = await auditToken({
      chainId: 97,
      token: SCAM_TOKEN,
      owner: OWNER,
      router: ROUTER,
      investigator,
    });

    expect(audit.riskLevel).toBe("CRITICAL");
    expect(audit.riskScore).toBe(95);

    const excessiveTax = audit.findings.find((f) => f.code === "EXCESSIVE_SELL_TAX");
    expect(excessiveTax).toBeDefined();
    expect(excessiveTax?.severity).toBe("CRITICAL");

    const sellTaxState = audit.contractPrivileges?.state?.find((s) => s.code === "CURRENT_SELL_TAX");
    expect(sellTaxState).toBeDefined();
    expect(sellTaxState?.value).toBe("9800");

    // Evaluate final deterministic security decision
    const decision = makeSecurityDecision({
      simulationSuccess: true,
      risk: {
        score: audit.riskScore,
        level: audit.riskLevel,
        reasons: audit.findings.map((finding) => finding.title),
      },
      comparison: {
        matches: true,
        mismatches: [],
      },
      effects: {
        approvals: [],
        swaps: [
          {
            type: "SWAP" as const,
            protocol: "PancakeSwap" as const,
            tokenIn: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd" as Address,
            tokenOut: SCAM_TOKEN,
            amountIn: 1_000_000_000_000_000n,
            amountOutMin: 0n,
            recipient: OWNER,
            payerIsUser: true,
            path: "0x" as `0x${string}`,
            hopTokens: ["0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd" as Address, SCAM_TOKEN],
            fees: [500],
          },
        ],
      },
      policy: {
        allowed: true,
        requiresReview: false,
        reasons: [],
      },
      scamAnalyses: [audit],
    });

    expect(decision.decision).toBe("BLOCK");
    expect(decision.reasons.some((reason) => reason.toLowerCase().includes("sell tax"))).toBe(true);
  }, 30000);
});
