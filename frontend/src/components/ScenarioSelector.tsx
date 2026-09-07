"use client";

import type { DemoScenario } from "@/src/lib/demo-transactions";

interface ScenarioSelectorProps {
  value: DemoScenario;
  onChange: (value: DemoScenario) => void;
}

export default function ScenarioSelector({ value, onChange }: ScenarioSelectorProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <button
        type="button"
        onClick={() => onChange("SAFE_MINT")}
        className={`rounded-2xl border p-4 text-left transition ${value === "SAFE_MINT" ? "border-white bg-white text-black" : "border-zinc-800 bg-zinc-950 text-white hover:border-zinc-600"}`}
      >
        <p className="font-medium">Safe Mint</p>

        <p className={`mt-1 text-sm ${value === "SAFE_MINT" ? "text-zinc-600" : "text-zinc-500"}`}>Mint 1 NFT for 0.02 BNB.</p>
      </button>

      <button
        type="button"
        onClick={() => onChange("MALICIOUS_APPROVAL")}
        className={`rounded-2xl border p-4 text-left transition ${value === "MALICIOUS_APPROVAL" ? "border-red-700 bg-red-950/30 text-white" : "border-zinc-800 bg-zinc-950 text-white hover:border-zinc-600"}`}
      >
        <p className="font-medium">Malicious Approval</p>

        <p className="mt-1 text-sm text-zinc-500">Pretends to mint but requests NFT control.</p>
      </button>
    </div>
  );
}
