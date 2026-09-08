"use client";

import { useState } from "react";

import SecurityResult from "@/src/components/SecurityResult";

import { dAppTransactions, type DAppScenario } from "@/src/lib/dapp-transactions";

import { guardedSendTransaction } from "@/src/lib/txsentry";

export default function DAppDemoPage() {
  const [scenario, setScenario] = useState<DAppScenario>("SAFE_MINT");

  const [result, setResult] = useState<Awaited<ReturnType<typeof guardedSendTransaction>> | null>(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [txHash, setTxHash] = useState<string | null>(null);

  const selected = dAppTransactions[scenario];

  async function handleSend() {
    try {
      setLoading(true);
      setResult(null);
      setError(null);
      setTxHash(null);

      const response = await guardedSendTransaction({
        intent: selected.intent,

        transaction: selected.transaction,
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
      <div className="mx-auto max-w-4xl px-6 py-16">
        <div className="mb-10">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-zinc-600">Nalar Protocol</p>

          <h1 className="mt-4 text-4xl font-semibold">External dApp Simulator</h1>

          <p className="mt-4 max-w-2xl text-zinc-400">A third-party dApp creates the transaction. TxSentry inspects it before wallet signing.</p>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8">
            <div className="mb-5">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">Example dApp</p>

              <h2 className="mt-2 text-xl font-medium">Choose a transaction</h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(dAppTransactions) as DAppScenario[]).map((key) => {
                const item = dAppTransactions[key];

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
                    className={`rounded-2xl border p-5 text-left transition ${active ? (key === "SAFE_MINT" ? "border-green-800 bg-green-950/20" : "border-red-800 bg-red-950/20") : "border-zinc-800 bg-black hover:border-zinc-600"}`}
                  >
                    <p className="font-medium">{item.name}</p>

                    <p className="mt-2 text-sm leading-6 text-zinc-500">{item.description}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">User Intent</p>

            <p className="mt-3 text-lg text-zinc-200">{selected.intent}</p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-zinc-800 bg-black p-4">
                <p className="text-xs text-zinc-600">Contract</p>

                <p className="mt-2 break-all font-mono text-xs text-zinc-400">{selected.transaction.to}</p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-black p-4">
                <p className="text-xs text-zinc-600">Transaction value</p>

                <p className="mt-2 font-mono text-sm text-zinc-300">{selected.transaction.value.toString()} wei</p>
              </div>
            </div>

            <button type="button" onClick={handleSend} disabled={loading} className="mt-6 w-full rounded-xl bg-white px-5 py-4 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? "TxSentry is inspecting..." : "Send Transaction"}
            </button>
          </section>

          {error && (
            <section className="rounded-2xl border border-red-900 bg-red-950/30 p-5">
              <p className="text-sm text-red-300">{error}</p>
            </section>
          )}

          {result && <SecurityResult result={result.security} sending={false} txHash={txHash} />}
        </div>
      </div>
    </main>
  );
}
