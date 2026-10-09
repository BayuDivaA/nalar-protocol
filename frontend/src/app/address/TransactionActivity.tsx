import type { AddressFact, TransactionReport } from "@/src/lib/address-api";

export default function TransactionActivity({ report, language }: { report: TransactionReport; language: "english" | "indonesian" }) {
  const id = language === "indonesian";
  const called = report.facts.find((fact) => fact.id === "function_signature") ?? report.facts.find((fact) => fact.id === "function");
  const candidate = report.facts.find((fact) => fact.id === "function_candidate");
  const inputs = report.facts.filter((fact) => /^(candidate_)?argument_/.test(fact.id));
  const parties = report.facts.filter((fact) => ["from", "to", "value", "function_mode"].includes(fact.id));
  const execution = report.facts.find((fact) => fact.id === "execution");
  const events = report.facts.filter((fact) => /^event_\d+_action$/.test(fact.id));
  const partyLabels: Record<string, string> = id
    ? { from: "Pengirim", to: "Kontrak / penerima tujuan", value: "Nilai native yang diminta", function_mode: "Jenis panggilan pada interface" }
    : { from: "Sender", to: "Target contract / recipient", value: "Requested native value", function_mode: "Interface call type" };
  let callLabel = id ? "Fungsi belum diketahui" : "Function not established";
  if (called) callLabel = id ? "Fungsi yang dipanggil" : "Called function";
  else if (candidate) callLabel = id ? "Signature yang cocok, belum terverifikasi" : "Matching signature, not verified";
  const noCallData = report.facts.some((fact) => fact.id === "call_data");
  const unknownCall = noCallData ? (id ? "Tanpa calldata fungsi" : "No function calldata") : report.facts.find((fact) => fact.id === "selector")?.value;
  let executionText = id ? "Belum ada bukti eksekusi yang terkonfirmasi." : "Execution is not confirmed by an available receipt.";
  if (execution?.value === "Executed") executionText = id ? "Receipt menunjukkan eksekusi berhasil." : "The receipt reports successful execution.";
  else if (execution?.value === "Reverted") executionText = id ? "Eksekusi gagal (reverted). Permintaan ini tidak selesai dijalankan." : "Execution reverted. The requested operation did not complete.";

  function value(fact: AddressFact) {
    return fact.addressUrl
      ? <a href={fact.addressUrl} target="_blank" rel="noreferrer" title={fact.value} aria-label={`${fact.value} · ${report.network} explorer`}>{`${fact.value.slice(0, 8)}…${fact.value.slice(-6)}`} ↗</a>
      : fact.value;
  }

  return (
    <section className="address-activity" aria-labelledby="transaction-activity-heading">
      <div className="address-section-heading"><h3 id="transaction-activity-heading">{id ? "Fungsi dan hasil transaksi" : "Function & transaction result"}</h3></div>
      <div className="address-call">
        <span>{callLabel}</span>
        <code>{called?.value ?? candidate?.value ?? unknownCall ?? (id ? "Tidak tersedia" : "Unavailable")}</code>
        {!called && candidate && <p>{id ? "Data panggilan cocok dengan interface yang dikenal Nalar. Ini belum memastikan isi kode atau perilaku kontrak tujuan." : "Call data matches an interface known to Nalar. This does not verify the target contract's code or behavior."}</p>}
      </div>
      <dl className="address-activity-values">{parties.map((fact) => <div key={fact.id}><dt>{partyLabels[fact.id]}</dt><dd>{value(fact)}</dd></div>)}</dl>
      {inputs.length > 0 && <details className="address-call-inputs"><summary>{id ? "Input fungsi" : "Function inputs"} <span>{inputs.length}</span></summary><dl className="address-activity-values">{inputs.map((fact) => <div key={fact.id}><dt>{fact.label}</dt><dd>{value(fact)}</dd></div>)}</dl><p>{id ? "Angka adalah nilai dari calldata. Satuan token belum dipastikan kecuali disebutkan." : "Numbers come from calldata. Token units are not established unless specified."}</p></details>}
      <div className="address-recorded-result">
        <h4>{id ? "Hasil yang tercatat" : "Recorded result"}</h4>
        <p>{executionText}</p>
        {events.length > 0 ? <ul className="address-event-list">{events.map((event) => {
          const prefix = event.id.replace(/_action$/, "_");
          const fields = report.facts.filter((fact) => fact.id.startsWith(prefix) && fact.id !== event.id);
          return <li key={event.id}><strong>{event.value}</strong><dl className="address-activity-values">{fields.map((fact) => <div key={fact.id}><dt>{fact.label}</dt><dd>{value(fact)}</dd></div>)}</dl></li>;
        })}</ul> : <p className="address-activity-note">{id ? "Tidak ada catatan transfer atau approval yang berhasil diterjemahkan. Ini bukan bukti bahwa tidak ada perubahan lain." : "No transfer or approval record was decoded. This does not establish that there were no other changes."}</p>}
        {events.length > 0 && <p className="address-activity-note">{id ? "Catatan ini berasal dari event kontrak pada receipt, bukan verifikasi terpisah atas saldo, kepemilikan, atau seluruh perubahan transaksi." : "These are contract events from the receipt, not independent verification of balances, ownership, or every transaction effect."}</p>}
      </div>
    </section>
  );
}
