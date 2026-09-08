"use client";

import type { Hex } from "viem";

interface TransactionPreviewProps {
  transaction: {
    chainId: number;
    to: string;
    value: bigint;
    data: Hex;
  };

  functionName?: string | null;
  action?: string | null;
}

export default function TransactionPreview({ transaction, functionName, action }: TransactionPreviewProps) {
  const valueInBNB = Number(transaction.value) / 1e18;

  return (
    <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">03 / Transaction Preview</p>

          <h2 className="mt-2 text-xl font-medium">What will be sent?</h2>
        </div>

        <span className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-500">BNB Testnet</span>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <InfoCard label="Action" value={action ?? "Not analyzed"} />

        <InfoCard label="Function" value={functionName ?? "Not decoded"} />
      </div>

      <div className="mt-3">
        <InfoCard label="Value" value={`${valueInBNB} BNB`} />
      </div>

      <div className="mt-3 rounded-2xl border border-zinc-800 bg-black p-4">
        <p className="text-xs text-zinc-600">Contract</p>

        <p className="mt-2 break-all font-mono text-xs leading-5 text-zinc-400">{transaction.to}</p>
      </div>

      <div className="mt-3 rounded-2xl border border-zinc-800 bg-black p-4">
        <p className="text-xs text-zinc-600">Calldata</p>

        <p className="mt-2 break-all font-mono text-xs leading-5 text-zinc-500">{transaction.data}</p>
      </div>
    </section>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-black p-4">
      <p className="text-xs text-zinc-600">{label}</p>

      <p className="mt-2 font-mono text-sm text-white">{value}</p>
    </div>
  );
}
