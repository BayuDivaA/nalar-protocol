// @ts-expect-error Bun supplies the test module at runtime.
import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";

import { AddressApiError, getExplainerReport } from "./address-api";

const address = "0x1111111111111111111111111111111111111111";
const hash = `0x${"a".repeat(64)}`;

test("API configuration defaults to production, normalizes URLs, and preserves explicit local development", () => {
  const moduleUrl = new URL("./api.ts", import.meta.url).href;
  for (const [configured, expected] of [
    [undefined, "https://nalar-protocol.vercel.app"],
    ["", "https://nalar-protocol.vercel.app"],
    ["  https://nalar-protocol.vercel.app/  ", "https://nalar-protocol.vercel.app"],
    ["http://localhost:3001/", "http://localhost:3001"],
  ]) {
    const actual = execFileSync(process.execPath, ["--no-env-file", "--eval", `import { API_URL } from ${JSON.stringify(moduleUrl)}; process.stdout.write(API_URL);`], {
      env: { ...process.env, NEXT_PUBLIC_API_URL: configured },
      encoding: "utf8",
    });
    expect(actual).toBe(expected);
  }
});

test("address and transaction hash use distinct request fields on the selected chain", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<Record<string, unknown>> = [];
  globalThis.fetch = (async (_url, init) => {
    const request = JSON.parse(String(init?.body)) as Record<string, unknown>;
    requests.push(request);
    return new Response(JSON.stringify({ kind: "transaction", hash, facts: [], chainId: request.chainId }), { status: 200 });
  }) as typeof fetch;
  try {
    await getExplainerReport({ chainId: 56, query: address });
    await getExplainerReport({ chainId: 97, query: hash });
    expect(requests).toEqual([{ chainId: 56, address }, { chainId: 97, txHash: hash }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("invalid subject never reaches the API", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = (async () => { called = true; throw new Error("Unexpected request"); }) as typeof fetch;
  try {
    await expect(getExplainerReport({ chainId: 56, query: "0x123" })).rejects.toBeInstanceOf(AddressApiError);
    expect(called).toBe(false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("unreachable backend is a connection error, not an on-chain finding", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => { throw new TypeError("Failed to fetch"); }) as typeof fetch;
  try {
    await expect(getExplainerReport({ chainId: 56, query: address })).rejects.toMatchObject({
      code: "CONNECTION_FAILED",
      message: "Nalar's analysis service could not be reached. Check your connection and retry.",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("cancelling a lookup preserves the abort rather than reporting a connection failure", async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  controller.abort();
  globalThis.fetch = (async () => { throw controller.signal.reason; }) as typeof fetch;
  try {
    await expect(getExplainerReport({ chainId: 97, query: address }, controller.signal)).rejects.toBe(controller.signal.reason);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("backend errors keep their existing code and explanation", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ error: "RPC_UNAVAILABLE", message: "BNB Testnet could not be read. Please retry." }), { status: 503 })) as typeof fetch;
  try {
    await expect(getExplainerReport({ chainId: 97, query: address })).rejects.toMatchObject({
      code: "RPC_UNAVAILABLE",
      message: "BNB Testnet could not be read. Please retry.",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
