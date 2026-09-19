"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import SiteHeader from "@/src/components/SiteHeader";

type DecisionTone = "safe" | "review" | "block";

const heroStages = [
  { name: "Intent", detail: "Swap 0.001 tBNB to NDEMO" },
  { name: "Decode", detail: "PancakeSwap / execute()" },
  { name: "Simulate", detail: "Execution path returns" },
  { name: "Evidence", detail: "sellTax() reads 9800" },
  { name: "Decide", detail: "Critical state, request stopped" },
];

const riskByStage = [12, 27, 46, 82, 100];

const hiddenRisks = [
  ["APPROVAL", "A spender receives permission that the prompt never explained.", "permission"],
  ["CALL TARGET", "Calldata points to an unknown execution path.", "destination"],
  ["TOKEN STATE", "A contract exposes a configured value that changes the trade risk.", "configuration"],
  ["COUNTERPARTY", "The address receiving control is not the address you intended.", "identity"],
  ["SIMULATION", "The request succeeds in a way the human description did not predict.", "execution"],
];

const methodStages = [
  ["01", "Intent", "A human instruction becomes the reference point.", "user meaning"],
  ["02", "Decode", "Calldata becomes an action, target, and set of effects.", "transaction shape"],
  ["03", "Simulate", "The request is tested before a wallet signature exists.", "execution result"],
  ["04", "Investigate", "Contract capabilities and on-chain state add evidence.", "chain context"],
  ["05", "Decide", "Policy produces ALLOW, REVIEW, or BLOCK with reasons.", "deterministic verdict"],
];

const intelligenceRows = [
  ["01", "Intent matching", "Compares the request with what the user described."],
  ["02", "Transaction simulation", "Checks whether the execution path behaves as expected."],
  ["03", "Contract capabilities", "Maps mint, tax, pause, upgrade, and access functions."],
  ["04", "On-chain state", "Reads configured values such as tax, owner, and limits."],
  ["05", "BNB MCP evidence", "Enriches the investigation with read-only BNB observations."],
  ["06", "Scam intelligence", "Combines sellability and token findings into context."],
];

const decisionDetails: Record<DecisionTone, { label: string; score: string; title: string; body: string; rows: string[] }> = {
  safe: {
    label: "ALLOW",
    score: "12 / 100",
    title: "The request matches the stated intent.",
    body: "No critical mismatch was found in the available evidence.",
    rows: ["Intent and decoded action agree", "Simulation returned successfully", "No blocking policy rule matched"],
  },
  review: {
    label: "REVIEW",
    score: "58 / 100",
    title: "The request needs a human decision.",
    body: "Evidence is incomplete or the transaction contains a material uncertainty.",
    rows: ["Target contract is not verified", "Observed state needs inspection", "No automatic block rule matched"],
  },
  block: {
    label: "BLOCK",
    score: "100 / 100",
    title: "A critical condition conflicts with safe signing.",
    body: "Nalar stops the request and explains the evidence that caused the decision.",
    rows: ["Configured sell tax is excessive", "State was read from the chain", "Wallet signing is not reached"],
  },
};

function ProductMark() {
  return <span className="product-mark" aria-hidden="true"><span /><span /><span /></span>;
}

function SectionMarker({ number, label }: { number: string; label: string }) {
  return <div className="section-marker"><span>{number}</span><span>{label}</span></div>;
}

