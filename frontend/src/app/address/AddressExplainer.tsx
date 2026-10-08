"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { AddressApiError, getExplainerReport, type AddressExplanation, type ExplainerReport } from "@/src/lib/address-api";

import "./address.css";

type Language = "english" | "indonesian";
type ConversationItem = { question: string; answer: AddressExplanation; checkedAt: string };

function shortAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value) || /^0x[a-fA-F0-9]{64}$/.test(value) ? `${value.slice(0, 10)}…${value.slice(-8)}` : value;
}

const isSubject = (value: string) => /^0x(?:[a-fA-F0-9]{40}|[a-fA-F0-9]{64})$/.test(value.trim());

function checkedTime(value: string, language: Language) {
  return new Date(value).toLocaleString(language === "indonesian" ? "id-ID" : "en-US", { dateStyle: "medium", timeStyle: "short" });
}

function sourceName(source: string) {
  return source === "BNB_MCP" ? "BNB MCP" : source === "RPC" ? "On-chain · RPC" : source === "ABI" ? "Contract ABI" : source === "SOURCIFY" ? "Sourcify" : "Protocol registry";
}

export default function AddressExplainer({ initialQuery, initialChainId, autoInspect }: { initialQuery: string; initialChainId: 56 | 97; autoInspect: boolean }) {
  const [chainId, setChainId] = useState<56 | 97>(initialChainId);
  const [query, setQuery] = useState(initialQuery);
  const [language, setLanguage] = useState<Language>("english");
  const [report, setReport] = useState<ExplainerReport | null>(null);
  const [summary, setSummary] = useState<{ answer: AddressExplanation; checkedAt: string } | null>(null);
  const [conversation, setConversation] = useState<ConversationItem[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const requestId = useRef(0);
  const controller = useRef<AbortController | null>(null);

  const cancelActive = useCallback(() => {
    requestId.current += 1;
    controller.current?.abort();
    controller.current = null;
    setLoading(false);
    setAsking(false);
  }, []);

  const resetContext = useCallback(() => {
    cancelActive();
    setReport(null);
    setSummary(null);
    setConversation([]);
    setQuestion("");
    setError(null);
    setChatError(null);
  }, [cancelActive]);

  const inspect = useCallback(async (nextQuery: string, nextChainId: 56 | 97) => {
    cancelActive();
    setError(null);
    setChatError(null);
    if (!isSubject(nextQuery)) {
      setError("Enter a valid 0x address (40 hex characters) or transaction hash (64 hex characters).");
      return;
    }
    const currentId = requestId.current;
    const abort = new AbortController();
    controller.current = abort;
    setLoading(true);
    try {
      const result = await getExplainerReport({ chainId: nextChainId, query: nextQuery.trim() }, abort.signal);
      if (currentId !== requestId.current) return;
      setReport(result);
      setSummary(result.answer ? { answer: result.answer, checkedAt: result.checkedAt } : null);
      setConversation([]);
      window.history.replaceState(null, "", `/address?chainId=${nextChainId}&query=${encodeURIComponent(result.kind === "address" ? result.address : result.hash)}`);
    } catch (cause) {
      if (currentId !== requestId.current || abort.signal.aborted) return;
      setError(cause instanceof AddressApiError ? cause.message : "The on-chain data could not be checked. Please retry.");
    } finally {
      if (currentId === requestId.current) setLoading(false);
    }
  }, [cancelActive]);

  useEffect(() => {
    if (!autoInspect || !initialQuery) return;
    let active = true;
    queueMicrotask(() => { if (active) void inspect(initialQuery, initialChainId); });
    return () => { active = false; };
  }, [autoInspect, initialQuery, initialChainId, inspect]);

  useEffect(() => () => {
    controller.current?.abort();
  }, []);

  function submitQuery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetContext();
    void inspect(query, chainId);
  }

  async function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = question.trim();
    if (!report || !prompt || asking) return;
    const currentId = requestId.current;
    const abort = new AbortController();
    controller.current = abort;
    setAsking(true);
    setChatError(null);
    try {
      const result = await getExplainerReport({
        chainId: report.chainId,
        query: report.kind === "address" ? report.address : report.hash,
        question: prompt,
        history: conversation.slice(-3).map((item) => ({ question: item.question, answer: item.answer.english })),
      }, abort.signal);
      if (currentId !== requestId.current) return;
      setReport(result);
      if (result.answer) {
        setConversation((items) => [...items, { question: prompt, answer: result.answer!, checkedAt: result.checkedAt }]);
        setQuestion("");
      } else {
        setChatError("The explanation service is unavailable. The on-chain observations remain visible below.");
      }
    } catch (cause) {
      if (currentId !== requestId.current || abort.signal.aborted) return;
      setChatError(cause instanceof AddressApiError ? cause.message : "Could not answer that question. Please retry.");
    } finally {
      if (currentId === requestId.current) setAsking(false);
    }
  }

  const codeFact = report?.facts.find((fact) => fact.id === "code");
  const executionFact = report?.facts.find((fact) => fact.id === "execution");
  const factualIntro = report?.kind === "transaction"
    ? language === "english"
      ? `This record shows a transaction request${executionFact?.value === "Executed" ? " and a successful execution receipt" : executionFact?.value === "Reverted" ? " and a reverted execution receipt" : "; its execution result may still be unknown"}. It does not establish every token movement or outcome.`
      : `Data ini menunjukkan permintaan transaksi${executionFact?.value === "Executed" ? " dan bukti eksekusi berhasil" : executionFact?.value === "Reverted" ? " dan bukti eksekusi gagal" : "; hasil eksekusinya mungkin belum diketahui"}. Ini tidak memastikan semua perpindahan token atau hasil akhir.`
    : !codeFact
    ? language === "english" ? "Code status was not available in this report." : "Status kode tidak tersedia dalam laporan ini."
    : codeFact.value === "Present"
    ? language === "english" ? "This network returned contract code at the address. The observations below show what could be read; they are not a contract audit." : "Jaringan ini menemukan kode kontrak di alamat tersebut. Data di bawah menunjukkan hal yang bisa dibaca; ini bukan audit kontrak."
    : language === "english" ? "No contract code was returned at the time checked. That does not establish who controls this address." : "Saat diperiksa, tidak ada kode kontrak yang terbaca. Hal itu tidak memastikan siapa yang mengendalikan alamat ini.";

  return (
    <div className="address-page">
      <header className="address-header">
        <div className="page-frame address-header-inner">
          <Link href="/" className="address-wordmark" aria-label="Nalar Protocol home">
            <Image src="/brand/nalar-dark.svg" alt="" width={256} height={128} className="brand-logo-dark" priority />
            <Image src="/brand/nalar-light.svg" alt="" width={256} height={128} className="brand-logo-light" priority />
          </Link>
          <nav aria-label="Address page navigation"><Link href="/">Home</Link><Link href="/demo">Demo</Link></nav>
        </div>
      </header>

      <main>
        <section className="page-frame address-hero">
          <span className="address-kicker">Nalar / On-chain Explainer</span>
          <h1>Make on-chain data readable.</h1>
          <p>Understand a wallet address, contract, or transaction hash on BNB Chain. Ask what the observed details mean. No wallet connection or security decision.</p>
        </section>

        <section className="page-frame address-workspace" aria-label="Inspect BNB Chain data">
          <form className="address-search" onSubmit={submitQuery}>
            <div className="address-search-heading"><h2>Inspect on-chain data</h2><span>READ-ONLY · BNB CHAIN</span></div>
            <div className="address-search-fields">
              <label className="address-field address-network-field">Network
                <select value={chainId} onChange={(event) => { resetContext(); setChainId(Number(event.target.value) as 56 | 97); }}>
                  <option value={56}>BNB Mainnet · 56</option>
                  <option value={97}>BNB Testnet · 97</option>
                </select>
              </label>
              <label className="address-field address-value-field">Address or tx hash
                <input value={query} onChange={(event) => { resetContext(); setQuery(event.target.value); }} type="text" placeholder="0x… wallet, contract, or tx hash" maxLength={66} autoComplete="off" autoCapitalize="none" spellCheck={false} required aria-describedby="address-privacy" aria-invalid={error?.startsWith("Enter a valid") ?? false} />
              </label>
              <button type="submit" className="address-search-button" disabled={loading}>{loading ? "Reading…" : "Explain data"}</button>
            </div>
            <p id="address-privacy" className="address-privacy">The public address or hash and your questions are sent to Nalar; AI responses may be processed by its configured model provider. Never enter private keys or personal information.</p>
          </form>

          {error && <div className="address-alert" role="alert"><strong>{error.startsWith("Enter a valid") ? "Check the address or hash" : "Could not complete the lookup"}</strong><span>{error}</span>{!error.startsWith("Enter a valid") && <button type="button" onClick={() => void inspect(query, chainId)}>Retry</button>}</div>}
          {loading && <div className="address-loading" role="status"><span className="address-loading-line" aria-hidden="true" />Reading on-chain observations for {chainId === 56 ? "BNB Mainnet" : "BNB Testnet"}…</div>}

          {!report && !loading && !error && <div className="address-empty"><p>Enter a public wallet address, contract address, or transaction hash. Nalar will show what is observed and what remains unknown.</p></div>}

          {report && !loading && (
            <div className="address-report">
              <div className="address-report-topline">
                <div><span className="address-kicker">{report.kind === "address" ? "Address" : "Transaction"} / {report.network}</span><h2 title={report.kind === "address" ? report.address : report.hash}>{shortAddress(report.kind === "address" ? report.address : report.hash)}</h2></div>
                <a href={report.explorerUrl} target="_blank" rel="noreferrer" title={report.kind === "address" ? report.address : report.hash} aria-label={`Open ${report.kind === "address" ? report.address : report.hash} on ${report.network} explorer`}>View on explorer ↗</a>
              </div>
              <p className="address-observed-at">Checked {checkedTime(report.checkedAt, language)} · These observations can change.</p>

              <div className="address-report-grid">
                <div className="address-primary-column">
                  <section className="address-explanation" aria-labelledby="address-explanation-heading">
                    <div className="address-section-heading"><h3 id="address-explanation-heading">In plain language</h3><button type="button" className="address-language-toggle" onClick={() => setLanguage((current) => current === "english" ? "indonesian" : "english")} aria-label={language === "english" ? "Translate explanations to Bahasa Indonesia" : "Show explanations in English"}>{language === "english" ? "Bahasa Indonesia" : "English"}</button></div>
                    <p className="address-factual-intro">{factualIntro}</p>
                    {summary ? <><p className="address-ai-copy">{summary.answer[language]}</p><p className="address-citation">Explained from observations {summary.answer.factIds.map((id) => `#${id}`).join(" · ")} · {checkedTime(summary.checkedAt, language)}</p></> : <p className="address-ai-unavailable">AI explanation is unavailable right now. The observed facts are still shown here.</p>}
                  </section>

                  <section className="address-questions" aria-labelledby="address-questions-heading">
                    <div className="address-section-heading"><h3 id="address-questions-heading">Ask a follow-up</h3><span>ABOUT THIS {report.kind === "address" ? "ADDRESS" : "TRANSACTION"}</span></div>
                    <p>{report.kind === "address" ? "For example: “What do these contract functions do?”" : "For example: “Who received this transaction?”"}</p>
                    {conversation.length > 0 && <div className="address-conversation" aria-live="polite">{conversation.map((item, index) => <div className="address-conversation-item" key={`${item.checkedAt}-${index}`}><p className="address-question-text">{item.question}</p><p>{item.answer[language]}</p><small>Based on {item.answer.factIds.map((id) => `#${id}`).join(", ")} · {checkedTime(item.checkedAt, language)}</small></div>)}</div>}
                    <form onSubmit={submitQuestion} className="address-question-form"><label className="sr-only" htmlFor="address-question-input">Question about this {report.kind}</label><input id="address-question-input" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={500} placeholder="Ask about these observations…" disabled={asking} /><button type="submit" disabled={asking || !question.trim()}>{asking ? "Checking…" : "Ask"}</button></form>
                    {chatError && <p className="address-chat-error" role="alert">{chatError}</p>}
                  </section>
                </div>

                <aside className="address-evidence" aria-labelledby="address-evidence-heading">
                  <div className="address-section-heading"><h3 id="address-evidence-heading">Observed facts</h3><span>{report.facts.length} READINGS</span></div>
                  <dl className="address-fact-list">{report.facts.map((fact) => <div className="address-fact" key={fact.id}><dt>{fact.label}</dt><dd>{fact.addressUrl ? <a href={fact.addressUrl} target="_blank" rel="noreferrer" title={fact.value} aria-label={`Open ${fact.value} on ${report.network} explorer`}>{shortAddress(fact.value)} ↗</a> : <span title={fact.value} className="address-fact-value">{fact.value}</span>}</dd><div className="address-fact-meta"><span>{sourceName(fact.source)}</span><time dateTime={fact.checkedAt}>{checkedTime(fact.checkedAt, language)}</time></div>{fact.note && <p>{fact.note}</p>}</div>)}</dl>
                  {report.kind === "address" && report.functions.length > 0 && <details className="address-functions"><summary>Contract functions <span>{report.functionCount} listed · {report.functions.length} shown</span></summary><p>From the available interface. Names and inputs do not prove what the code does or who can call it.</p><ul>{report.functions.map((item) => <li key={item.signature}><code title={item.signature}>{item.signature}</code><span>{item.mode === "read" ? "Reads data" : item.mode === "payable" ? "Can receive BNB" : "May change state"}</span>{item.outputs.length > 0 && <small>Returns {item.outputs.map((output) => output.type).join(", ")}</small>}</li>)}</ul></details>}
                  {report.unknowns.length > 0 && <div className="address-unknowns"><h4>Not established</h4><ul>{report.unknowns.map((unknown) => <li key={unknown}>{unknown}</li>)}</ul></div>}
                  <p className="address-source-note">RPC: {report.sources.rpc} · ABI: {report.sources.abi} · BNB MCP: {report.sources.mcp.replace("_", " ")}</p>
                </aside>
              </div>
              <p className="address-disclaimer">This read-only page translates available chain data. It is not a contract audit, identity verification, or transaction safety decision. Function names and a successful execution receipt do not establish every effect.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
