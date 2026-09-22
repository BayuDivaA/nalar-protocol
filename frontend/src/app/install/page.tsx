import Link from "next/link";

import SiteHeader, { githubUrl } from "@/src/components/SiteHeader";

const downloadUrl = "https://github.com/BayuDivaA/nalar-extension/archive/refs/heads/main.zip";

const steps = [
  {
    number: "01",
    title: "Download the source",
    copy: "Get the current repository archive from GitHub and extract it on your computer.",
    action: "Download from GitHub",
    href: downloadUrl,
    external: true,
  },
  {
    number: "02",
    title: "Open your extensions page",
    copy: "Open your Chromium browser's extensions page and switch on Developer mode.",
    action: "Open chrome://extensions",
    href: "chrome://extensions",
    external: false,
  },
  {
    number: "03",
    title: "Load the extension folder",
    copy: "Choose Load unpacked, then select the extracted extension folder from the repository.",
    action: "View the repository",
    href: githubUrl,
    external: true,
  },
];

export default function InstallPage() {
  return (
    <>
      <SiteHeader />

      <main className="install-page">
        <section className="install-hero page-frame">
          <p className="eyebrow hero-kicker">
            <span className="kicker-mark" aria-hidden="true" />
            Local extension install
          </p>
          <h1>Put Nalar between the dApp and your wallet.</h1>
          <p className="install-hero-copy">Nalar is distributed as an unpacked Chromium extension for the hackathon demo. You can inspect the source, load it locally, and remove it whenever you choose.</p>
          <div className="hero-actions">
            <a href={downloadUrl} className="button button-primary" target="_blank" rel="noreferrer">
              Download extension source
            </a>
            <a href={githubUrl} className="button button-quiet gap-x-1" target="_blank" rel="noreferrer">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-github" viewBox="0 0 16 16">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8" />
              </svg>
              <p> View on GitHub</p>
            </a>
          </div>
        </section>

        <section className="install-steps-section">
          <div className="page-frame">
            <div className="install-section-heading">
              <div>
                <p className="eyebrow">Installation path</p>
                <h2>Three steps from source to protection.</h2>
              </div>
              <p>Keep the extension folder available. Chromium loads it as a local unpacked extension.</p>
            </div>

            <div className="install-step-list">
              {steps.map((step) => (
                <article className="install-step" key={step.number}>
                  <span className="install-step-number">{step.number}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.copy}</p>
                    <a href={step.href} className="text-link" target={step.external ? "_blank" : undefined} rel={step.external ? "noreferrer" : undefined}>
                      {step.action} <span aria-hidden="true">↗</span>
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="install-detail-section page-frame">
          <div className="install-detail-grid">
            <div>
              <p className="eyebrow">What the extension does</p>
              <h2>It waits for the wallet request, then asks what you meant.</h2>
            </div>
            <div className="install-detail-list">
              <div>
                <span>01</span>
                <p>
                  Captures <code>eth_sendTransaction</code> requests from supported wallet providers.
                </p>
              </div>
              <div>
                <span>02</span>
                <p>Collects your intent before the transaction is sent to the security endpoint.</p>
              </div>
              <div>
                <span>03</span>
                <p>Shows the result in the page and keeps BLOCK, REVIEW, and ALLOW behavior explicit.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="install-next-section">
          <div className="page-frame install-next-inner">
            <div>
              <p className="eyebrow">Ready to inspect a request?</p>
              <h2>Try the interception flow with the demo dApp.</h2>
            </div>
            <Link href="/demo/external-dapp" className="button button-primary">
              Open demo dApp
            </Link>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="page-frame site-footer-inner">
          <div>
            <Link href="/" className="footer-brand">
              <span className="footer-brand-mark" aria-hidden="true">
                <img src="/brand/n-dark.svg" alt="Nalar Protocol" width={14} height={14} className="brand-logo-dark" />
                <img src="/brand/n-light.svg" alt="Nalar Protocol" width={14} height={14} className="brand-logo-light" />
              </span>
              <span>NALAR PROTOCOL</span>
            </Link>
            <p>Security for transactions humans can understand.</p>
          </div>
          <div className="footer-links">
            <Link href="/demo">Demo</Link>
            <Link href="/install">Extension</Link>
            <a href={githubUrl} target="_blank" rel="noreferrer">
              GitHub
            </a>
            <span>BNB Testnet</span>
          </div>
        </div>
      </footer>
    </>
  );
}
