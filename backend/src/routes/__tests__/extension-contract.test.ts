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
          "Origin": "chrome-extension://abcdefghijklmnop",
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
  });

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
});