function HeroSecurityScene() {
  const [activeStage, setActiveStage] = useState(0);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(true);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = sceneRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.2 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (paused || !inView || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => setActiveStage((current) => (current + 1) % heroStages.length), 1500);
    return () => window.clearInterval(timer);
  }, [inView, paused]);

  const risk = riskByStage[activeStage];
  const isBlocked = activeStage === heroStages.length - 1;
  const decision: DecisionTone = isBlocked ? "block" : activeStage >= 3 ? "review" : "safe";

  return (
    <div
      ref={sceneRef}
      className={`hero-security-scene hero-security-scene-${decision}`}
      onMouseMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        setParallax({ x: ((event.clientX - bounds.left) / bounds.width - 0.5) * 6, y: ((event.clientY - bounds.top) / bounds.height - 0.5) * 4 });
      }}
      onMouseLeave={() => setParallax({ x: 0, y: 0 })}
    >
      <div className="security-console" style={{ "--parallax-x": `${parallax.x}px`, "--parallax-y": `${parallax.y}px`, "--risk-factor": risk / 100 } as CSSProperties}>
        <div className="console-topline">
          <div className="console-identity"><ProductMark /><div><span className="console-label">Nalar interceptor</span><span className="console-subtitle">REQUEST / 7F23 / BNB TESTNET</span></div></div>
          <button type="button" className="console-control" onClick={() => setPaused((value) => !value)} aria-pressed={paused}>{paused ? "Resume" : "Pause"}</button>
        </div>

        <div className="console-intent-line"><span className="console-kicker">USER INTENT</span><strong>Swap 0.001 tBNB to NDEMO</strong><span className="console-intent-status">captured</span></div>

        <div className="console-pipeline" aria-label="Transaction inspection pipeline" aria-live="polite">
          {heroStages.map((stage, index) => {
            const completed = index < activeStage;
            const active = index === activeStage;
            return <div key={stage.name} className={`pipeline-step ${completed ? "is-complete" : ""} ${active ? "is-active" : ""}`}><span className="pipeline-dot">{completed ? "✓" : String(index + 1).padStart(2, "0")}</span><span className="pipeline-name">{stage.name}</span>{index < heroStages.length - 1 && <span className="pipeline-line" aria-hidden="true" />}</div>;
          })}
        </div>

        <div className="console-body">
          <div className="console-observation"><div className="console-observation-head"><span className="console-kicker">CURRENT STEP</span><span className="console-live"><i /> LIVE TRACE</span></div><strong>{heroStages[activeStage].name}</strong><p>{heroStages[activeStage].detail}</p><div className="evidence-chips" aria-label="On-chain evidence"><span className={activeStage >= 3 ? "chip-active" : ""}>sellTax() 9800</span><span className={activeStage >= 3 ? "chip-active" : ""}>owner() known</span><span className={activeStage >= 2 ? "chip-active" : ""}>simulation pass</span></div></div>
          <div className="mini-evidence-graph" aria-label="Evidence graph showing wallet, router, and NDEMO state"><svg viewBox="0 0 270 134" role="img" aria-hidden="true"><path className="graph-path graph-path-primary" d="M35 35 C88 35 91 91 137 91 S192 35 235 35" /><path className="graph-path graph-path-secondary" d="M35 99 C88 99 92 91 137 91" /><circle className="graph-node graph-node-wallet" cx="35" cy="35" r="5" /><circle className="graph-node graph-node-router" cx="137" cy="91" r="6" /><circle className="graph-node graph-node-token" cx="235" cy="35" r="5" /><text x="22" y="20">wallet</text><text x="112" y="119">router</text><text x="216" y="20">NDEMO</text></svg><span className="graph-note">evidence graph / read only</span></div>
        </div>

        <div className="console-decision"><div><span className="console-kicker">DETERMINISTIC DECISION</span><strong>{isBlocked ? "BLOCK" : decision === "review" ? "REVIEW" : "READING"}</strong><p>{isBlocked ? "Configured sell tax is excessive." : "Risk changes as evidence is read."}</p></div><div className="risk-readout"><div className="risk-meter"><span /></div><span><b>{risk}</b> / 100</span></div></div>
      </div>
    </div>
  );
}

