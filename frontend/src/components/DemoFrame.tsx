import Link from "next/link";
import type { ReactNode } from "react";

export function DemoFrame({ children }: { children: ReactNode }) {
  return (
    <main className="demo-site">
      <div className="demo-shell">
        <header className="demo-topbar">
          <Link href="/" className="demo-home" aria-label="Back to Nalar Protocol"><span aria-hidden="true">←</span> NALAR</Link>
          <span className="demo-topbar-note">TEST COLLECTION <span aria-hidden="true">/</span> BNB TESTNET</span>
          <Link href="/install" className="demo-install">Get the extension <span aria-hidden="true">↗</span></Link>
        </header>
        {children}
        <footer className="demo-footer">
          <span>This page sends a real request to your wallet. NALAR inspects it when the extension is active.</span>
          <span>BNB Smart Chain Testnet</span>
        </footer>
      </div>
    </main>
  );
}

export function DemoArtwork() {
  return (
    <figure className="demo-art">
      <svg viewBox="0 0 480 430" role="img" aria-label="Illustrative artwork preview: a small character beside a floating paper kite" className="demo-artwork">
        <rect width="480" height="430" rx="20" fill="#dcebe3" />
        <circle cx="372" cy="92" r="51" fill="#f6d995" />
        <path d="M0 330c69-91 126-100 193-53 81-108 174-98 287-3v156H0Z" fill="#a9cabb" />
        <path d="M0 363c87-61 143-62 230-24 102-85 183-63 250-14v105H0Z" fill="#81ac98" />
        <path className="demo-kite" d="m315 99 63 60-61 54-55-56Z" fill="#f08c6e" stroke="#263f39" strokeWidth="5" strokeLinejoin="round" />
        <path d="m315 99 2 114m-55-56h116" stroke="#263f39" strokeWidth="4" />
        <path d="M315 214c-42 35-27 49-60 63" fill="none" stroke="#263f39" strokeWidth="3" strokeDasharray="5 8" />
        <ellipse cx="165" cy="365" rx="97" ry="17" fill="#648f7b" />
        <path d="M115 230c-8-38 12-76 49-76s58 39 51 76l-10 102h-80Z" fill="#f5ead5" stroke="#263f39" strokeWidth="5" />
        <path d="M122 174c-21-48 9-85 41-85 33 0 65 37 42 85" fill="#f5ead5" stroke="#263f39" strokeWidth="5" />
        <path d="M130 124 112 79l39 19m43 0 39-19-18 45" fill="#f5ead5" stroke="#263f39" strokeWidth="5" strokeLinejoin="round" />
        <ellipse cx="146" cy="163" rx="5" ry="7" fill="#263f39" /><ellipse cx="183" cy="163" rx="5" ry="7" fill="#263f39" />
        <path d="M158 184q7 8 14 0" fill="none" stroke="#263f39" strokeWidth="4" strokeLinecap="round" />
        <path d="M125 275c-23 4-28-4-31-18m112 18c24 2 33-7 37-19" fill="none" stroke="#263f39" strokeWidth="5" strokeLinecap="round" />
      </svg>
      <figcaption>Illustrative preview. The demo contract does not provide artwork metadata.</figcaption>
    </figure>
  );
}
