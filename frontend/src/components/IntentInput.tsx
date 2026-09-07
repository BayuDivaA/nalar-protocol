"use client";

import { useState } from "react";

interface IntentInputProps {
  onSubmit: (intent: string) => void;
  loading?: boolean;
}

export default function IntentInput({ onSubmit, loading = false }: IntentInputProps) {
  const [intent, setIntent] = useState("I want to mint 1 NFT for 0.02 BNB");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = intent.trim();

    if (!trimmed) {
      return;
    }

    onSubmit(trimmed);
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="intent" className="text-sm font-medium text-zinc-300">
        What do you want to do?
      </label>

      <textarea
        id="intent"
        value={intent}
        onChange={(event) => setIntent(event.target.value)}
        placeholder="Describe what you want to do on-chain..."
        rows={4}
        disabled={loading}
        className="mt-3 w-full resize-none rounded-2xl border border-zinc-800 bg-black px-4 py-4 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-600 focus:border-zinc-500 disabled:opacity-50"
      />

      <button type="submit" disabled={loading || !intent.trim()} className="mt-4 w-full rounded-xl bg-white px-5 py-3 font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50">
        {loading ? "Analyzing..." : "Analyze Transaction"}
      </button>
    </form>
  );
}
