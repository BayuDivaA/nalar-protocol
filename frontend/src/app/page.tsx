"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import SiteHeader from "@/src/components/SiteHeader";

const stages = [
  { label: "Intent", detail: "Swap 0.001 tBNB to NDEMO" },
  { label: "Decode", detail: "PancakeSwap · swap()" },
  { label: "Simulate", detail: "Execution path inspected" },
  { label: "Evidence", detail: "Sell tax configured at 98.00%" },
  { label: "Decision", detail: "Block before wallet signing" },
];

const evidence = [
  { label: "Current sell tax", value: "98.00%", tone: "danger" },
  { label: "Current buy tax", value: "0.00%", tone: "neutral" },
  { label: "Owner controls tax", value: "Yes", tone: "warning" },
  { label: "Evidence source", value: "On-chain state", tone: "safe" },
];

const technology = [
  { name: "BNB Smart Chain", detail: "Testnet transaction context" },
  { name: "viem", detail: "RPC and transaction data" },
  { name: "Simulation", detail: "Inspect execution before signing" },
  { name: "Policy engine", detail: "Deterministic verdicts" },
];

function Arrow() {
  return <span className="flow-arrow" aria-hidden="true">→</span>;
}

function HeroTrace() {
  const [activeStage, setActiveStage] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || paused) return;

    const timer = window.setInterval(() => {
      setActiveStage((current) => (current + 1) % stages.length);
    }, 1700);

    return () => window.clearInterval(timer);
  }, [paused]);

  return (
    <div className="trace-shell" aria-label="Animated transaction security example">
      <div className="trace-header">
        <div>
          <p className="micro-label">Nalar transaction trace</p>
          <p className="trace-caption">Illustrative NDEMO example</p>
        </div>
        <button
          type="button"
          className="trace-control"
          onClick={() => setPaused((value) => !value)}
          aria-pressed={paused}
        >
          {paused ? "Resume trace" : "Pause trace"}
        </button>
      </div>

      <div className="trace-intent">
        <div className="trace-intent-mark" aria-hidden="true">01</div>
        <div>
          <p className="micro-label">User intent</p>
          <p className="trace-intent-copy">Swap 0.001 tBNB to NDEMO</p>
        </div>
      </div>

      <div className="trace-stages" aria-live="polite">
        {stages.map((stage, index) => {
          const state = index < activeStage ? "done" : index === activeStage ? "active" : "pending";

          return (
            <div key={stage.label} className={`trace-stage trace-stage-${state}`}>
              <div className="trace-stage-marker" aria-hidden="true">
                {state === "done" ? "✓" : String(index + 1).padStart(2, "0")}
              </div>
              <div className="trace-stage-copy">
                <div className="trace-stage-topline">
                  <span className="trace-stage-label">{stage.label}</span>
                  <span className="trace-stage-state">
                    {state === "active" ? "reading" : state === "done" ? "checked" : "queued"}
                  </span>
                </div>
                <p>{stage.detail}</p>
              </div>
              {index < stages.length - 1 && <span className="trace-connector" aria-hidden="true" />}
            </div>
          );
        })}
      </div>

      <div className={`trace-decision ${activeStage >= stages.length - 1 ? "trace-decision-revealed" : ""}`}>
        <div>
          <p className="micro-label">Deterministic decision</p>
          <p className="trace-decision-title">BLOCK</p>
          <p className="trace-decision-reason">The configured sell tax is excessive.</p>
        </div>
        <div className="trace-score"><strong>100</strong><span>/100</span></div>
      </div>
    </div>
  );
}

function SectionLead({ label, title, copy }: { label: string; title: string; copy?: string }) {
  return (
    <div className="section-lead">
      <p className="eyebrow">{label}</p>
      <h2>{title}</h2>
      {copy && <p>{copy}</p>}
    </div>
  );
}

