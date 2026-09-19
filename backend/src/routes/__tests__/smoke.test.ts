import { describe, expect, test } from "bun:test";
import app from "../../index";

describe("Smoke Tests", () => {
  test("GET / returns API metadata", async () => {
    const res = await app.fetch(new Request("http://localhost/"));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.name).toBe("TxSentry API");
    expect(json.version).toBe("0.1.0");
    expect(json.description).toBeDefined();
  });

  test("GET /health returns status ok", async () => {
    const res = await app.fetch(new Request("http://localhost/health"));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.service).toBe("txsentry-api");
    expect(json.blockchain.chain).toBeDefined();
  });

  test("CORS headers returned for allowed origin", async () => {
    const res = await app.fetch(
      new Request("http://localhost/api/transactions", {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:3000",
          "Access-Control-Request-Method": "POST",
        },
      }),
    );
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
  });
});
