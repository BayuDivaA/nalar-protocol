"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BaseError, formatEther, isAddress, isAddressEqual, isHash, toHex, type Address, type Hex, type ReplacementReason } from "viem";
import { bscTestnet } from "viem/chains";

import { DemoArtwork, DemoFrame } from "@/src/components/DemoFrame";
import { assertDemoChain, buildDemoTransaction, demoClient, demoReceiptStatus, getDemoWallet, readDemoCollection, readMintedToken, type DemoCollection, type MintMode, type WalletProvider } from "@/src/lib/nft-demo";

const demoAddress = process.env.NEXT_PUBLIC_DEMO_NFT_ADDRESS;
const trapAddress = process.env.NEXT_PUBLIC_DEMO_MINT_TRAP_ADDRESS;
const explorer = bscTestnet.blockExplorers.default.url;
type SubmittedRequest = { hash: Hex; owner: Address; collection: Address; mode: MintMode; status: "pending" | ReturnType<typeof demoReceiptStatus> };
const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
const message = (cause: unknown) => cause instanceof BaseError ? cause.shortMessage : cause instanceof Error ? cause.message : "The request could not be completed. Retry.";

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
  const requestValue = mode === "normal" ? collection?.price : collection?.trap?.value;
  const visibleToken = account && collection && transaction && !wrongNetwork
    && isAddressEqual(account, transaction.owner)
    && isAddressEqual(collection.address, transaction.collection) ? token : null;

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
      if (id === checkId.current) setError(message(cause));
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

  async function confirm(record: SubmittedRequest, timeout: number) {
    const provider = getDemoWallet();
    const id = checkId.current;
    await assertDemoChain(provider);
    const client = demoClient(provider);
    let replacement: ReplacementReason | undefined;
    const receipt = await client.waitForTransactionReceipt({
      hash: record.hash,
      timeout,
      pollingInterval: 2_000,
      onReplaced: ({ reason }) => { replacement = reason; },
    });
    await assertDemoChain(provider);
    if (id !== checkId.current) throw new Error("Wallet context changed. Return to Testnet and check confirmation.");
    const status = demoReceiptStatus(receipt, replacement);
    setTransaction({ ...record, hash: receipt.transactionHash, status });
    if (status !== "confirmed") return;
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
      if (id === checkId.current) setError(record.mode === "normal"
        ? "Transaction confirmed, but NFT details could not be loaded. Use Reload NFT details to retry."
        : "Approval confirmed, but collection data could not be refreshed. Recheck the contract.");
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
      await confirm(record, 90_000);
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
    try { await confirm(transaction, 12_000); }
    catch { setError("The receipt or NFT details could not be read. Check BscScan or retry after returning to BNB Testnet."); }
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
    if (transaction?.status === "cancelled") return "Transaction cancelled. Original request not confirmed.";
    if (transaction?.status === "replaced") return "Transaction replaced. Original request not confirmed.";
    if (transaction?.status === "reverted") return "Transaction reverted";
    if (transaction?.status !== "confirmed") return "Submitted · awaiting confirmation";
    if (visibleToken) return `Edition #${visibleToken.id} minted`;
    return transaction.mode === "trap" ? "Approval confirmed. No NFT minted." : "Transaction confirmed";
  }

  return (
    <DemoFrame>
      <div className="demo-intro">
        <span className="demo-kicker">NALAR EDITIONS / TRANSACTION LAB</span>
        <h1>One collection.<br />Two very different requests.</h1>
        <p>A real NFT mint. A permission trap dressed as one. Try both with NALAR and see what your wallet is actually being asked to do.</p>
      </div>

      <fieldset className="demo-cases" disabled={busy}>
        <legend>Choose the transaction to test</legend>
        <label className={mode === "normal" ? "is-selected" : ""}><input type="radio" name="mint-mode" value="normal" checked={mode === "normal"} onChange={() => chooseMode("normal")} /><span><strong>Normal mint</strong><small>Creates one NFT in your wallet.</small></span><span className="demo-case-tag">MINT</span></label>
        <label className={mode === "trap" ? "is-selected" : ""}><input type="radio" name="mint-mode" value="trap" checked={mode === "trap"} onChange={() => chooseMode("trap")} disabled={!collection?.trap} /><span><strong>Approval trap</strong><small>Requests NFT permission instead.</small></span><span className="demo-case-tag">PERMISSION</span></label>
      </fieldset>

      <div className="demo-grid">
        <DemoArtwork image={visibleToken?.image ?? collection?.image} name={visibleToken?.name ?? collection?.name} minted={collection?.minted} maximum={collection?.maximum} tokenId={visibleToken?.id} />
        <section className="demo-panel" aria-labelledby="collection-title">
          <div className="demo-panel-topline"><span>{mode === "normal" ? "MINT REQUEST" : "APPROVAL REQUEST"}</span><span>TESTNET ONLY</span></div>
          <h2 id="collection-title">{collection?.name ?? "Nalar Editions"}{mode === "trap" && " · Approval test"}</h2>
          <dl className="demo-facts">
            <div><dt>{mode === "normal" ? "Mint price" : "Request value"}</dt><dd>{requestValue !== undefined ? `${formatEther(requestValue)} tBNB` : "Read from contract"}</dd></div>
            {mode === "normal" ? <div><dt>Available</dt><dd>{collection ? `${collection.maximum - collection.minted} of ${collection.maximum}` : "Read from contract"}</dd></div> : <div><dt>Permission scope</dt><dd>All your NFTs in this collection</dd></div>}
            <div><dt>Collection contract</dt><dd>{collection ? <ContractLink address={collection.address} /> : "Unavailable"}</dd></div>
            {mode === "trap" && collection?.trap && <div><dt>Operator / trap</dt><dd><ContractLink address={collection.trap.operator} /></dd></div>}
            <div><dt>Your wallet</dt><dd>{account ? <ContractLink address={account} /> : "Not connected"}</dd></div>
          </dl>

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
          <p className="demo-helper" aria-live="polite">{stage === "wallet" ? "Review the request in NALAR and your wallet. Nothing is signed automatically." : mode === "normal" ? "Mint price + Testnet gas. The NFT is minted only after confirmation." : "Testnet gas only. This grants permission, not an NFT. Do not sign unless you intend to test it."}</p>
          {wrongNetwork && <button type="button" className="demo-secondary" onClick={switchNetwork} disabled={stage !== "idle"}>Switch to BNB Testnet</button>}
          {error && <div className="demo-notice is-error" role="alert"><p>{error}</p>{!busy && <button type="button" onClick={() => void refresh()}>Recheck contract</button>}</div>}
          {transaction && <div className={`demo-notice ${transaction.status === "confirmed" ? "is-success" : "is-pending"}`} role="status">
            <strong>{receiptLabel()}</strong>
            <p>Submitted by <ContractLink address={transaction.owner} /></p>
            {transaction.status === "confirmed" && transaction.mode === "trap" && <p>The trap now has permission for this collection. This is not a mint receipt.</p>}
            <a href={`${explorer}/tx/${transaction.hash}`} target="_blank" rel="noreferrer" title={transaction.hash}>View transaction ↗</a>
            {transaction.status === "pending" && stage === "idle" && <button type="button" onClick={checkConfirmation}>Check confirmation</button>}
            {transaction.status === "confirmed" && transaction.mode === "normal" && !token && stage === "idle" && <button type="button" onClick={checkConfirmation}>Reload NFT details</button>}
          </div>}

          <details className="demo-details"><summary>{mode === "normal" ? "NFT contract & mint request" : "Approval contracts & permission request"}</summary><dl className="demo-facts">
            <div><dt>Network</dt><dd>BNB Testnet · 97</dd></div>
            <div><dt>Target collection</dt><dd>{collection ? <ContractLink address={collection.address} /> : "Unavailable"}</dd></div>
            <div><dt>Function</dt><dd><code>{mode === "normal" ? "safeMint()" : "setApprovalForAll"}</code></dd></div>
            {mode === "trap" && collection?.trap && <><div><dt>Operator / trap</dt><dd><ContractLink address={collection.trap.operator} /></dd></div><div><dt>Approved</dt><dd>true · all NFTs in this collection</dd></div></>}
            <div><dt>Request value</dt><dd>{requestValue !== undefined ? `${formatEther(requestValue)} tBNB` : "Unavailable"}</dd></div>
          </dl><p className="demo-helper">The normal request is encoded from the collection ABI. The trap request is read from its deployed contract and validated before sending. Only NALAR determines the security verdict.</p></details>
        </section>
      </div>
      <section className="demo-guide" aria-labelledby="demo-guide-title"><h2 id="demo-guide-title">Test the action, not the button.</h2><ol><li><strong>Activate NALAR</strong><p>Install the extension, select BNB Testnet, and use a wallet with tBNB for gas.</p></li><li><strong>Mint an edition</strong><p>Copy the intent, choose Normal mint, then inspect the request before signing.</p></li><li><strong>Compare the trap</strong><p>Keep the same intent. Choose Approval trap and inspect the collection-wide permission it requests instead.</p></li></ol></section>
    </DemoFrame>
  );
}
