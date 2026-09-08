"use client";

import { useEffect, useState } from "react";
import type { Hex } from "viem";

import { installNalarProviderGuard } from "@/src/lib/provider-guard";

import type { SecurityCheckResponse } from "@/src/lib/api";

const DEMO_NFT = "0x4ACCcd7a3d2e2a7c99BE0ea035B40cE03C7A14d1";

const SAFE_MINT_DATA = "0x6871ee40" as Hex;

const MALICIOUS_APPROVAL_DATA = "0x73fbd8db0000000000000000000000003333333333333333333333333333333333333333" as Hex;

type Scenario = "SAFE" | "MALICIOUS";

export default function InterceptionDemoPage() {
  const [scenario, setScenario] = useState<Scenario>("SAFE");

  const [intent, setIntent] = useState("I want to mint 1 NFT for 0.02 BNB");

  const [result, setResult] = useState<SecurityCheckResponse | null>(null);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    installNalarProviderGuard(
      () => intent,
      (security) => {
        setResult(security);
        setError(null);
      },
    );
  }, [intent]);

  async function simulateDApp() {
    setResult(null);
    setError(null);

    const ethereum = (
      window as Window & {
        ethereum?: {
          request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
        };
      }
    ).ethereum;

    if (!ethereum) {
      setError("No wallet provider found.");

      return;
    }

    const transaction =
      scenario === "SAFE"
        ? {
            from: undefined,
            to: DEMO_NFT,
            value: "0x470de4df820000",
            data: SAFE_MINT_DATA,
          }
        : {
            from: undefined,
            to: DEMO_NFT,
            value: "0x0",
            data: MALICIOUS_APPROVAL_DATA,
          };

    try {
      await ethereum.request({
        method: "eth_sendTransaction",
        params: [transaction],
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Transaction was rejected.");
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-600">Nalar Protocol</p>

        <h1 className="mt-4 text-4xl font-semibold">Provider Interception</h1>

        <p className="mt-4 max-w-2xl text-zinc-400">
          This simulates a third-party dApp calling
          <code className="mx-1 text-zinc-300">eth_sendTransaction</code>
          through the wallet provider.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setScenario("SAFE");
              setResult(null);
              setError(null);
            }}
            className={`rounded-2xl border p-5 text-left ${scenario === "SAFE" ? "border-green-800 bg-green-950/20" : "border-zinc-800 bg-zinc-950"}`}
          >
            <p className="font-medium">Safe Mint</p>

            <p className="mt-2 text-sm text-zinc-500">dApp requests safeMint().</p>
          </button>

          <button
            type="button"
            onClick={() => {
              setScenario("MALICIOUS");
              setResult(null);
              setError(null);
            }}
            className={`rounded-2xl border p-5 text-left ${scenario === "MALICIOUS" ? "border-red-800 bg-red-950/20" : "border-zinc-800 bg-zinc-950"}`}
          >
            <p className="font-medium">Malicious Approval</p>

            <p className="mt-2 text-sm text-zinc-500">dApp disguises NFT approval as minting.</p>
          </button>
        </div>

        <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8">
          <label htmlFor="intent" className="text-sm text-zinc-400">
            User intent
          </label>

          <textarea
            id="intent"
            value={intent}
            onChange={(event) => setIntent(event.target.value)}
            rows={3}
            className="mt-3 w-full resize-none rounded-xl border border-zinc-800 bg-black p-4 text-sm text-white outline-none focus:border-zinc-600"
          />

          <button type="button" onClick={simulateDApp} className="mt-5 w-full rounded-xl bg-white px-5 py-4 text-sm font-medium text-black hover:bg-zinc-200">
            dApp → eth_sendTransaction
          </button>
        </section>

        {result && (
          <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">TxSentry Verdict</p>

            <h2 className="mt-3 text-3xl font-semibold">{result.decision}</h2>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-zinc-800 bg-black p-4">
                <p className="text-xs text-zinc-600">Intent</p>

                <p className="mt-2 font-mono text-sm">{result.intent.action}</p>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-black p-4">
                <p className="text-xs text-zinc-600">Actual</p>

                <p className="mt-2 font-mono text-sm">{result.actual.action}</p>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-black p-4">
                <p className="text-xs text-zinc-600">Risk</p>

                <p className="mt-2 font-mono text-sm">{result.riskScore}/100</p>
              </div>
            </div>
          </section>
        )}

        {error && (
          <section className="mt-6 rounded-2xl border border-red-900 bg-red-950/30 p-5">
            <p className="text-sm text-red-300">{error}</p>
          </section>
        )}
      </div>
    </main>
  );
}
