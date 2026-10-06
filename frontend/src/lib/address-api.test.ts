// @ts-expect-error Bun supplies the test module at runtime.
import { expect, test } from "bun:test";

import { AddressApiError, getExplainerReport } from "./address-api";

const address = "0x1111111111111111111111111111111111111111";
const hash = `0x${"a".repeat(64)}`;

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
