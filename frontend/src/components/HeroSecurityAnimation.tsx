import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import ProductMark from "@/src/components/ProductMark";

const heroStages = [
  { name: "Intent", detail: "Swap 0.001 tBNB to NDEMO" },
  { name: "Decode", detail: "PancakeSwap / execute()" },
  { name: "Simulate", detail: "Execution path returns" },
  { name: "Evidence", detail: "sellTax() reads 9800" },
  { name: "Decide", detail: "Critical state, request stopped" },
];

const riskByStage = [12, 27, 46, 82, 100];

type DecisionTone = "safe" | "review" | "block";

export default function HeroSecurityScene() {
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
          <div className="console-identity">
            <ProductMark />
            <div>
              <span className="console-label">Nalar interceptor</span>
              <span className="console-subtitle">REQUEST / 7F23 / BNB TESTNET</span>
            </div>
          </div>
          <button type="button" className="console-control" onClick={() => setPaused((value) => !value)} aria-pressed={paused}>
            {paused ? "Resume" : "Pause"}
          </button>
        </div>

        <div className="console-intent-line">
          <span className="console-kicker">USER INTENT</span>
          <strong>Swap 0.001 tBNB to NDEMO</strong>
          <span className="console-intent-status">captured</span>
        </div>

        <div className="console-pipeline" aria-label="Transaction inspection pipeline" aria-live="polite">
          {heroStages.map((stage, index) => {
            const completed = index < activeStage;
            const active = index === activeStage;
            return (
              <div key={stage.name} className={`pipeline-step ${completed ? "is-complete" : ""} ${active ? "is-active" : ""}`}>
                <span className="pipeline-dot">{completed ? "✓" : String(index + 1).padStart(2, "0")}</span>
                <span className="pipeline-name">{stage.name}</span>
                {index < heroStages.length - 1 && <span className="pipeline-line" aria-hidden="true" />}
              </div>
            );
          })}
        </div>

        <div className="console-body">
          <div className="console-observation">
            <div className="console-observation-head">
              <span className="console-kicker">CURRENT STEP</span>
              <span className="console-live">
                <i /> LIVE TRACE
              </span>
            </div>
            <strong>{heroStages[activeStage].name}</strong>
            <p>{heroStages[activeStage].detail}</p>
            <div className="evidence-chips" aria-label="On-chain evidence">
              <span className={activeStage >= 3 ? "chip-active" : ""}>sellTax() 9800</span>
              <span className={activeStage >= 3 ? "chip-active" : ""}>owner() known</span>
              <span className={activeStage >= 2 ? "chip-active" : ""}>simulation pass</span>
            </div>
          </div>
          <div className="mini-evidence-graph" aria-label="Evidence graph showing wallet, router, and NDEMO state">
            <svg viewBox="0 0 270 134" role="img" aria-hidden="true">
              <path className="graph-path graph-path-primary" d="M35 35 C88 35 91 91 137 91 S192 35 235 35" />
              <path className="graph-path graph-path-secondary" d="M35 99 C88 99 92 91 137 91" />
              <circle className="graph-node graph-node-wallet" cx="35" cy="35" r="5" />
              <circle className="graph-node graph-node-router" cx="137" cy="91" r="6" />
              <circle className="graph-node graph-node-token" cx="235" cy="35" r="5" />
              <text x="22" y="20">
                wallet
              </text>
              <text x="112" y="119">
                router
              </text>
              <text x="216" y="20">
                NDEMO
              </text>
            </svg>
            <span className="graph-note">evidence graph / read only</span>
          </div>
        </div>

        <div className="console-decision">
          <div>
            <span className="console-kicker">DETERMINISTIC DECISION</span>
            <strong>{isBlocked ? "BLOCK" : decision === "review" ? "REVIEW" : "READING"}</strong>
            <p>{isBlocked ? "Configured sell tax is excessive." : "Risk changes as evidence is read."}</p>
          </div>
          <div className="risk-readout">
            <div className="risk-meter">
              <span />
            </div>
            <span>
              <b>{risk}</b> / 100
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
