import Link from "next/link";

import "@/src/app/address/address.css";

export default function AddressEntry() {
  return (
    <section className="address-entry" aria-labelledby="address-entry-title">
      <div className="page-frame address-entry-inner">
        <div className="address-entry-copy">
          <span className="address-kicker">A separate tool · Read-only</span>
          <h2 id="address-entry-title">Make on-chain data readable.</h2>
          <p>Enter a wallet, contract address, or transaction hash. Nalar explains what the network shows in plain language.</p>
        </div>
        <form className="address-entry-form" action="/address" method="get">
          <div className="address-entry-controls">
            <label className="address-entry-network" htmlFor="home-address-network">Network
              <select id="home-address-network" name="chainId" defaultValue="56">
                <option value="56">BNB Mainnet · 56</option>
                <option value="97">BNB Testnet · 97</option>
              </select>
            </label>
            <label className="address-entry-address" htmlFor="home-address-value">Address or tx hash
              <input id="home-address-value" name="query" type="text" placeholder="0x…" pattern="0x([a-fA-F0-9]{40}|[a-fA-F0-9]{64})" maxLength={66} autoComplete="off" spellCheck={false} required />
            </label>
            <button type="submit">Explain data</button>
          </div>
          <span className="address-entry-privacy">Public chain data only. No wallet connection or signing.</span>
        </form>
        <Link href="/address" className="address-entry-link">Open the explainer <span aria-hidden="true">↗</span></Link>
      </div>
    </section>
  );
}
