"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatEther, isAddress, isHash, toHex, type Address, type Hex } from "viem";
import { bscTestnet } from "viem/chains";

import { DemoArtwork, DemoFrame } from "@/src/components/DemoFrame";
import { assertDemoChain, buildDemoTransaction, demoClient, getDemoWallet, readDemoCollection, readMintedToken, type DemoCollection, type MintMode, type WalletProvider } from "@/src/lib/nft-demo";

const demoAddress = process.env.NEXT_PUBLIC_DEMO_NFT_ADDRESS;
const trapAddress = process.env.NEXT_PUBLIC_DEMO_MINT_TRAP_ADDRESS;
const explorer = bscTestnet.blockExplorers.default.url;
type SubmittedRequest = { hash: Hex; owner: Address; collection: Address; mode: MintMode; status: "pending" | "confirmed" | "reverted" };
const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
const message = (cause: unknown) => cause instanceof Error ? cause.message : "The wallet request could not be completed.";

function ContractLink({ address }: { address: Address }) {
  return <a href={`${explorer}/address/${address}`} target="_blank" rel="noreferrer" title={address} aria-label={`View ${address} on BNB Testnet BscScan`}>{shortAddress(address)} ↗</a>;
}

export default function DemoPage() {
  const [collection, setCollection] = useState<DemoCollection | null>(null);
  const [account, setAccount] = useState<Address | null>(null);
  const [mode, setMode] = useState<MintMode>("normal");
  const [acknowledged, setAcknowledged] = useState(false);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(true);
  const [stage, setStage] = useState<"idle" | "reading" | "wallet" | "confirming">("idle");
  const [wrongNetwork, setWrongNetwork] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transaction, setTransaction] = useState<SubmittedRequest | null>(null);
  const [token, setToken] = useState<Awaited<ReturnType<typeof readMintedToken>>>(null);
  const checkId = useRef(0);
  const requestLock = useRef(false);
  const busy = stage !== "idle" || transaction?.status === "pending";

  const refresh = useCallback(async () => {
    const id = ++checkId.current;
    setChecking(true);
    setCollection(null);
    setWrongNetwork(false);
    setError(null);
    setAccount(null);

    try {
      const provider = getDemoWallet();
      const chainId = Number(await provider.request({ method: "eth_chainId" }));
      if (chainId !== bscTestnet.id) {
        if (id === checkId.current) setWrongNetwork(true);
        throw new Error("This collection is on BNB Testnet. Switch networks to continue.");
      }
      const [data, accounts] = await Promise.all([
        readDemoCollection(provider, demoAddress, trapAddress),
        provider.request({ method: "eth_accounts" }),
      ]);
      if (id === checkId.current) {
        setCollection(data);
        setAccount(Array.isArray(accounts) && isAddress(accounts[0] ?? "") ? accounts[0] : null);
      }
    } catch (cause) {
      if (id === checkId.current) setError(cause instanceof Error ? cause.message : "Could not read the NFT contract. Retry.");
    } finally {
      if (id === checkId.current) setChecking(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void refresh(); });
    const provider = (window as Window & { ethereum?: WalletProvider }).ethereum;
    provider?.on?.("chainChanged", refresh);
    provider?.on?.("accountsChanged", refresh);
    const requestId = checkId;
    return () => {
      active = false;
      ++requestId.current;
      provider?.removeListener?.("chainChanged", refresh);
      provider?.removeListener?.("accountsChanged", refresh);
    };
  }, [refresh]);

  async function switchNetwork() {
    try {
      setError(null);
      await getDemoWallet().request({ method: "wallet_switchEthereumChain", params: [{ chainId: toHex(bscTestnet.id) }] });
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Wallet could not switch networks.");
    }
  }

  async function connect() {
    if (requestLock.current) return;
    requestLock.current = true;
    setStage("wallet");
    try {
      await getDemoWallet().request({ method: "eth_requestAccounts" });
      await refresh();
    } catch (cause) { setError(message(cause)); }
    finally { requestLock.current = false; setStage("idle"); }
  }

  async function confirm(record: SubmittedRequest, wait: boolean) {
    const provider = getDemoWallet();
    const id = checkId.current;
    await assertDemoChain(provider);
    const client = demoClient(provider);
    const receipt = wait
      ? await client.waitForTransactionReceipt({ hash: record.hash, timeout: 90_000, pollingInterval: 2_000 })
      : await client.getTransactionReceipt({ hash: record.hash });
    await assertDemoChain(provider);
    if (id !== checkId.current) throw new Error("Wallet context changed. Return to Testnet and check confirmation.");
    setTransaction({ ...record, status: receipt.status === "success" ? "confirmed" : "reverted" });
    if (receipt.status !== "success") return;
    try {
      const [latest, mintedToken] = await Promise.all([
        readDemoCollection(provider, demoAddress, trapAddress),
        record.mode === "normal" ? readMintedToken(provider, record.collection, receipt, record.owner) : Promise.resolve(null),
      ]);
      if (id !== checkId.current) return;
      setCollection(latest);
      if (record.mode !== "normal") return;
      setToken(mintedToken);
      if (!mintedToken) setError("Transaction confirmed, but a mint to this account was not found in its receipt. Inspect it on BscScan.");
    } catch {
      if (id === checkId.current) setError("Transaction confirmed. Collection data could not be refreshed; retry the contract check.");
    }
  }

  async function submit() {
    if (!collection || !account || busy || requestLock.current || (mode === "trap" && !acknowledged)) return;
    requestLock.current = true;
    const id = checkId.current;
    setStage("reading");
    setError(null);
    setTransaction(null);
    setToken(null);
    let submitted = false;
    try {
      const provider = getDemoWallet();
      const latest = await readDemoCollection(provider, demoAddress, trapAddress);
      const accounts = await provider.request({ method: "eth_accounts" });
      await assertDemoChain(provider);
      if (id !== checkId.current || !Array.isArray(accounts) || accounts[0]?.toLowerCase() !== account.toLowerCase()) {
        throw new Error("Your wallet account or network changed. Check the collection again before retrying.");
      }
      const request = buildDemoTransaction(latest, mode);
      setCollection(latest);
      setStage("wallet");
      const hash = await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: account, to: request.to, value: toHex(request.value), data: request.data }],
      });
      if (typeof hash !== "string" || !isHash(hash)) throw new Error("Wallet did not return a transaction hash.");
      submitted = true;
      const record: SubmittedRequest = { hash: hash as Hex, owner: account, collection: latest.address, mode, status: "pending" };
      setTransaction(record);
      setStage("confirming");
      await confirm(record, true);
    } catch (cause) {
      if (submitted) setError("Confirmation is not available yet. Check the submitted transaction before trying again.");
      else if (id === checkId.current) setError(message(cause));
    } finally {
      requestLock.current = false;
      setStage("idle");
    }
  }

  async function checkConfirmation() {
    if (!transaction || requestLock.current) return;
    requestLock.current = true;
    setStage("confirming");
    setError(null);
    try { await confirm(transaction, false); }
    catch { setError("No confirmation found yet. Check BscScan or retry after returning to BNB Testnet."); }
    finally { requestLock.current = false; setStage("idle"); }
  }

  const intent = collection ? `Mint 1 NFT from ${collection.name}` : "";
  async function copyIntent() {
    try { await navigator.clipboard.writeText(intent); setCopied(true); }
    catch { setError("Copy is unavailable. Select the intent text and paste it into NALAR."); }
  }

  function chooseMode(next: MintMode) {
    if (busy) return;
    setMode(next);
    setAcknowledged(false);
    setTransaction(null);
    setToken(null);
    setError(null);
  }
  function requestLabel() {
    if (stage === "reading") return "Reading current contract…";
    if (stage === "wallet") return "Waiting for your wallet…";
    if (stage === "confirming") return "Waiting for confirmation…";
    if (transaction?.status === "pending") return "Transaction pending";
    if (checking) return "Reading collection…";
    if (!account) return "Connect wallet";
    if (mode === "trap") return "Test approval trap";
    return collection && collection.minted >= collection.maximum ? "Collection sold out" : "Mint 1 NFT";
  }
  function receiptLabel() {
    if (transaction?.status === "reverted") return "Transaction reverted";
    if (transaction?.status !== "confirmed") return "Submitted · awaiting confirmation";
    if (token) return `Edition #${token.id} minted`;
    return transaction.mode === "trap" ? "Approval confirmed — no NFT minted" : "Transaction confirmed";
  }

  return (
    <DemoFrame>
      <div className="demo-intro">
        <span className="demo-kicker">NALAR EDITIONS / TRANSACTION LAB</span>
        <h1>One collection.<br />Two very different requests.</h1>
        <p>A real NFT mint. A permission trap dressed as one. Try both with NALAR and see what your wallet is actually being asked to do.</p>
      </div>

      <div className="demo-grid">
        <DemoArtwork image={token?.image ?? collection?.image} name={token?.name ?? collection?.name} minted={collection?.minted} maximum={collection?.maximum} tokenId={token?.id} />
        <section className="demo-panel" aria-labelledby="collection-title">
          <div className="demo-panel-topline"><span>THE MINT DESK</span><span>TESTNET ONLY</span></div>
          <h2 id="collection-title">{collection?.name ?? "Nalar Editions"}</h2>
          <dl className="demo-facts">
            <div><dt>Mint price</dt><dd>{collection ? `${formatEther(collection.price)} tBNB` : "Read from contract"}</dd></div>
            <div><dt>Available</dt><dd>{collection ? `${collection.maximum - collection.minted} of ${collection.maximum}` : "Read from contract"}</dd></div>
            <div><dt>Your wallet</dt><dd>{account ? <ContractLink address={account} /> : "Not connected"}</dd></div>
          </dl>

          <fieldset className="demo-cases" disabled={busy}>
            <legend>Choose a request</legend>
            <label className={mode === "normal" ? "is-selected" : ""}><input type="radio" name="mint-mode" value="normal" checked={mode === "normal"} onChange={() => chooseMode("normal")} /><span><strong>Normal mint</strong><small>Creates one NFT in your wallet.</small></span><span className="demo-case-tag">MINT</span></label>
            <label className={mode === "trap" ? "is-selected" : ""}><input type="radio" name="mint-mode" value="trap" checked={mode === "trap"} onChange={() => chooseMode("trap")} disabled={!collection?.trap} /><span><strong>Approval trap</strong><small>Requests NFT permission instead.</small></span><span className="demo-case-tag">PERMISSION</span></label>
          </fieldset>
          {!checking && collection && !collection.trap && <p className="demo-helper">The trap contract is not configured for this deployment.</p>}

          <div className="demo-intent">
            <div className="demo-section-label"><span>YOUR INTENT · SAME FOR BOTH</span><button type="button" onClick={copyIntent} disabled={!intent} aria-label="Copy mint intent">{copied ? "Copied ✓" : "Copy intent"}</button></div>
            <p>{intent || "Load the collection to prepare your intent."}</p>
            <small>Paste this into NALAR when it asks what you intend to do.</small>
          </div>
          {mode === "trap" && <div className="demo-trap-note" key="trap"><strong>This request does not mint.</strong><p>If signed, the trap can transfer every NFT you own in this demo collection. It cannot access other collections.</p><label className="demo-ack"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} disabled={busy} /><span>I understand this tests collection-wide NFT permission.</span></label></div>}

          <button type="button" className="demo-primary" onClick={account ? submit : connect} disabled={checking || busy || !collection || (account !== null && (mode === "trap" ? !acknowledged : collection.minted >= collection.maximum))}>
            {requestLabel()}<span aria-hidden="true">↗</span>
          </button>
          <p className="demo-helper" aria-live="polite">{stage === "wallet" ? "Review the request in NALAR and your wallet. Nothing is signed automatically." : "Normal mint: mint price + gas. Approval trap: gas only. Both send real wallet requests."}</p>
          {wrongNetwork && <button type="button" className="demo-secondary" onClick={switchNetwork} disabled={stage !== "idle"}>Switch to BNB Testnet</button>}
          {error && <div className="demo-notice is-error" role="alert"><p>{error}</p>{!busy && <button type="button" onClick={() => void refresh()}>Recheck contract</button>}</div>}
          {transaction && <div className={`demo-notice ${transaction.status === "confirmed" ? "is-success" : "is-pending"}`} role="status">
            <strong>{receiptLabel()}</strong>
            {transaction.status === "confirmed" && transaction.mode === "trap" && <p>The trap now has permission for this collection. This is not a mint receipt.</p>}
            <a href={`${explorer}/tx/${transaction.hash}`} target="_blank" rel="noreferrer" title={transaction.hash}>View transaction ↗</a>
            {transaction.status === "pending" && stage === "idle" && <button type="button" onClick={checkConfirmation}>Check confirmation</button>}
          </div>}

          <details className="demo-details"><summary>Inspect the actual request</summary><dl className="demo-facts">
            <div><dt>Network</dt><dd>BNB Testnet · 97</dd></div>
            <div><dt>Target collection</dt><dd>{collection ? <ContractLink address={collection.address} /> : "Unavailable"}</dd></div>
            <div><dt>Function</dt><dd><code>{mode === "normal" ? "safeMint()" : "setApprovalForAll"}</code></dd></div>
            {mode === "trap" && collection?.trap && <><div><dt>Operator / trap</dt><dd><ContractLink address={collection.trap.operator} /></dd></div><div><dt>Approved</dt><dd>true · all NFTs in this collection</dd></div></>}
            <div><dt>Request value</dt><dd>{collection ? `${formatEther(mode === "normal" ? collection.price : collection.trap?.value ?? 0n)} tBNB` : "Unavailable"}</dd></div>
          </dl><p className="demo-helper">The normal request is encoded from the collection ABI. The trap request is read from its deployed contract and validated before sending. NALAR—not this page—determines the security verdict.</p></details>
        </section>
      </div>
      <section className="demo-guide" aria-labelledby="demo-guide-title"><h2 id="demo-guide-title">Test the action, not the button.</h2><ol><li><strong>Activate NALAR</strong><p>Install the extension, select BNB Testnet, and use a wallet with tBNB for gas.</p></li><li><strong>Mint an edition</strong><p>Copy the intent, choose Normal mint, then inspect the request before signing.</p></li><li><strong>Compare the trap</strong><p>Keep the same intent. Choose Approval trap and inspect the collection-wide permission it requests instead.</p></li></ol></section>
    </DemoFrame>
  );
}
