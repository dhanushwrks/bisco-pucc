"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FileSpreadsheet, UploadCloud, X } from "lucide-react";
import { Card, Notice } from "@/components/ui";

type Outlet = { id: string; name: string; licence_no: string };
type Issue = { row: number; vehicle?: string; reason: string };
type Result = {
  summary: { valid_rows: number; new_vehicles: number; renewed: number; already_imported: number; history_only: number; rejected: number; dry_run: boolean };
  period: { from: string; to: string };
  fileRange: { from: string; to: string } | null;
  rejected: Issue[];
  warnings: Issue[];
  warningCount: number;
};

export function UploadForm({ outlets, fixed, initialOutlet }: { outlets: Outlet[]; fixed: boolean; initialOutlet: string }) {
  const [outlet, setOutlet] = useState(initialOutlet);
  const [file, setFile] = useState<File | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState<"preview" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [done, setDone] = useState<Result | null>(null);
  const [drag, setDrag] = useState(false);
  const [switched, setSwitched] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function send(f: File, commit: boolean, period?: { from: string; to: string }, outletId = outlet) {
    setBusy(commit ? "import" : "preview");
    setError(null);
    const body = new FormData();
    body.set("file", f);
    body.set("outlet_id", outletId);
    if (period?.from && period?.to) { body.set("from", period.from); body.set("to", period.to); }
    if (commit) body.set("commit", "1");
    try {
      const res = await fetch("/api/upload", { method: "POST", body });
      const json = await res.json();
      if (!res.ok && json.matchOutlet && !commit && outlets.some((o) => o.id === json.matchOutlet.id) && !fixed) {
        setOutlet(json.matchOutlet.id);
        setSwitched(json.matchOutlet.name);
        return send(f, false, period, json.matchOutlet.id);
      }
      if (!res.ok) { setError(json.error ?? "Upload failed"); setResult(json.rejected ? { ...json, summary: null } : null); return; }
      if (commit) { setDone(json); setResult(null); }
      else {
        setResult(json);
        if (!period) { setFrom(json.period.from); setTo(json.period.to); }
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(null);
    }
  }

  function pick(f: File | undefined) {
    if (!f) return;
    setFile(f); setDone(null); setResult(null); setFrom(""); setTo(""); setSwitched(null);
    void send(f, false);
  }
  function reset() {
    setFile(null); setResult(null); setDone(null); setError(null); setFrom(""); setTo("");
    if (input.current) input.current.value = "";
  }

  if (!outlets.length) {
    return <Notice tone="amber">No outlets available. {fixed ? "Ask your owner to assign you to an outlet." : <Link className="underline" href="/outlets">Add an outlet first.</Link>}</Notice>;
  }

  if (done) {
    const s = done.summary;
    return (
      <Card>
        <div className="flex flex-col items-center py-8 text-center">
          <CheckCircle2 className="text-brand-600" size={40} strokeWidth={1.6} />
          <h2 className="mt-3 text-lg font-semibold">Imported {s.valid_rows - s.already_imported} certificates</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {s.new_vehicles} new vehicles · {s.renewed} renewals · {s.already_imported} already imported · {s.rejected} rejected
          </p>
          <div className="mt-6 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button className="btn-primary w-full sm:w-auto" onClick={reset}>Upload another file</button>
            <Link className="btn-outline w-full sm:w-auto" href="/vehicles">View vehicles</Link>
          </div>
        </div>
      </Card>
    );
  }

  const s = result?.summary;
  const periodChanged = result?.period && (from !== result.period.from || to !== result.period.to);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label className="label">Outlet</label>
              <select className="input" value={outlet} disabled={fixed || !!busy}
                onChange={(e) => { setOutlet(e.target.value); setSwitched(null); if (file) void send(file, false, undefined, e.target.value); }}>
                {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Period from</label>
              <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} disabled={!file} />
            </div>
            <div>
              <label className="label">Period to</label>
              <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} disabled={!file} />
            </div>
          </div>

          {!file ? (
            <button type="button"
              onClick={() => input.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
              className={`mt-5 flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-14 text-center transition ${
                drag ? "border-brand-500 bg-brand-50" : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"}`}>
              <UploadCloud size={32} strokeWidth={1.5} className="text-zinc-400" />
              <span className="mt-3 text-sm font-medium">Drop the certificate export here</span>
              <span className="mt-1 text-xs text-zinc-500">or click to browse · .xlsx, .xls, .csv up to 10 MB</span>
            </button>
          ) : (
            <div className="mt-5 flex items-center gap-3 rounded-xl border border-zinc-200 px-4 py-3">
              <FileSpreadsheet size={22} strokeWidth={1.6} className="text-brand-600" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{file.name}</div>
                <div className="text-xs text-zinc-500">{(file.size / 1024).toFixed(1)} KB{busy === "preview" ? " · checking…" : ""}</div>
              </div>
              <button type="button" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100" onClick={reset} aria-label="Remove file"><X size={16} /></button>
            </div>
          )}
          <input ref={input} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />

          {switched && !error && <div className="mt-4"><Notice tone="green">Outlet switched to <b className="font-medium">{switched}</b> — it matches the licence number in this file.</Notice></div>}
          {error && <div className="mt-4"><Notice tone="red">{error}</Notice></div>}
        </Card>

        {result && result.rejected?.length > 0 && (
          <Card pad={false} title={`${s?.rejected ?? result.rejected.length} rows will be skipped`}>
            <ul className="max-h-72 divide-y divide-zinc-100 overflow-auto text-sm">
              {result.rejected.map((r, i) => (
                <li key={i} className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:gap-4 sm:px-5">
                  <div className="flex gap-3 sm:contents">
                    <span className="w-14 shrink-0 text-xs text-zinc-400 tabular">Row {r.row}</span>
                    <span className="min-w-0 font-mono text-xs sm:w-28 sm:shrink-0">{r.vehicle ?? "—"}</span>
                  </div>
                  <span className="min-w-0 break-words text-zinc-600">{r.reason}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <Card title="Preview">
        {!s ? (
          <p className="text-sm text-zinc-500">{busy ? "Reading file…" : "Choose a file to see what will be imported. Nothing is saved until you confirm."}</p>
        ) : (
          <div className="space-y-4">
            <dl className="space-y-2.5 text-sm">
              <Row label="New vehicles" value={s.new_vehicles} accent />
              <Row label="Renewals (updated)" value={s.renewed} />
              <Row label="Older history only" value={s.history_only} muted />
              <Row label="Already imported" value={s.already_imported} muted />
              <Row label="Rejected rows" value={s.rejected} danger={s.rejected > 0} />
            </dl>
            {result.warningCount > 0 && (
              <Notice tone="amber">{result.warningCount} {result.warningCount === 1 ? "row has" : "rows have"} no valid mobile — they’ll be imported without WhatsApp reminders.</Notice>
            )}
            <div className="border-t border-zinc-100 pt-4">
              {periodChanged ? (
                <button className="btn-outline w-full" disabled={!!busy || !from || !to}
                  onClick={() => file && send(file, false, { from, to })}>
                  {busy === "preview" ? "Checking…" : "Update preview for new period"}
                </button>
              ) : (
                <button className="btn-accent w-full" disabled={!!busy || s.valid_rows - s.already_imported === 0}
                  onClick={() => file && send(file, true, { from, to })}>
                  {busy === "import" ? "Importing…" : s.valid_rows - s.already_imported === 0 ? "Nothing new to import" : `Import ${s.valid_rows - s.already_imported} certificates`}
                </button>
              )}
              <p className="mt-2 text-center text-xs text-zinc-500">Vehicle numbers are de-duplicated automatically.</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function Row({ label, value, accent, muted, danger }: { label: string; value: number; accent?: boolean; muted?: boolean; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className={muted ? "text-zinc-400" : "text-zinc-600"}>{label}</dt>
      <dd className={`font-semibold tabular ${accent ? "text-brand-700" : danger ? "text-rose-600" : muted ? "text-zinc-400" : ""}`}>{value}</dd>
    </div>
  );
}
