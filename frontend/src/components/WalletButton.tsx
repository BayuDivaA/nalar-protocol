"use client";

import { useState } from "react";
import type { Address } from "viem";

import { connectWallet, switchToBscTestnet } from "@/src/lib/wallet";

const BSC_TESTNET_CHAIN_ID = 97;

interface WalletButtonProps {
  onConnected?: (address: Address) => void;
}

export default function WalletButton({ onConnected }: WalletButtonProps) {
  const [address, setAddress] = useState<Address | null>(null);

  const [chainId, setChainId] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    try {
      setLoading(true);
      setError(null);

      let wallet = await connectWallet();

      if (wallet.chainId !== BSC_TESTNET_CHAIN_ID) {
        await switchToBscTestnet();

        wallet = await connectWallet();
      }

      setAddress(wallet.address);
      setChainId(wallet.chainId);

      onConnected?.(wallet.address);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to connect wallet.");
    } finally {
      setLoading(false);
    }
  }

  if (address) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-black p-5">
        <p className="text-xs uppercase tracking-widest text-zinc-500">Connected Wallet</p>

        <p className="mt-2 break-all font-mono text-sm text-white">{address}</p>

        <div className="mt-4 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-400" />

          <span className="text-sm text-zinc-300">{chainId === BSC_TESTNET_CHAIN_ID ? "BNB Testnet" : `Chain ${chainId}`}</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button type="button" onClick={handleConnect} disabled={loading} className="w-full rounded-xl bg-white px-5 py-3 font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50">
        {loading ? "Connecting..." : "Connect Wallet"}
      </button>

      {error && <div className="mt-3 rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{error}</div>}
    </div>
  );
}
