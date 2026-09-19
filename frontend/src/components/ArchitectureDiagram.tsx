import { useEffect, useRef, useState } from "react";

export default function ArchitectureDiagram() {
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

  return (
    <div ref={sectionRef} className={`architecture-flow ${visible ? "is-visible" : ""}`} aria-label="Nalar transaction security architecture">
      {nodes.map((node, index) => (
        <div key={node} className="architecture-node-wrap">
          <div className="architecture-node">
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{node}</strong>
          </div>
          {index < nodes.length - 1 && <span className="architecture-connector" aria-hidden="true" />}
        </div>
      ))}
    </div>
  );
}
