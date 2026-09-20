import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { securityRoute } from "../security";

const app = new Hono();
app.route("/api/transactions/security-check", securityRoute);

describe("Extension API Contract Compatibility", () => {
  test("accepts exact normalized transaction payload sent by extension background.js", async () => {
    // Exact schema emitted by extension/background.js:normalizeTransaction
    const extensionPayload = {
      intent: "Swap 0.001 tBNB to NDEMO",
      transaction: {
        chainId: 97,
        from: "0x53E993819F2Bc45A029615e8634BDdEEab4F7817",
        to: "0xe56E18ff683AbF6E1aA01804FaCaeB3694FDdd35",
        value: "0",
        data: "0x",
      },
    };

    const response = await app.fetch(
      new Request("http://localhost/api/transactions/security-check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "chrome-extension://abcdefghijklmnop",
        },
        body: JSON.stringify(extensionPayload),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    // Verify root contract keys expected by extension/injected.js
    expect(body.ok).toBe(true);
    expect(["ALLOW", "REVIEW", "BLOCK"]).toContain(body.decision);
    expect(typeof body.riskScore).toBe("number");
    expect(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).toContain(body.riskLevel);
    expect(typeof body.intentMatch).toBe("boolean");
    expect(body.simulation).toBeDefined();
    expect(typeof body.simulation.success).toBe("boolean");
    expect(body.explanation).toBeDefined();
    expect(typeof body.explanation.title).toBe("string");
    expect(typeof body.explanation.recommendedAction).toBe("string");

    // Phase 4 structured explanation fields
    expect(typeof body.explanation.headline).toBe("string");
    expect(body.explanation.whyStopped).toBeDefined();
    expect(typeof body.explanation.whyStopped.title).toBe("string");
    expect(typeof body.explanation.whyStopped.primaryReason).toBe("string");
    expect(typeof body.explanation.whyStopped.userImpact).toBe("string");
    expect(body.explanation.userIntent).toBeDefined();
    expect(["MATCH", "MISMATCH", "UNKNOWN"]).toContain(body.explanation.userIntent.status);
    expect(body.explanation.actualTransaction).toBeDefined();
    expect(body.explanation.comparison).toBeDefined();
    expect(Array.isArray(body.explanation.evidence)).toBe(true);
    expect(body.explanation.meta).toBeDefined();
    expect(["AI", "DETERMINISTIC"]).toContain(body.explanation.meta.generator);
  }, 15000);

  test("rejects invalid extension payloads with appropriate validation errors", async () => {
    // Missing required 'from' field
    const invalidPayload = {
      intent: "Test intent",
      transaction: {
        chainId: 97,
        to: "0xe56E18ff683AbF6E1aA01804FaCaeB3694FDdd35",
        value: "0",
        data: "0x",
      },
    };

    const response = await app.fetch(
      new Request("http://localhost/api/transactions/security-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidPayload),
      }),
    );

    expect(response.status).toBe(400);
  });

  test("rejects unsupported networks (chainId 1, chainId 56) with 400 UNSUPPORTED_CHAIN", async () => {
    // Ethereum Mainnet (chainId 1)
    const ethPayload = {
      intent: "Transfer 1 ETH",
      transaction: {
        chainId: 1,
        from: "0x53E993819F2Bc45A029615e8634BDdEEab4F7817",
        to: "0xe56E18ff683AbF6E1aA01804FaCaeB3694FDdd35",
        value: "1000000000000000000",
        data: "0x",
      },
    };

    const ethResponse = await app.fetch(
      new Request("http://localhost/api/transactions/security-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ethPayload),
      }),
    );

    expect(ethResponse.status).toBe(400);
    const ethBody = await ethResponse.json();
    expect(ethBody.ok).toBe(false);
    expect(ethBody.error).toBe("UNSUPPORTED_CHAIN");
    expect(ethBody.expectedChainId).toBe(97);
    expect(ethBody.receivedChainId).toBe(1);

    // BNB Smart Chain Mainnet (chainId 56)
    const bscPayload = {
      intent: "Swap 1 BNB to USDT",
      transaction: {
        chainId: 56,
        from: "0x53E993819F2Bc45A029615e8634BDdEEab4F7817",
        to: "0xe56E18ff683AbF6E1aA01804FaCaeB3694FDdd35",
        value: "0",
        data: "0x",
      },
    };

    const bscResponse = await app.fetch(
      new Request("http://localhost/api/transactions/security-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bscPayload),
      }),
    );

    expect(bscResponse.status).toBe(400);
    const bscBody = await bscResponse.json();
    expect(bscBody.ok).toBe(false);
    expect(bscBody.error).toBe("UNSUPPORTED_CHAIN");
    expect(bscBody.expectedChainId).toBe(97);
    expect(bscBody.receivedChainId).toBe(56);
  });
});
