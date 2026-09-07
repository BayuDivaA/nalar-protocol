"use client";

import { useState } from "react";

import WalletButton from "@/src/components/WalletButton";
import IntentInput from "@/src/components/IntentInput";
import TransactionPreview from "@/src/components/TransactionPreview";
import type { Hex } from "viem";

import { sendTransaction } from "@/src/lib/wallet";
import ScenarioSelector from "@/src/components/ScenarioSelector";

import { demoTransactions, type DemoScenario } from "@/src/lib/demo-transactions";

import { securityCheck, type SecurityCheckResponse } from "@/src/lib/api";
import SecurityResult from "@/src/components/SecurityResult";

export default function Home() {
  // const DEMO_NFT = "0x4ACCcd7a3d2e2a7c99BE0ea035B40cE03C7A14d1";

  // const SAFE_MINT_DATA = "0x6871ee40" as `0x${string}`;
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  const [result, setResult] = useState<SecurityCheckResponse | null>(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [sending, setSending] = useState(false);

  const [txHash, setTxHash] = useState<string | null>(null);

  const [scenario, setScenario] = useState<DemoScenario>("SAFE_MINT");

  const selectedTransaction = demoTransactions[scenario];

  async function handleAnalyze(intent: string) {
    if (!walletAddress) {
      setError("Connect your wallet first.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const response = await securityCheck({
        intent,

        transaction: {
          chainId: 97,
          from: walletAddress,
          to: selectedTransaction.to,
          value: selectedTransaction.value,
          data: selectedTransaction.data,
        },
      });

      setResult(response);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Security check failed.");
    } finally {
      setLoading(false);
    }
  }

  // Handler signing and sending the transaction if the security check passes
  async function handleProceed() {
    if (!result) {
      return;
    }

    if (result.decision !== "ALLOW") {
      setError("This transaction is not allowed to proceed.");

      return;
    }

    if (!walletAddress) {
      setError("Connect your wallet first.");

      return;
    }

    try {
      setSending(true);
      setError(null);
      setTxHash(null);

      const hash = await sendTransaction({
        account: walletAddress as `0x${string}`,
        to: selectedTransaction.to,
        value: BigInt(selectedTransaction.value),
        data: selectedTransaction.data as Hex,
      });

      setTxHash(hash);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Transaction signing failed.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <header className="mb-10">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-zinc-500">Web3 Transaction Firewall</p>

          <h1 className="mt-4 text-5xl font-semibold tracking-tight sm:text-6xl">TxSentry</h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-400">Understand what you are signing before it reaches your wallet.</p>
        </header>

        <div className="space-y-6">
          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8">
            <div className="mb-6">
              <h2 className="text-lg font-medium">Wallet</h2>

              <p className="mt-2 text-sm text-zinc-500">Connect to BNB Testnet.</p>
            </div>

            <WalletButton onConnected={(address) => setWalletAddress(address)} />
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8">
            <div className="mb-5">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">Demo Scenario</p>

              <h2 className="mt-2 text-lg font-medium">Choose transaction</h2>
            </div>

            <ScenarioSelector
              value={scenario}
              onChange={(value) => {
                setScenario(value);
                setResult(null);
                setError(null);
                setTxHash(null);
              }}
            />
          </section>

          <h2 className="mt-2 text-lg font-medium">{selectedTransaction.name}</h2>

          <p className="mt-2 text-sm text-zinc-500">{selectedTransaction.description}</p>

          {walletAddress && (
            <>
              <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8">
                <IntentInput onSubmit={handleAnalyze} loading={loading} />
              </section>

              <TransactionPreview address={walletAddress} />
            </>
          )}

          {error && (
            <section className="rounded-2xl border border-red-900 bg-red-950/30 p-5">
              <p className="text-sm text-red-300">{error}</p>
            </section>
          )}

          {result && <SecurityResult result={result} onProceed={handleProceed} sending={sending} txHash={txHash} />}
        </div>
      </div>
    </main>
  );
}