function ArchitectureDiagram() {
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const nodes = ["DApp", "Wallet provider", "Nalar interceptor", "Backend", "Security engine", "BNB MCP", "Decision", "Wallet"];

  useEffect(() => {
    const element = sectionRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.28 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <div ref={sectionRef} className={`architecture-flow ${visible ? "is-visible" : ""}`} aria-label="Nalar transaction security architecture">{nodes.map((node, index) => <div key={node} className="architecture-node-wrap"><div className="architecture-node"><span>{String(index + 1).padStart(2, "0")}</span><strong>{node}</strong></div>{index < nodes.length - 1 && <span className="architecture-connector" aria-hidden="true" />}</div>)}</div>;
}

export default function LandingPage() {
  const [selectedDecision, setSelectedDecision] = useState<DecisionTone>("review");
  const decision = decisionDetails[selectedDecision];

  return (
    <>
      <SiteHeader />
      <main className="landing-page">
        <section className="landing-hero"><div className="page-frame landing-hero-grid"><div className="landing-hero-copy"><p className="hero-overline"><span className="overline-rule" /> Web3 transaction security firewall</p><h1>Know what you&apos;re signing.</h1><p className="landing-hero-description">Nalar reads your intent, simulates the transaction, inspects on-chain evidence, and stops dangerous requests before your wallet signs.</p><div className="landing-actions"><Link href="/demo" className="landing-button landing-button-primary">Open the demo <span aria-hidden="true">↗</span></Link><Link href="/install" className="landing-button landing-button-secondary">Install extension</Link></div><div className="hero-meta-line"><span className="signal-pip" /> Read first. Sign second. <span>BNB testnet ready</span></div></div><HeroSecurityScene /></div></section>

        <section id="problem" className="landing-section problem-section"><div className="page-frame problem-grid"><div className="problem-intro"><SectionMarker number="01" label="The blind spot" /><h2>Signing a transaction shouldn&apos;t mean trusting what you cannot see.</h2><p>A wallet can show a destination and a value. It cannot explain the full contract behavior behind a request. Nalar makes the hidden parts legible before the signature prompt.</p></div><div className="hidden-risk-list" aria-label="Examples of hidden transaction risk">{hiddenRisks.map(([code, description, type]) => <div className="hidden-risk-row" key={code}><span className={`risk-glyph risk-glyph-${type}`} aria-hidden="true" /><span className="risk-code">{code}</span><p>{description}</p></div>)}</div></div></section>

        <section id="mechanism" className="landing-section mechanism-section"><div className="page-frame"><SectionMarker number="02" label="The inspection path" /><div className="section-heading-row"><h2>Five steps between intent and signature.</h2><p>Each step produces a traceable input for the next. The final state is deterministic, the explanation is readable.</p></div><div className="method-spine">{methodStages.map(([number, title, copy, output], index) => <div className="method-row" key={number}><span className="method-number">{number}</span><span className="method-beacon" aria-hidden="true"><i /></span><div className="method-copy"><h3>{title}</h3><p>{copy}</p></div><span className="method-output">{output}</span>{index < methodStages.length - 1 && <span className="method-rule" aria-hidden="true" />}</div>)}</div></div></section>

        <section id="intelligence" className="landing-section intelligence-section"><div className="page-frame intelligence-grid"><div className="intelligence-intro"><SectionMarker number="03" label="Security intelligence" /><h2>Every signal has a job.</h2><p>Nalar combines transaction mechanics with contract and chain evidence. Nothing in the interface is a mystery score without a source.</p><div className="source-stamp"><span /> EVIDENCE SOURCES: REQUEST / RPC / MCP / POLICY</div></div><div className="intelligence-ledger">{intelligenceRows.map(([number, title, detail]) => <div className="intelligence-row" key={number}><span className="ledger-number">{number}</span><div><h3>{title}</h3><p>{detail}</p></div><span className="ledger-mark" aria-hidden="true">↗</span></div>)}</div></div></section>

        <section className="landing-section decision-section"><div className="page-frame decision-layout"><div className="decision-intro"><SectionMarker number="04" label="Decision engine" /><h2>The verdict is clear because the evidence is visible.</h2><p>Select a state to see how the decision changes with the evidence. The engine produces the state, then Nalar explains it in plain language.</p></div><div className="decision-console"><div className="decision-tabs" role="tablist" aria-label="Decision states">{(Object.keys(decisionDetails) as DecisionTone[]).map((tone) => <button key={tone} type="button" role="tab" aria-selected={selectedDecision === tone} className={`decision-tab decision-tab-${tone} ${selectedDecision === tone ? "is-selected" : ""}`} onClick={() => setSelectedDecision(tone)}>{decisionDetails[tone].label}</button>)}</div><div className={`decision-result decision-result-${selectedDecision}`} aria-live="polite"><div className="decision-result-top"><span className="console-kicker">POLICY OUTPUT</span><span className="decision-score">{decision.score}</span></div><strong>{decision.label}</strong><h3>{decision.title}</h3><p>{decision.body}</p><div className="decision-evidence-list">{decision.rows.map((row) => <span key={row}><i />{row}</span>)}</div></div><div className="decision-scale" aria-hidden="true"><span /><span /><span /></div></div></div></section>

        <section className="landing-section mcp-section"><div className="page-frame"><div className="mcp-heading"><div><SectionMarker number="05" label="BNB evidence layer" /><h2>MCP enriches the evidence. The engine makes the call.</h2></div><p>BNB MCP provides read-only observations from the chain. It does not decide whether a user should sign.</p></div><div className="mcp-flow" aria-label="BNB MCP evidence flow"><div className="mcp-flow-node"><span>01</span><strong>BNB MCP</strong><small>read-only tools</small></div><span className="mcp-flow-line" aria-hidden="true" /><div className="mcp-flow-node mcp-flow-node-active"><span>02</span><strong>On-chain evidence</strong><small>state and observations</small></div><span className="mcp-flow-line" aria-hidden="true" /><div className="mcp-flow-node"><span>03</span><strong>Deterministic engine</strong><small>policy and decision</small></div></div></div></section>

        <section className="landing-section case-section"><div className="page-frame case-layout"><div className="case-copy"><SectionMarker number="06" label="A request in context" /><h2>NDEMO looks like a swap. The state says to stop.</h2><p>This is a configured on-chain state example. Nalar reports what it observed, without claiming a transfer outcome that was not proven.</p><Link href="/demo" className="inline-action">Inspect the live case <span aria-hidden="true">↗</span></Link></div><div className="case-card"><div className="case-card-head"><span>ILLUSTRATIVE REQUEST / NDEMO</span><span className="case-status">BLOCK</span></div><div className="case-intent-row"><span>USER INTENT</span><strong>Swap tBNB → NDEMO</strong></div><div className="case-state-grid"><div><span>OBSERVED STATE</span><strong>sellTax = 9800</strong><small>configured on-chain value</small></div><div><span>RISK</span><strong className="case-critical">CRITICAL</strong><small>evidence exceeds policy threshold</small></div></div><div className="case-verdict"><span>WHY IT STOPPED</span><strong>Current sell tax is excessive.</strong><small>Nalar blocks before wallet signing.</small></div></div></div></section>

        <section className="landing-section extension-section"><div className="page-frame extension-layout"><div className="extension-browser" aria-label="Illustration of Nalar intercepting a wallet request"><div className="browser-bar"><span className="browser-dot" /><span className="browser-dot" /><span className="browser-dot" /><span className="browser-address">demo.dapp / swap</span></div><div className="browser-content"><div className="browser-dapp-line" /><div className="browser-dapp-line short" /><div className="browser-dapp-button">SWAP</div></div><div className="extension-panel"><div className="extension-panel-top"><ProductMark /><span>NALAR INTERCEPTOR</span><span className="extension-live">●</span></div><span className="console-kicker">BEFORE SIGNING</span><strong>Read the request first.</strong><div className="extension-intent">Swap 0.001 tBNB to NDEMO</div><div className="extension-actions"><span>VIEW EVIDENCE</span><b>BLOCK</b></div></div></div><div className="extension-copy"><SectionMarker number="07" label="Before the wallet" /><h2>Nalar lives between the dApp and the signature.</h2><p>The extension intercepts transaction requests, captures intent, and opens the analysis before the wallet confirmation takes over.</p><Link href="/install" className="inline-action">Load the extension <span aria-hidden="true">↗</span></Link></div></div></section>

        <section id="architecture" className="landing-section architecture-section-new"><div className="page-frame"><SectionMarker number="08" label="Architecture" /><div className="architecture-heading"><h2>A firewall is a path, not a pop-up.</h2><p>Each handoff is explicit, so the decision can be inspected from request to wallet.</p></div><ArchitectureDiagram /></div></section>

        <section className="landing-final-cta"><div className="page-frame final-cta-inner"><div><span className="console-kicker">NALAR PROTOCOL / TXSENTRY</span><h2>See what your wallet can&apos;t explain.</h2></div><div className="landing-actions"><Link href="/demo" className="landing-button landing-button-primary">Open the demo <span aria-hidden="true">↗</span></Link><a href="#architecture" className="landing-button landing-button-secondary">View architecture</a></div></div></section>
      </main>

      <footer className="site-footer landing-footer"><div className="page-frame site-footer-inner"><div><Link href="/" className="footer-brand">NALAR PROTOCOL</Link><p>Know what you&apos;re signing.</p></div><div className="footer-links"><Link href="/demo">Demo</Link><Link href="/install">Extension</Link><a href="https://github.com/BayuDivaA/nalar-protocol" target="_blank" rel="noreferrer">GitHub</a><span>BNB Testnet</span></div></div></footer>
    </>
  );
}
