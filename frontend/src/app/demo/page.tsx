"use client";

import { useState } from "react";
import type { Hex } from "viem";

import { guardedSendTransaction } from "@/src/lib/txsentry";

import SecurityResult from "@/src/components/SecurityResult";

const DEMO_NFT = "0x4ACCcd7a3d2e2a7c99BE0ea035B40cE03C7A14d1";

const SAFE_MINT_DATA = "0x6871ee40" as Hex;

const MALICIOUS_APPROVAL_DATA = "0x73fbd8db0000000000000000000000003333333333333333333333333333333333333333" as Hex;

type Scenario = "SAFE" | "MALICIOUS";

const scenarios = {
  SAFE: {
    title: "Safe NFT Mint",
    intent: "I want to mint 1 NFT for 0.02 BNB",
    transaction: {
      to: DEMO_NFT as `0x${string}`,
      value: 20_000_000_000_000_000n,
      data: SAFE_MINT_DATA,
    },
  },

  MALICIOUS: {
    title: "Malicious NFT Approval",
    intent: "I want to mint 1 NFT for 0.02 BNB",
    transaction: {
      to: DEMO_NFT as `0x${string}`,
      value: 0n,
      data: MALICIOUS_APPROVAL_DATA,
    },
  },
} as const;

export default function DemoPage() {
  const [scenario, setScenario] = useState<Scenario>("SAFE");

  const [result, setResult] = useState<Awaited<ReturnType<typeof guardedSendTransaction>> | null>(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [txHash, setTxHash] = useState<string | null>(null);

  const selected = scenarios[scenario];

  async function runSecurityCheck() {
    try {
      setLoading(true);
      setResult(null);
      setError(null);
      setTxHash(null);

      const response = await guardedSendTransaction({
        intent: selected.intent,

        transaction: {
          chainId: 97,
          to: selected.transaction.to,
          value: selected.transaction.value,
          data: selected.transaction.data,
        },
      });

      setResult(response);

      if (response.txHash) {
        setTxHash(response.txHash);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Transaction failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-600">External dApp Simulator</p>

        <h1 className="mt-4 text-4xl font-semibold">TxSentry Gateway</h1>

        <p className="mt-4 max-w-xl text-zinc-400">This page simulates a third-party dApp sending a transaction through TxSentry before wallet signing.</p>

        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {(Object.keys(scenarios) as Scenario[]).map((key) => {
            const item = scenarios[key];

            const active = scenario === key;

            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setScenario(key);
                  setResult(null);
                  setError(null);
                  setTxHash(null);
                }}
                className={`rounded-2xl border p-5 text-left transition ${active ? (key === "SAFE" ? "border-green-800 bg-green-950/20" : "border-red-800 bg-red-950/20") : "border-zinc-800 bg-zinc-950 hover:border-zinc-600"}`}
              >
                <p className="font-medium">{item.title}</p>

                <p className="mt-2 text-sm text-zinc-500">{item.intent}</p>
              </button>
            );
          })}
        </div>

        <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">Requested Intent</p>

          <p className="mt-3 text-base text-zinc-200">{selected.intent}</p>

          <button type="button" onClick={runSecurityCheck} disabled={loading} className="mt-6 w-full rounded-xl bg-white px-5 py-4 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:opacity-50">
            {loading ? "TxSentry is checking..." : "Send Through TxSentry"}
          </button>
        </section>

        {error && <div className="mt-6 rounded-2xl border border-red-900 bg-red-950/30 p-5 text-sm text-red-300">{error}</div>}

        {result && (
          <div className="mt-6">
            <SecurityResult result={result.security} sending={loading} txHash={txHash} />
          </div>
        )}
      </div>
    </main>
  );
}
