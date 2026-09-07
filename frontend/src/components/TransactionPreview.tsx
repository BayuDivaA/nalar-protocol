interface TransactionPreviewProps {
  address: string;
}

export default function TransactionPreview({ address }: TransactionPreviewProps) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">Demo Transaction</p>

          <h2 className="mt-2 text-lg font-medium text-white">Safe NFT Mint</h2>
        </div>

        <div className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-400">BNB Testnet</div>
      </div>

      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between gap-6">
          <span className="text-sm text-zinc-500">Action</span>

          <span className="font-mono text-sm text-white">MINT</span>
        </div>

        <div className="flex items-center justify-between gap-6">
          <span className="text-sm text-zinc-500">Amount</span>

          <span className="font-mono text-sm text-white">0.02 BNB</span>
        </div>

        <div>
          <p className="text-sm text-zinc-500">From</p>

          <p className="mt-1 break-all font-mono text-xs text-zinc-300">{address}</p>
        </div>

        <div>
          <p className="text-sm text-zinc-500">Contract</p>

          <p className="mt-1 break-all font-mono text-xs text-zinc-300">0x4ACCcd7a3d2e2a7c99BE0ea035B40cE03C7A14d1</p>
        </div>
      </div>
    </section>
  );
}
