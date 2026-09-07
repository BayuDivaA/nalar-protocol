"use client";

import { useState } from "react";

import type { Hex } from "viem";

import { guardedSendTransaction } from "@/src/lib/txsentry";

export default function TransactionGateway() {
  const [intent, setIntent] = useState("I want to mint 1 NFT for 0.02 BNB");

  const [loading, setLoading] = useState(false);

  const [status, setStatus] = useState<string | null>(null);

  const [txHash, setTxHash] = useState<string | null>(null);

  async function handleSend() {
    try {
      setLoading(true);
      setStatus(null);
      setTxHash(null);

      const result = await guardedSendTransaction({
        intent,

        transaction: {
          chainId: 97,

          to: "0x4ACCcd7a3d2e2a7c99BE0ea035B40cE03C7A14d1",

          value: 20_000_000_000_000_000n,

          data: "0x6871ee40" as Hex,
        },
      });

      if (result.security.decision === "BLOCK") {
        setStatus("BLOCKED — MetaMask was not called.");

        return;
      }

      if (result.txHash) {
        setStatus("Transaction submitted successfully.");

        setTxHash(result.txHash);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Transaction failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8">
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">Transaction Gateway</p>

      <h2 className="mt-2 text-xl font-medium">Send through TxSentry</h2>

      <textarea value={intent} onChange={(event) => setIntent(event.target.value)} rows={3} className="mt-6 w-full resize-none rounded-xl border border-zinc-800 bg-black p-4 text-sm text-white outline-none focus:border-zinc-600" />

      <button type="button" onClick={handleSend} disabled={loading} className="mt-4 w-full rounded-xl bg-white px-5 py-4 text-sm font-medium text-black hover:bg-zinc-200 disabled:opacity-50">
        {loading ? "Checking transaction..." : "Send Transaction"}
      </button>

      {status && <div className="mt-5 rounded-xl border border-zinc-800 bg-black p-4 text-sm text-zinc-300">{status}</div>}

      {txHash && <div className="mt-3 break-all rounded-xl border border-zinc-800 bg-black p-4 font-mono text-xs text-zinc-500">{txHash}</div>}
    </section>
  );
}
