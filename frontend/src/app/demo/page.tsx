"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { decodeFunctionResult, encodeFunctionData, formatEther, isAddress, parseAbi, toHex, type Hex } from "viem";
import { bscTestnet } from "viem/chains";

import { DemoArtwork, DemoFrame } from "@/src/components/DemoFrame";

const demoAddress = process.env.NEXT_PUBLIC_DEMO_NFT_ADDRESS;
const demoAbi = parseAbi([
  "function name() view returns (string)",
  "function getMintPrice() view returns (uint256)",
  "function safeMint() payable",
]);

type WalletProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: () => void) => void;
  removeListener?: (event: string, listener: () => void) => void;
};

type Collection = { name: string; price: bigint };

function getWallet(): WalletProvider {
  const provider = (window as Window & { ethereum?: WalletProvider }).ethereum;
  if (!provider?.request) throw new Error("No wallet found. Install or unlock a browser wallet, then retry.");
  return provider;
}

async function readContract(provider: WalletProvider, address: `0x${string}`): Promise<Collection> {
  const code = await provider.request({ method: "eth_getCode", params: [address, "latest"] });
  if (code === "0x" || !code) throw new Error("The demo NFT contract was not found on BNB Testnet.");

  const [nameData, priceData] = await Promise.all([
    provider.request({ method: "eth_call", params: [{ to: address, data: encodeFunctionData({ abi: demoAbi, functionName: "name" }) }, "latest"] }),
    provider.request({ method: "eth_call", params: [{ to: address, data: encodeFunctionData({ abi: demoAbi, functionName: "getMintPrice" }) }, "latest"] }),
  ]);

  return {
    name: decodeFunctionResult({ abi: demoAbi, functionName: "name", data: nameData as Hex }),
    price: decodeFunctionResult({ abi: demoAbi, functionName: "getMintPrice", data: priceData as Hex }),
  };
}

export default function DemoPage() {
  const [collection, setCollection] = useState<Collection | null>(null);
  const [checking, setChecking] = useState(true);
  const [minting, setMinting] = useState(false);
  const [wrongNetwork, setWrongNetwork] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const checkId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++checkId.current;
    setChecking(true);
    setCollection(null);
    setWrongNetwork(false);
    setError(null);
    setTxHash(null);

    try {
      if (!demoAddress || !isAddress(demoAddress)) {
        throw new Error("Demo contract is not configured. Set NEXT_PUBLIC_DEMO_NFT_ADDRESS for this deployment.");
      }
      const provider = getWallet();
      const chainId = Number(await provider.request({ method: "eth_chainId" }));
      if (chainId !== bscTestnet.id) {
        if (id === checkId.current) setWrongNetwork(true);
        throw new Error("Switch your wallet to BNB Testnet to mint this NFT.");
      }
      const data = await readContract(provider, demoAddress);
      if (id === checkId.current) setCollection(data);
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
    const requestId = checkId;
    return () => {
      active = false;
      ++requestId.current;
      provider?.removeListener?.("chainChanged", refresh);
    };
  }, [refresh]);

  async function switchNetwork() {
    try {
      setError(null);
      await getWallet().request({ method: "wallet_switchEthereumChain", params: [{ chainId: toHex(bscTestnet.id) }] });
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Wallet could not switch networks.");
    }
  }

  async function mint() {
    if (!collection || !demoAddress || !isAddress(demoAddress) || minting) return;
    setMinting(true);
    setError(null);
    setTxHash(null);

    try {
      const provider = getWallet();
      const accounts = await provider.request({ method: "eth_requestAccounts" }) as string[];
      if (!accounts?.[0] || !isAddress(accounts[0])) throw new Error("Connect a wallet account to continue.");
      if (Number(await provider.request({ method: "eth_chainId" })) !== bscTestnet.id) {
        throw new Error("Wallet network changed. Switch back to BNB Testnet and retry.");
      }
      const latest = await readContract(provider, demoAddress);
      if (Number(await provider.request({ method: "eth_chainId" })) !== bscTestnet.id) {
        throw new Error("Wallet network changed. Switch back to BNB Testnet and retry.");
      }
      if (latest.price !== collection.price) setCollection(latest);
      const hash = await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: accounts[0], to: demoAddress, value: toHex(latest.price), data: encodeFunctionData({ abi: demoAbi, functionName: "safeMint" }) }],
      });
      if (typeof hash !== "string" || !/^0x[a-fA-F0-9]{64}$/.test(hash)) throw new Error("Wallet did not return a transaction hash.");
      setTxHash(hash);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Mint request was not submitted.");
    } finally {
      setMinting(false);
    }
  }

  return (
    <DemoFrame>
      <div className="demo-intro">
        <span className="demo-kicker">A REAL TESTNET MINT</span>
        <h1>Meet your next little collectible.</h1>
        <p>Mint one NFT from the TxSentry demo collection. Your wallet receives the real contract request, and NALAR can inspect it before you sign.</p>
      </div>

      <div className="demo-grid">
        <DemoArtwork />
        <section className="demo-panel" aria-labelledby="collection-title">
          <div className="demo-panel-topline"><span>THE COLLECTION</span><span>ERC-721</span></div>
          <h2 id="collection-title">{collection?.name ?? "Demo NFT"}</h2>
          <p className="demo-panel-copy">A simple collection on BNB Testnet. Each successful mint creates one token in your connected wallet.</p>
          <dl className="demo-facts">
            <div><dt>Mint price</dt><dd>{collection ? `${formatEther(collection.price)} tBNB` : "Read from contract"}</dd></div>
            <div><dt>Quantity</dt><dd>1 NFT</dd></div>
            <div><dt>Network</dt><dd>BNB Testnet</dd></div>
            <div><dt>Contract</dt><dd>{demoAddress && isAddress(demoAddress) ? <a href={`${bscTestnet.blockExplorers.default.url}/address/${demoAddress}`} target="_blank" rel="noreferrer" aria-label={`View contract ${demoAddress} on BscScan`}>{demoAddress.slice(0, 6)}…{demoAddress.slice(-4)} ↗</a> : "Not configured"}</dd></div>
          </dl>

          <button type="button" className="demo-primary" onClick={mint} disabled={!collection || checking || minting}>
            {minting ? "Waiting for wallet…" : checking ? "Checking contract…" : "Mint 1 NFT"}<span aria-hidden="true">↗</span>
          </button>
          {wrongNetwork && <button type="button" className="demo-secondary" onClick={switchNetwork}>Switch to BNB Testnet</button>}
          {error && <div className="demo-notice is-error" role="alert"><p>{error}</p><button type="button" onClick={() => void refresh()}>Retry</button></div>}
          {txHash && <div className="demo-notice is-success" role="status"><p>Transaction submitted to the network.</p><a href={`${bscTestnet.blockExplorers.default.url}/tx/${txHash}`} target="_blank" rel="noreferrer">View on BscScan ↗</a></div>}
          <p className="demo-helper">Use BNB Testnet in your wallet and NALAR extension. You pay the mint price plus gas; minting completes after network confirmation.</p>
        </section>
      </div>
    </DemoFrame>
  );
}