export default function LandingPage() {
  return (
    <>
      <SiteHeader />

      <main>
        <section className="hero-section">
          <div className="page-frame hero-grid">
            <div className="hero-copy">
              <p className="eyebrow hero-kicker"><span className="kicker-mark" aria-hidden="true" />Web3 transaction security</p>
              <h1>The wallet prompt is not the whole story.</h1>
              <p className="hero-description">
                Nalar reads your intent, inspects the transaction, and shows what the request is actually trying to do before your wallet asks for a signature.
              </p>
              <div className="hero-actions">
                <Link href="/demo" className="button button-primary">Run the live demo</Link>
                <Link href="/install" className="button button-quiet">Install the extension</Link>
              </div>
              <div className="hero-footnote">
                <span className="status-dot" aria-hidden="true" />
                <span>Currently configured for BNB Testnet</span>
              </div>
            </div>

            <div className="hero-visual">
              <HeroTrace />
            </div>
          </div>
        </section>

        <section className="proof-strip" aria-label="Nalar security decisions">
          <div className="page-frame proof-strip-inner">
            <span className="proof-label">Every request ends in a clear state</span>
            <div className="proof-states">
              <span className="state-chip state-safe">ALLOW</span>
              <span className="state-chip state-review">REVIEW</span>
              <span className="state-chip state-danger">BLOCK</span>
            </div>
          </div>
        </section>

        <section id="mechanism" className="page-section page-frame">
          <SectionLead
            label="The mechanism"
            title="Nalar turns a wallet request into a readable decision."
            copy="Wallets expose addresses, values, and calldata. Nalar adds the context a person needs to decide whether the request matches what they meant to do."
          />

          <div className="mechanism-flow">
            <div className="mechanism-node mechanism-node-accent"><span>01</span><strong>Intent</strong><small>What you said</small></div>
            <Arrow />
            <div className="mechanism-node"><span>02</span><strong>Transaction</strong><small>What was built</small></div>
            <Arrow />
            <div className="mechanism-node"><span>03</span><strong>Evidence</strong><small>What was found</small></div>
            <Arrow />
            <div className="mechanism-node mechanism-node-decision"><span>04</span><strong>Decision</strong><small>What happens next</small></div>
          </div>

          <div className="mechanism-note">
            <span className="note-index">READ BEFORE SIGNING</span>
            <p>Nalar can stop a request before it reaches the wallet. For a review, you see the evidence first and choose whether to continue.</p>
          </div>
        </section>

        <section id="evidence" className="page-section evidence-section">
          <div className="page-frame evidence-grid">
            <div>
              <SectionLead
                label="Evidence, not theatre"
                title="A verdict carries the reason with it."
                copy="The decision engine evaluates the transaction against simulation results, contract state, policy, and intent. The explanation layer translates those findings into plain language."
              />
              <Link href="/demo" className="text-link">See the analysis in the demo <span aria-hidden="true">↗</span></Link>
            </div>

            <div className="evidence-panel">
              <div className="evidence-panel-head">
                <div>
                  <p className="micro-label">Security result</p>
                  <p className="evidence-panel-title">Transaction blocked</p>
                </div>
                <span className="state-chip state-danger">CRITICAL</span>
              </div>

              <div className="evidence-reason">
                <p className="micro-label">Why Nalar stopped it</p>
                <p>Current sell tax is excessive.</p>
              </div>

              <div className="evidence-rows">
                {evidence.map((row) => (
                  <div key={row.label} className="evidence-row">
                    <span>{row.label}</span>
                    <strong className={`evidence-value-${row.tone}`}>{row.value}</strong>
                  </div>
                ))}
              </div>

              <p className="evidence-footnote">The evidence shows an on-chain configured value. It does not claim an unproven transfer outcome.</p>
            </div>
          </div>
        </section>

        <section className="page-section page-frame">
          <div className="split-heading">
            <SectionLead
              label="How it works"
              title="Six checks. One accountable decision."
            />
            <p className="split-heading-note">AI helps explain the findings. The security engine owns the verdict.</p>
          </div>

          <div className="process-list">
            {[
              ["01", "Understand intent", "Parse the instruction you give Nalar into a reference point."],
              ["02", "Decode the request", "Resolve the contract call and translate its action into human terms."],
              ["03", "Simulate execution", "Check whether the request succeeds and what it is expected to change."],
              ["04", "Inspect state", "Read relevant contract configuration, privileges, and token behavior."],
              ["05", "Compare effects", "Match the intended action against the transaction and its evidence."],
              ["06", "Apply policy", "Return ALLOW, REVIEW, or BLOCK with reasons that can be checked."],
            ].map(([number, title, copy]) => (
              <div className="process-row" key={number}>
                <span className="process-number">{number}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="page-section architecture-section">
          <div className="page-frame architecture-grid">
            <div>
              <SectionLead
                label="System boundary"
                title="The explanation can speak. The policy decides."
                copy="Nalar keeps the responsibilities separate. Evidence comes from the transaction and the chain. Deterministic rules produce the security state. AI makes the result easier to understand."
              />
            </div>
            <div className="boundary-diagram" aria-label="Nalar system boundary">
              <div className="boundary-row"><span className="boundary-key">INPUT</span><strong>User intent + wallet request</strong></div>
              <div className="boundary-line" />
              <div className="boundary-row"><span className="boundary-key">EVIDENCE</span><strong>Simulation + contract state</strong></div>
              <div className="boundary-line" />
              <div className="boundary-row boundary-row-decision"><span className="boundary-key">POLICY</span><strong>ALLOW / REVIEW / BLOCK</strong></div>
              <div className="boundary-line" />
              <div className="boundary-row"><span className="boundary-key">EXPLANATION</span><strong>Clear language for the user</strong></div>
            </div>
          </div>
        </section>

        <section className="page-section page-frame technology-section">
          <SectionLead
            label="Built for the actual flow"
            title="A small stack with a clear job at every layer."
          />
          <div className="technology-list">
            {technology.map((item) => (
              <div className="technology-item" key={item.name}>
                <span className="technology-index" aria-hidden="true" />
                <div><h3>{item.name}</h3><p>{item.detail}</p></div>
              </div>
            ))}
          </div>
        </section>

        <section className="page-section install-callout">
          <div className="page-frame install-callout-inner">
            <div>
              <p className="eyebrow">Use Nalar on a real dApp</p>
              <h2>Put the security layer between the site and your wallet.</h2>
              <p>Download the extension from GitHub, load it into Chromium, then try the interception flow on the demo dApp.</p>
            </div>
            <div className="install-callout-actions">
              <Link href="/install" className="button button-primary">Install from GitHub</Link>
              <Link href="/demo/external-dapp" className="button button-quiet">Open demo dApp</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="page-frame site-footer-inner">
          <div><Link href="/" className="footer-brand">NALAR PROTOCOL</Link><p>Security for transactions humans can understand.</p></div>
          <div className="footer-links"><Link href="/demo">Demo</Link><Link href="/install">Extension</Link><a href="https://github.com/BayuDivaA/nalar-protocol" target="_blank" rel="noreferrer">GitHub</a><span>BNB Testnet</span></div>
        </div>
      </footer>
    </>
  );
}
