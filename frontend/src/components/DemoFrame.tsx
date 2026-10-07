import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

export function DemoFrame({ children }: { children: ReactNode }) {
  return (
    <main className="demo-site">
      <div className="demo-shell">
        <header className="demo-topbar">
          <Link href="/" className="demo-home" aria-label="Back to Nalar Protocol"><Image src="/brand/n-light.svg" alt="" width={28} height={28} /> NALAR<span className="demo-home-label">/ EDITIONS</span></Link>
          <span className="demo-topbar-note">BNB TESTNET · CHAIN 97</span>
          <Link href="/install" className="demo-install">Get the extension <span aria-hidden="true">↗</span></Link>
        </header>
        {children}
        <footer className="demo-footer">
          <span>Educational contracts. Testnet only. NALAR checks the request when your extension is active.</span>
          <span>No Mainnet assets involved.</span>
        </footer>
      </div>
    </main>
  );
}

export function DemoArtwork({ image, name, minted, maximum, tokenId }: { image?: string; name?: string; minted?: bigint; maximum?: bigint; tokenId?: bigint }) {
  return (
    <figure className="demo-art">
      <div className="demo-art-label"><span>{tokenId !== undefined ? `YOUR EDITION · #${tokenId}` : "THE N MARK"}</span><span>ERC-721</span></div>
      <Image src={image ?? "/brand/n-light.svg"} alt={image ? `${name ?? "Nalar Editions"}: the NALAR N mark` : "NALAR logo; contract artwork has not loaded"} width={560} height={640} unoptimized className={`demo-artwork${image ? "" : " is-placeholder"}`} />
      <figcaption><span>{image ? "Artwork & metadata stored on-chain." : "Connect a Testnet wallet to load the collection."}</span><strong>{minted !== undefined && maximum !== undefined ? `${minted} / ${maximum} minted` : "Supply read from contract"}</strong></figcaption>
    </figure>
  );
}
