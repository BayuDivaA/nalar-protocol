"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ThemeToggle from "@/src/components/ThemeToggle";
import { useInView } from "@/src/lib/useInView";

/* ─── Section wrapper with scroll-triggered reveal ─── */

function Section({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const { ref, inView } = useInView(0.1);
  return (
    <section
      ref={ref}
      id={id}
      className={`animate-reveal ${inView ? "in-view" : ""} ${className}`}
    >
      {children}
    </section>
  );
}

/* ─── Navbar ─── */

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 16);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && mobileOpen) setMobileOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 ${
        scrolled
          ? "border-b border-border bg-background/80 backdrop-blur-md"
          : "bg-transparent"
      }`}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          className="text-sm font-semibold tracking-[0.12em] text-text-primary"
        >
          NALAR
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-6 md:flex">
          <a
            href="#how-it-works"
            className="text-[13px] text-text-secondary hover:text-text-primary"
          >
            How it works
          </a>
          <a
            href="#security"
            className="text-[13px] text-text-secondary hover:text-text-primary"
          >
            Security
          </a>
          <Link
            href="/demo"
            className="text-[13px] text-text-secondary hover:text-text-primary"
          >
            Demo
          </Link>
          <ThemeToggle />
          <Link
            href="/demo"
            className="rounded-md bg-text-primary px-4 py-2 text-[13px] font-medium text-background hover:opacity-90"
          >
            Try Nalar
          </Link>
        </div>

        {/* Mobile menu button */}
        <div className="flex items-center gap-3 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-text-muted"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu panel */}
      {mobileOpen && (
        <div className="border-b border-border bg-background px-5 pb-5 pt-2 md:hidden">
          <div className="flex flex-col gap-4">
            <a
              href="#how-it-works"
              onClick={() => setMobileOpen(false)}
              className="text-sm text-text-secondary hover:text-text-primary"
            >
              How it works
            </a>
            <a
              href="#security"
              onClick={() => setMobileOpen(false)}
              className="text-sm text-text-secondary hover:text-text-primary"
            >
              Security
            </a>
            <Link
              href="/demo"
              onClick={() => setMobileOpen(false)}
              className="text-sm text-text-secondary hover:text-text-primary"
            >
              Demo
            </Link>
            <Link
              href="/demo"
              className="mt-2 rounded-md bg-text-primary px-4 py-2.5 text-center text-sm font-medium text-background"
            >
              Try Nalar
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

/* ─── Hero Transaction Surface ─── */

function HeroTransactionSurface() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setActive(true), 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`rounded-lg border border-border bg-surface overflow-hidden ${
        active ? "hero-active" : ""
      }`}
    >
      {/* Intent */}
      <div className="hero-step border-b border-border p-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-text-muted">
          Your intent
        </p>
        <p className="mt-2 text-sm text-text-primary">
          Swap 0.001 tBNB to NDEMO
        </p>
      </div>

      {/* Transaction */}
      <div className="hero-step border-b border-border p-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-text-muted">
          Transaction
        </p>
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className="text-text-primary">SWAP</span>
          <span className="text-text-muted">&middot;</span>
          <span className="font-mono text-xs text-text-secondary">
            WBNB &rarr; NDEMO
          </span>
        </div>
        <p className="mt-1 text-xs text-text-muted">PancakeSwap</p>
      </div>

      {/* Analysis */}
      <div className="hero-step border-b border-border p-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-text-muted">
          Nalar analysis
        </p>
        <div className="mt-2 space-y-1.5">
          {[
            "Decoding transaction",
            "Simulating execution",
            "Inspecting contract state",
            "Reading on-chain evidence",
          ].map((step) => (
            <p key={step} className="text-xs text-text-secondary">
              {step}
            </p>
          ))}
        </div>
      </div>

      {/* Evidence */}
      <div className="hero-step border-b border-border p-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-text-muted">
          Evidence
        </p>
        <div className="mt-2 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-text-muted">Sell tax</span>
            <span className="font-mono text-danger">98.00%</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-text-muted">Buy tax</span>
            <span className="font-mono text-text-secondary">0.00%</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-text-muted">Owner controlled</span>
            <span className="font-mono text-warning">Yes</span>
          </div>
        </div>
      </div>

      {/* Decision */}
      <div className="hero-step p-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="inline-block rounded bg-danger/15 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.05em] text-danger">
              Block
            </span>
            <p className="mt-2 text-xs text-text-secondary">
              Current sell tax is excessive.
            </p>
          </div>
          <p className="font-mono text-lg text-danger">100<span className="text-text-muted">/100</span></p>
        </div>
      </div>
    </div>
  );
}

/* ─── How Nalar Works (numbered sequence) ─── */

const howSteps = [
  {
    number: "01",
    title: "Understand",
    description: "Read what the user says they want to do.",
  },
  {
    number: "02",
    title: "Decode",
    description: "Identify what the transaction is actually calling.",
  },
  {
    number: "03",
    title: "Simulate",
    description: "Evaluate how the transaction is expected to execute.",
  },
  {
    number: "04",
    title: "Inspect",
    description: "Check contract behavior and relevant on-chain state.",
  },
  {
    number: "05",
    title: "Compare",
    description: "Match the intended action against actual effects.",
  },
  {
    number: "06",
    title: "Decide",
    description: "Produce a security verdict: ALLOW, REVIEW, or BLOCK.",
  },
];

/* ─── Security Evidence Example ─── */

const evidenceRows = [
  { label: "Current sell tax", value: "98.00%", highlight: true },
  { label: "Current buy tax", value: "0.00%", highlight: false },
  { label: "Owner", value: "0x53E9...7817", mono: true, highlight: false },
  { label: "Network", value: "BNB Testnet", highlight: false },
  { label: "On-chain state", value: "Confirmed", highlight: false },
];

/* ─── Architecture Steps ─── */

const archSteps = [
  "Intent parsing",
  "Transaction decoding",
  "Execution simulation",
  "Effect analysis",
  "Contract state reading",
  "Evidence collection",
];

/* ─── Landing Page ─── */

export default function LandingPage() {
  return (
    <>
      <Navbar />

      <main className="pt-14">
        {/* ═══ HERO ═══ */}
        <div className="mx-auto max-w-[1120px] px-5 sm:px-8">
          <div className="grid gap-10 pb-20 pt-16 sm:pt-24 lg:grid-cols-[1fr_400px] lg:gap-16 lg:pt-32 lg:pb-28">
            {/* Left: copy */}
            <div className="flex flex-col justify-center">
              <h1 className="text-[clamp(2rem,5vw,3.25rem)] font-semibold leading-[1.1] tracking-tight text-text-primary">
                Know what
                <br />
                you&apos;re signing.
              </h1>
              <p className="mt-6 max-w-[520px] text-base leading-7 text-text-secondary">
                Nalar analyzes Web3 transactions before they reach your wallet,
                comparing what you intended to do with what the transaction
                actually does.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/demo"
                  className="rounded-md bg-text-primary px-5 py-2.5 text-sm font-medium text-background hover:opacity-90"
                >
                  Try the demo
                </Link>
                <a
                  href="#how-it-works"
                  className="rounded-md border border-border px-5 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:border-border-strong"
                >
                  How Nalar works
                </a>
              </div>
            </div>

            {/* Right: transaction surface */}
            <div className="flex items-start justify-center lg:justify-end">
              <div className="w-full max-w-[380px]">
                <HeroTransactionSurface />
                <p className="mt-3 text-center text-[11px] text-text-muted">
                  Interactive example
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className="mx-auto max-w-[1120px] px-5 sm:px-8">
          <div className="border-t border-border" />
        </div>

        {/* ═══ THE PROBLEM ═══ */}
        <Section className="mx-auto max-w-[1120px] px-5 py-20 sm:px-8 sm:py-28">
          <div className="max-w-[640px]">
            <p className="text-[22px] font-medium leading-8 text-text-primary sm:text-[26px] sm:leading-9">
              Wallets show you what a transaction contains.
              <br />
              <span className="text-text-muted">
                They don&apos;t always tell you what it means.
              </span>
            </p>
            <p className="mt-6 text-[15px] leading-7 text-text-secondary">
              A transaction can look ordinary while interacting with a contract
              in ways a normal user cannot easily interpret. Nalar adds a
              semantic security layer that reads intent, decodes behavior, and
              surfaces evidence before the transaction reaches your wallet.
            </p>
          </div>
        </Section>

        <div className="mx-auto max-w-[1120px] px-5 sm:px-8">
          <div className="border-t border-border" />
        </div>

        {/* ═══ HOW NALAR WORKS ═══ */}
        <Section
          id="how-it-works"
          className="mx-auto max-w-[1120px] px-5 py-20 sm:px-8 sm:py-28"
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
            How Nalar works
          </p>
          <h2 className="mt-3 text-[22px] font-semibold tracking-tight text-text-primary sm:text-[28px]">
            Six stages between you and a transaction.
          </h2>

          <div className="mt-12 grid gap-0 sm:mt-16">
            {howSteps.map((step, i) => (
              <div
                key={step.number}
                className={`flex gap-5 py-5 sm:gap-8 sm:py-6 ${
                  i < howSteps.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <span className="font-mono text-sm text-text-muted pt-0.5">
                  {step.number}
                </span>
                <div>
                  <h3 className="text-sm font-medium text-text-primary uppercase tracking-[0.06em]">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-[15px] leading-6 text-text-secondary">
                    {step.description}
                  </p>
                  {step.number === "06" && (
                    <div className="mt-3 flex gap-2">
                      <span className="rounded bg-safe/15 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.05em] text-safe">
                        Allow
                      </span>
                      <span className="rounded bg-warning/15 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.05em] text-warning">
                        Review
                      </span>
                      <span className="rounded bg-danger/15 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.05em] text-danger">
                        Block
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <div className="mx-auto max-w-[1120px] px-5 sm:px-8">
          <div className="border-t border-border" />
        </div>

        {/* ═══ INTENT VS TRANSACTION ═══ */}
        <Section className="mx-auto max-w-[1120px] px-5 py-20 sm:px-8 sm:py-28">
          <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
            Intent comparison
          </p>
          <h2 className="mt-3 text-[22px] font-semibold tracking-tight text-text-primary sm:text-[28px]">
            What did you intend to do?
          </h2>
          <p className="mt-4 max-w-[520px] text-[15px] leading-7 text-text-secondary">
            Nalar compares what you said you wanted with what the transaction
            actually does. This comparison is the core of the security analysis.
          </p>

          <div className="mt-10 grid gap-4 sm:mt-14 md:grid-cols-2 md:gap-6">
            {/* Intent side */}
            <div className="rounded-lg border border-border bg-surface p-5">
              <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-text-muted">
                Your intent
              </p>
              <p className="mt-3 text-[15px] text-text-primary">
                &ldquo;Swap 0.001 tBNB to NDEMO&rdquo;
              </p>
            </div>

            {/* Actual transaction side */}
            <div className="rounded-lg border border-border bg-surface p-5">
              <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-text-muted">
                Actual transaction
              </p>
              <div className="mt-3">
                <p className="text-sm font-medium text-text-primary">SWAP</p>
                <p className="mt-1 font-mono text-xs text-text-secondary">
                  WBNB &rarr; NDEMO
                </p>
                <p className="mt-1 text-xs text-text-muted">PancakeSwap</p>
              </div>
            </div>
          </div>

          {/* Result */}
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-safe/30 bg-safe/5 px-5 py-3">
            <span className="inline-block rounded bg-safe/15 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.05em] text-safe">
              Matched
            </span>
            <p className="text-sm text-text-secondary">
              The transaction matches the stated intent.
            </p>
          </div>
        </Section>

        <div className="mx-auto max-w-[1120px] px-5 sm:px-8">
          <div className="border-t border-border" />
        </div>

        {/* ═══ SECURITY REASONING ═══ */}
        <Section
          id="security"
          className="mx-auto max-w-[1120px] px-5 py-20 sm:px-8 sm:py-28"
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
            Security reasoning
          </p>
          <h2 className="mt-3 text-[22px] font-semibold tracking-tight text-text-primary sm:text-[28px]">
            Nalar explains why it blocks a transaction.
          </h2>
          <p className="mt-4 max-w-[540px] text-[15px] leading-7 text-text-secondary">
            Not a vague risk score. A deterministic decision with on-chain
            evidence you can verify.
          </p>

          {/* Security verdict example */}
          <div className="mt-10 rounded-lg border border-border bg-surface overflow-hidden sm:mt-14">
            {/* Verdict header */}
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-5 sm:p-6">
              <div>
                <span className="inline-block rounded bg-danger/15 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.05em] text-danger">
                  Block
                </span>
                <h3 className="mt-3 text-lg font-medium text-text-primary">
                  Current sell tax is excessive.
                </h3>
                <p className="mt-2 text-sm text-text-secondary">
                  The transaction was not forwarded to the wallet.
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-[0.15em] text-text-muted">
                  Risk
                </p>
                <p className="mt-1 font-mono text-xl text-text-primary">
                  100<span className="text-text-muted">/100</span>
                </p>
                <p className="mt-0.5 text-[11px] text-danger">Critical</p>
              </div>
            </div>

            {/* Evidence rows */}
            <div className="p-5 sm:p-6">
              <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-text-muted">
                Evidence
              </p>
              <div className="mt-4 divide-y divide-border">
                {evidenceRows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between py-2.5"
                  >
                    <span className="text-sm text-text-secondary">
                      {row.label}
                    </span>
                    <span
                      className={`text-sm ${
                        row.mono ? "font-mono" : ""
                      } ${row.highlight ? "text-danger" : "text-text-primary"}`}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-6 text-[13px] text-text-muted">
            Interactive example. Evidence is read from on-chain contract state.
          </p>
        </Section>

        <div className="mx-auto max-w-[1120px] px-5 sm:px-8">
          <div className="border-t border-border" />
        </div>

        {/* ═══ HOW TO USE ═══ */}
        <Section className="mx-auto max-w-[1120px] px-5 py-20 sm:px-8 sm:py-28">
          <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
            Getting started
          </p>
          <h2 className="mt-3 text-[22px] font-semibold tracking-tight text-text-primary sm:text-[28px]">
            Use Nalar in three steps.
          </h2>

          <div className="mt-10 grid gap-0 sm:mt-14">
            <div className="flex gap-5 border-b border-border py-5 sm:gap-8 sm:py-6">
              <span className="font-mono text-sm text-text-muted pt-0.5">01</span>
              <div>
                <h3 className="text-sm font-medium text-text-primary uppercase tracking-[0.06em]">
                  Connect
                </h3>
                <p className="mt-1.5 text-[15px] leading-6 text-text-secondary">
                  Connect your wallet or open the demo.
                </p>
              </div>
            </div>

            <div className="flex gap-5 border-b border-border py-5 sm:gap-8 sm:py-6">
              <span className="font-mono text-sm text-text-muted pt-0.5">02</span>
              <div>
                <h3 className="text-sm font-medium text-text-primary uppercase tracking-[0.06em]">
                  Describe
                </h3>
                <p className="mt-1.5 text-[15px] leading-6 text-text-secondary">
                  Tell Nalar what you expect the transaction to do.
                </p>
                <div className="mt-3 rounded border border-border bg-raised px-3 py-2">
                  <p className="font-mono text-xs text-text-secondary">
                    &ldquo;Swap 0.001 tBNB to NDEMO&rdquo;
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-5 py-5 sm:gap-8 sm:py-6">
              <span className="font-mono text-sm text-text-muted pt-0.5">03</span>
              <div>
                <h3 className="text-sm font-medium text-text-primary uppercase tracking-[0.06em]">
                  Review
                </h3>
                <p className="mt-1.5 text-[15px] leading-6 text-text-secondary">
                  Nalar shows what you intended, what the transaction does, what
                  evidence was found, and why the transaction was allowed,
                  reviewed, or blocked.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <Link
              href="/demo"
              className="rounded-md bg-text-primary px-5 py-2.5 text-sm font-medium text-background hover:opacity-90"
            >
              Try Nalar
            </Link>
          </div>
        </Section>

        <div className="mx-auto max-w-[1120px] px-5 sm:px-8">
          <div className="border-t border-border" />
        </div>

        {/* ═══ ARCHITECTURE ═══ */}
        <Section className="mx-auto max-w-[1120px] px-5 py-20 sm:px-8 sm:py-28">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
                Architecture
              </p>
              <h2 className="mt-3 text-[22px] font-semibold tracking-tight text-text-primary sm:text-[28px]">
                How the security decision is made.
              </h2>
              <p className="mt-4 text-[15px] leading-7 text-text-secondary">
                Intelligence layers can assist investigation and explanation. The
                final security decision is deterministic, based on policy
                evaluation and on-chain evidence.
              </p>
            </div>

            {/* Flow diagram */}
            <div className="flex items-start justify-center lg:justify-end">
              <div className="w-full max-w-[340px] rounded-lg border border-border bg-surface p-5">
                <div className="text-center">
                  <p className="text-xs font-medium text-text-primary uppercase tracking-[0.06em]">
                    User / dApp
                  </p>
                </div>

                <div className="my-3 flex justify-center">
                  <div className="h-5 w-px bg-border-strong" />
                </div>

                <div className="rounded border border-border bg-raised p-4">
                  <p className="text-xs font-medium text-text-primary uppercase tracking-[0.06em] text-center">
                    Nalar
                  </p>
                  <div className="mt-3 space-y-1.5">
                    {archSteps.map((step) => (
                      <p
                        key={step}
                        className="text-xs text-text-secondary pl-3 border-l-2 border-border-strong"
                      >
                        {step}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="my-3 flex justify-center">
                  <div className="h-5 w-px bg-border-strong" />
                </div>

                <div className="text-center">
                  <p className="text-xs font-medium text-text-primary uppercase tracking-[0.06em]">
                    Security decision
                  </p>
                  <div className="mt-2 flex justify-center gap-2">
                    <span className="rounded bg-safe/15 px-1.5 py-0.5 text-[10px] font-medium text-safe">
                      ALLOW
                    </span>
                    <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                      REVIEW
                    </span>
                    <span className="rounded bg-danger/15 px-1.5 py-0.5 text-[10px] font-medium text-danger">
                      BLOCK
                    </span>
                  </div>
                </div>

                <div className="my-3 flex justify-center">
                  <div className="h-5 w-px bg-border-strong" />
                </div>

                <div className="text-center">
                  <p className="text-xs font-medium text-text-primary uppercase tracking-[0.06em]">
                    Wallet
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <div className="mx-auto max-w-[1120px] px-5 sm:px-8">
          <div className="border-t border-border" />
        </div>

        {/* ═══ TECHNICAL TRUST ═══ */}
        <Section className="mx-auto max-w-[1120px] px-5 py-20 sm:px-8 sm:py-28">
          <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
            Under the hood
          </p>
          <h2 className="mt-3 text-[22px] font-semibold tracking-tight text-text-primary sm:text-[28px]">
            Built on verifiable analysis.
          </h2>
          <p className="mt-4 max-w-[600px] text-[15px] leading-7 text-text-secondary">
            Every security decision is produced by evaluating transaction data
            against on-chain state. No score is arbitrary.
          </p>

          <div className="mt-10 grid gap-px rounded-lg border border-border bg-border overflow-hidden sm:mt-14 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: "Transaction decoding",
                desc: "ABI resolution and calldata parsing",
              },
              {
                title: "Execution simulation",
                desc: "Dry-run to predict state changes",
              },
              {
                title: "Contract inspection",
                desc: "Owner, configuration, and state reads",
              },
              {
                title: "Policy evaluation",
                desc: "Deterministic rules produce the verdict",
              },
            ].map((item) => (
              <div key={item.title} className="bg-surface p-5">
                <h3 className="text-sm font-medium text-text-primary">
                  {item.title}
                </h3>
                <p className="mt-2 text-xs leading-5 text-text-secondary">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </Section>

        <div className="mx-auto max-w-[1120px] px-5 sm:px-8">
          <div className="border-t border-border" />
        </div>

        {/* ═══ FINAL CTA ═══ */}
        <Section className="mx-auto max-w-[1120px] px-5 py-24 sm:px-8 sm:py-32 text-center">
          <h2 className="text-[clamp(1.5rem,4vw,2.5rem)] font-semibold leading-[1.15] tracking-tight text-text-primary">
            Know what you&apos;re signing.
          </h2>
          <p className="mx-auto mt-5 max-w-[420px] text-[15px] leading-7 text-text-secondary">
            Try Nalar before your next transaction.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/demo"
              className="rounded-md bg-text-primary px-6 py-2.5 text-sm font-medium text-background hover:opacity-90"
            >
              Try Nalar
            </Link>
          </div>
        </Section>

        {/* ═══ FOOTER ═══ */}
        <footer className="border-t border-border">
          <div className="mx-auto max-w-[1120px] px-5 py-8 sm:px-8 sm:py-10">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold tracking-[0.12em] text-text-primary">
                  NALAR PROTOCOL
                </p>
                <p className="mt-1.5 text-xs text-text-muted">
                  Security for transactions humans can understand.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-5 text-xs text-text-secondary">
                <Link href="/demo" className="hover:text-text-primary">
                  Demo
                </Link>
                <span className="text-border">|</span>
                <span className="text-text-muted">BNB Testnet</span>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
