"use client";

import { useState } from "react";

import WalletButton from "@/src/components/WalletButton";
import IntentInput from "@/src/components/IntentInput";
import TransactionPreview from "@/src/components/TransactionPreview";
import SecurityResult from "@/src/components/SecurityResult";

import { securityCheck, type SecurityCheckResponse } from "@/src/lib/api";

const DEMO_NFT = "0x4ACCcd7a3d2e2a7c99BE0ea035B40cE03C7A14d1";

const SAFE_MINT_DATA = "0x6871ee40" as `0x${string}`;

const MALICIOUS_APPROVAL_DATA = "0x73fbd8db0000000000000000000000003333333333333333333333333333333333333333" as `0x${string}`;

type Scenario = "SAFE" | "MALICIOUS";

export default function Home() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  const [scenario, setScenario] = useState<Scenario>("SAFE");

  const [result, setResult] = useState<SecurityCheckResponse | null>(null);

  const [loading, setLoading] = useState(false);

  const [sending, setSending] = useState(false);

  const [txHash, setTxHash] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const selectedTransaction =
    scenario === "SAFE"
      ? {
          to: DEMO_NFT as `0x${string}`,
          value: BigInt("20000000000000000"),
          data: SAFE_MINT_DATA,
        }
      : {
          to: DEMO_NFT as `0x${string}`,
          value: BigInt("0"),
          data: MALICIOUS_APPROVAL_DATA,
        };

  async function handleAnalyze(intent: string) {
    if (!walletAddress) {
      setError("Connect your wallet first.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResult(null);
      setTxHash(null);

      const response = await securityCheck({
        intent,

        transaction: {
          chainId: 97,

          from: walletAddress,

          to: DEMO_NFT,

          value: scenario === "SAFE" ? "20000000000000000" : "0",

          data: scenario === "SAFE" ? SAFE_MINT_DATA : MALICIOUS_APPROVAL_DATA,
        },
      });

      setResult(response);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Security check failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-5xl px-6 py-10 sm:py-16">
        <header className="mb-12">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.3em] text-zinc-600">Nalar Protocol</p>

              <h1 className="mt-4 text-5xl font-semibold tracking-tight sm:text-6xl">Know before you sign.</h1>

              <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-400">Nalar translates and protects your blockchain transactions before they reach your wallet.</p>
            </div>
          </div>
        </header>

        <div className="space-y-6">
          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8">
            <div className="mb-5">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">01 / Wallet</p>

              <h2 className="mt-2 text-xl font-medium">Connect your wallet</h2>
            </div>

            <WalletButton onConnected={(address) => setWalletAddress(address)} />
          </section>

          {walletAddress && (
            <>
              <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8">
                <div className="mb-6">
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">02 / Transaction</p>

                  <h2 className="mt-2 text-xl font-medium">What do you want to do?</h2>
                </div>

                <div className="mb-6 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setScenario("SAFE");
                      setResult(null);
                      setError(null);
                      setTxHash(null);
                    }}
                    className={`rounded-2xl border p-5 text-left transition ${scenario === "SAFE" ? "border-zinc-300 bg-white text-black" : "border-zinc-800 bg-black text-white"}`}
                  >
                    <p className="font-medium">Legitimate Mint</p>

                    <p className="mt-2 text-sm opacity-70">Mint 1 NFT for 0.02 BNB.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setScenario("MALICIOUS");
                      setResult(null);
                      setError(null);
                      setTxHash(null);
                    }}
                    className={`rounded-2xl border p-5 text-left transition ${scenario === "MALICIOUS" ? "border-red-800 bg-red-950/20 text-white" : "border-zinc-800 bg-black text-white"}`}
                  >
                    <p className="font-medium">Suspicious Request</p>

                    <p className="mt-2 text-sm text-zinc-500">Looks like a mint, but requests NFT operator approval.</p>
                  </button>
                </div>

                <IntentInput onSubmit={handleAnalyze} loading={loading} />
              </section>

              <TransactionPreview
                transaction={{
                  chainId: 97,
                  to: selectedTransaction.to,
                  value: BigInt(selectedTransaction.value),
                  data: selectedTransaction.data,
                }}
                action={result?.actual.action ?? null}
                functionName={result?.actual.functionName ?? null}
              />

              {error && (
                <section className="rounded-2xl border border-red-900 bg-red-950/30 p-5">
                  <p className="text-sm text-red-300">{error}</p>
                </section>
              )}

              {result && <SecurityResult result={result} sending={sending} txHash={txHash} />}
            </>
          )}
        </div>

        <footer className="mt-16 border-t border-zinc-900 pt-6 text-xs text-zinc-700">Nalar Protocol · Protected by TxSentry</footer>
      </div>
    </main>
  );
}
