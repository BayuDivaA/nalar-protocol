"use client";

import { useState } from "react";
import type { Hex } from "viem";

const DEMO_NFT = "0x4ACCcd7a3d2e2a7c99BE0ea035B40cE03C7A14d1";

const REVIEW_DEMO = "0xa53Ed009044d8621F0DbbB4FD8f547fBBdB8a721";

const SAFE_MINT_DATA = "0x6871ee40" as Hex;

const MALICIOUS_APPROVAL_DATA = "0x73fbd8db0000000000000000000000003333333333333333333333333333333333333333" as Hex;

const REVIEW_PAYMENT_DATA = "0x11d895c5" as Hex;

type Scenario = "SAFE" | "REVIEW" | "MALICIOUS";

const scenarios = {
  SAFE: {
    title: "Safe Mint",
    description: "Legitimate NFT mint transaction.",
  },

  REVIEW: {
    title: "Large Payment",
    description: "Valid 0.6 BNB payment that exceeds the review threshold.",
  },

  MALICIOUS: {
    title: "Malicious Approval",
    description: "Looks like a mint, but requests NFT operator approval.",
  },
} as const;

export default function ExternalDAppPage() {
  const [scenario, setScenario] = useState<Scenario>("SAFE");

  const [status, setStatus] = useState("Ready.");

  const [loading, setLoading] = useState(false);

  async function connectWallet() {
    try {
      const ethereum = getEthereum();

      const accounts = (await ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];

      if (accounts.length === 0) {
        throw new Error("No wallet account connected.");
      }

      setStatus(`Connected: ${accounts[0]}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to connect wallet.");
    }
  }

  async function handleTransaction() {
    try {
      setLoading(true);
      setStatus("Requesting transaction...");

      const ethereum = getEthereum();

      const accounts = (await ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];

      if (accounts.length === 0) {
        throw new Error("No wallet account connected.");
      }

      const transaction =
        scenario === "SAFE"
          ? {
              from: accounts[0],
              to: DEMO_NFT,
              value: "0x470de4df820000",
              data: SAFE_MINT_DATA,
            }
          : scenario === "REVIEW"
            ? {
                from: accounts[0],
                to: REVIEW_DEMO,
                value: "0x853a0d231ce8000",
                data: REVIEW_PAYMENT_DATA,
              }
            : {
                from: accounts[0],
                to: DEMO_NFT,
                value: "0x0",
                data: MALICIOUS_APPROVAL_DATA,
              };

      const hash = await ethereum.request({
        method: "eth_sendTransaction",
        params: [transaction],
      });

      setStatus(`Transaction submitted: ${String(hash)}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Transaction rejected.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <div className="mb-10">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-zinc-600">Example External dApp</p>

          <h1 className="mt-4 text-4xl font-semibold">NFTceria</h1>

          <p className="mt-4 max-w-2xl text-zinc-500">This page simulates a third-party dApp. It only creates wallet transaction requests. Nalar handles the security decision.</p>
        </div>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">Choose Transaction</p>

            <h2 className="mt-2 text-xl font-medium">What does this dApp want to send?</h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {(Object.keys(scenarios) as Scenario[]).map((key) => {
              const item = scenarios[key];

              const active = scenario === key;

              const activeClass = key === "SAFE" ? "border-green-800 bg-green-950/20" : key === "REVIEW" ? "border-yellow-800 bg-yellow-950/20" : "border-red-800 bg-red-950/20";

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setScenario(key);
                    setStatus("Ready.");
                  }}
                  className={`rounded-2xl border p-5 text-left transition ${active ? activeClass : "border-zinc-800 bg-black hover:border-zinc-600"}`}
                >
                  <p className="font-medium">{item.title}</p>

                  <p className="mt-2 text-sm leading-6 text-zinc-500">{item.description}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-6 rounded-2xl border border-zinc-800 bg-black p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">User Intent</p>

            <p className="mt-3 text-base text-zinc-200">{scenario === "REVIEW" ? "I want to make a payment of 0.6 BNB" : "I want to mint 1 NFT for 0.02 BNB"}</p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-zinc-800 bg-black p-4">
              <p className="text-xs text-zinc-600">Target contract</p>

              <p className="mt-2 break-all font-mono text-xs text-zinc-400">{scenario === "REVIEW" ? REVIEW_DEMO : DEMO_NFT}</p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-black p-4">
              <p className="text-xs text-zinc-600">Transaction</p>

              <p className="mt-2 font-mono text-sm text-zinc-300">{scenario === "SAFE" ? "safeMint()" : scenario === "REVIEW" ? "payableAction()" : "maliciousApproval()"}</p>
            </div>
          </div>

          <button type="button" onClick={connectWallet} className="mt-6 w-full rounded-xl border border-zinc-700 px-5 py-4 text-sm font-medium text-white hover:bg-zinc-900">
            Connect Wallet
          </button>

          <button type="button" onClick={handleTransaction} disabled={loading} className="mt-3 w-full rounded-xl bg-white px-5 py-4 text-sm font-medium text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? "Requesting..." : "Send Transaction"}
          </button>

          <div className="mt-5 rounded-2xl border border-zinc-800 bg-black p-4">
            <p className="text-sm leading-6 text-zinc-400">{status}</p>
          </div>
        </section>
      </div>
    </main>
  );
}

function getEthereum() {
  if (typeof window === "undefined") {
    throw new Error("Wallet is only available in the browser.");
  }

  const ethereum = (
    window as Window & {
      ethereum?: {
        request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      };
    }
  ).ethereum;

  if (!ethereum) {
    throw new Error("No injected wallet provider found.");
  }

  return ethereum;
}
