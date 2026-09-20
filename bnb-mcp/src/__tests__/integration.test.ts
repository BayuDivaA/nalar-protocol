import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { createApp } from "../server.js";
import type { Server } from "node:http";

describe("MCP Gateway HTTP & Auth Integration", () => {
  const TEST_PORT = 3987;
  const SECRET = "test-integration-secret-777";
  let server: Server;

  beforeAll((done) => {
    process.env.MCP_SHARED_SECRET = SECRET;
    process.env.PORT = String(TEST_PORT);

    const app = createApp();
    server = app.listen(TEST_PORT, "127.0.0.1", () => {
      done();
    });
  });

  afterAll((done) => {
    server.close(() => {
      done();
    });
  });

  test("GET /health returns 200 without authentication", async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/health`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.ok).toBe(true);
    expect(data.service).toBe("bnb-mcp");
  });

  test("GET /ready returns readiness probe info without authentication", async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/ready`);
    expect([200, 503]).toContain(res.status);

    const data = await res.json();
    expect(["ready", "not_ready"]).toContain(data.status);
    expect(data.service).toBe("bnb-mcp");
    expect(data.network).toBe("bsc-testnet");
    expect(typeof data.rpc).toBe("boolean");
    expect(typeof data.mcp).toBe("boolean");
  });

  test("GET /sse returns 401 Unauthorized without Authorization header", async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/sse`);
    expect(res.status).toBe(401);

    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  test("GET /sse returns 401 Unauthorized with invalid Bearer token", async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/sse`, {
      headers: {
        Authorization: "Bearer invalid-wrong-token",
      },
    });
    expect(res.status).toBe(401);

    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  test("POST /messages returns 401 Unauthorized without Authorization header", async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/messages?sessionId=test-123`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", method: "ping", id: 1 }),
    });
    expect(res.status).toBe(401);
  });
});
