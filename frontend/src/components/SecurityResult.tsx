"use client";

import type { SecurityCheckResponse } from "@/src/lib/api";

interface SecurityResultProps {
  result: SecurityCheckResponse;
  onProceed?: () => void;
  onReviewConfirm?: () => void;
  sending?: boolean;
  reviewing?: boolean;
  txHash?: string | null;
}

const decisionConfig = {
  ALLOW: {
    label: "SAFE TO PROCEED",
    badge: "ALLOW",
    description: "This transaction matches what you intended to do.",
  },

  REVIEW: {
    label: "REVIEW REQUIRED",
    badge: "REVIEW",
    description: "This transaction needs your attention before signing.",
  },

  BLOCK: {
    label: "TRANSACTION BLOCKED",
    badge: "BLOCK",
    description: "TxSentry detected a security issue and stopped the transaction.",
  },
} as const;

export default function SecurityResult({ result, onProceed, onReviewConfirm, sending = false, reviewing = false, txHash = null }: SecurityResultProps) {
  const config = decisionConfig[result.decision];

  const isAllowed = result.decision === "ALLOW";

  return (
    <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950">
      <div className="p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-zinc-600">Security Verdict</p>

            <div className="mt-4 flex items-center gap-3">
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${
                  result.decision === "ALLOW" ? "border-green-900 bg-green-950/40 text-green-400" : result.decision === "REVIEW" ? "border-yellow-900 bg-yellow-950/40 text-yellow-400" : "border-red-900 bg-red-950/40 text-red-400"
                }`}
              >
                {config.badge}
              </span>

              <span className="text-sm text-zinc-500">{config.label}</span>
            </div>

            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">{result.explanation.title}</h2>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">{config.description}</p>
          </div>

          {/* Risk score */}
          <div className="shrink-0 text-right">
            <p className="text-xs uppercase tracking-wider text-zinc-600">Risk</p>

            <p className="mt-1 font-mono text-2xl text-white">
              {result.riskScore}
              <span className="text-zinc-600">/100</span>
            </p>

            <p className="mt-1 text-xs text-zinc-500">{result.riskLevel}</p>
          </div>
        </div>

        {/* Summary */}
        <div className="mt-8 border-t border-zinc-800 pt-6">
          <p className="text-base leading-7 text-zinc-200">{result.explanation.summary}</p>
        </div>

        {/* Transaction facts */}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <InfoCard label="Your intent" value={result.intent.action} />

          <InfoCard label="Actual action" value={result.actual.action} />

          <InfoCard label="Intent match" value={result.intentMatch ? "MATCH" : "MISMATCH"} />
        </div>

        {/* Details */}
        <div className="mt-6 rounded-2xl border border-zinc-800 bg-black p-5">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-600">Analysis</p>

          <div className="mt-4 space-y-3">
            {result.explanation.details.map((detail) => (
              <div key={detail} className="flex gap-3 text-sm leading-6 text-zinc-400">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-600" />

                <p>{detail}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Technical transaction info */}
        <div className="mt-6 grid gap-4 rounded-2xl border border-zinc-800 bg-black p-5 sm:grid-cols-2">
          <InfoRow label="Function" value={result.transaction?.functionName ?? result.actual.functionName ?? "Unknown"} />

          <InfoRow label="Selector" value={result.transaction?.selector ?? result.actual.selector ?? "—"} />

          <InfoRow label="Contract" value={result.contract?.address ?? "—"} />

          <InfoRow label="ABI source" value={result.contract?.abiSource ?? "unknown"} />
        </div>

        {/* Proceed */}
        {isAllowed && onProceed && (
          <button type="button" onClick={onProceed} disabled={sending} className="mt-6 w-full rounded-xl bg-white px-5 py-4 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50">
            {sending ? "Waiting for wallet..." : "Proceed to Wallet"}
          </button>
        )}

        {/* Block */}
        {result.decision === "BLOCK" && (
          <div className="mt-6 rounded-2xl border border-red-900/70 bg-red-950/20 p-5">
            <p className="text-sm font-medium text-red-300">Signing has been blocked</p>

            <p className="mt-2 text-sm leading-6 text-red-400/70">TxSentry will not send this transaction to your wallet.</p>
          </div>
        )}

        {/* Review */}
        {result.decision === "REVIEW" && (
          <div className="mt-6">
            <div className="rounded-2xl border border-yellow-900/70 bg-yellow-950/20 p-5">
              <p className="text-sm font-medium text-yellow-300">Additional confirmation required</p>

              <p className="mt-2 text-sm leading-6 text-yellow-400/70">Review the transaction details carefully before allowing it to reach your wallet.</p>

              {result.policy.evaluation.reasons.length > 0 && (
                <div className="mt-4 space-y-2">
                  {result.policy.evaluation.reasons.map((reason) => (
                    <p key={reason} className="text-sm text-yellow-300/80">
                      {reason}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {onReviewConfirm && (
              <button
                type="button"
                onClick={onReviewConfirm}
                disabled={reviewing}
                className="mt-4 w-full rounded-xl border border-yellow-700 px-5 py-4 text-sm font-medium text-yellow-300 transition hover:bg-yellow-950/30 disabled:opacity-50"
              >
                {reviewing ? "Waiting for wallet..." : "Review & Continue"}
              </button>
            )}
          </div>
        )}

        {/* Submitted */}
        {txHash && (
          <div className="mt-4 rounded-2xl border border-zinc-800 bg-black p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">Transaction submitted</p>

            <p className="mt-2 break-all font-mono text-xs leading-5 text-zinc-400">{txHash}</p>
          </div>
        )}
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-600">{label}</p>

      <p className="mt-1 break-all font-mono text-xs text-zinc-400">{value}</p>
    </div>
  );
}
