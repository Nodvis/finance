"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { SerializedHouseholdAccount } from "@/lib/accounts/serialization";

type Props = {
  householdId: string;
  accounts: SerializedHouseholdAccount[];
  initialAccountId?: string | undefined;
};

type Inspect = {
  headers: string[];
  detectedDelimiter: string;
  detectedEncoding: string;
  totalRowCount: number;
};

type PreviewRow = {
  rowIndex: number;
  valid: boolean;
  status: string;
  errorMessage?: string | null;
  date?: string | null;
  kind?: string | null;
  amountMinor?: string | null;
  currency?: string | null;
  formattedAmount?: string | null;
  description?: string | null;
  possibleMatch?: unknown;
  selected: boolean;
};

type Preview = {
  batchId: string;
  totalRowCount: number;
  validRowCount: number;
  invalidRowCount: number;
  duplicateRowCount: number;
  rows: PreviewRow[];
};

export function ImportView({ householdId, accounts, initialAccountId }: Props) {
  const t = useTranslations("Imports");
  const [accountId, setAccountId] = useState(initialAccountId ?? accounts[0]?.id ?? "");
  const account = accounts.find((item) => item.id === accountId);
  const [file, setFile] = useState<File | null>(null);
  const [inspect, setInspect] = useState<Inspect | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [dateColumn, setDateColumn] = useState("");
  const [amountColumn, setAmountColumn] = useState("");
  const [descriptionColumn, setDescriptionColumn] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const selectedRows = useMemo(
    () => preview?.rows.filter((row) => row.selected).map((row) => row.rowIndex) ?? [],
    [preview],
  );

  const inspectFile = async () => {
    if (!file || !accountId) return;
    setBusy(true); setMessage(null); setPreview(null);
    try {
      const body = new FormData(); body.append("file", file);
      const response = await fetch(`/api/households/${householdId}/accounts/${accountId}/imports/inspect`, { method: "POST", body });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? t("errors.generic"));
      const result = json.data as Inspect;
      setInspect(result);
      setDateColumn(result.headers[0] ?? "");
      setAmountColumn(result.headers[1] ?? "");
      setDescriptionColumn(result.headers[2] ?? result.headers[1] ?? "");
    } catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : t("errors.generic") }); }
    finally { setBusy(false); }
  };

  const previewFile = async () => {
    if (!file || !accountId || !inspect) return;
    setBusy(true); setMessage(null);
    try {
      const body = new FormData(); body.append("file", file);
      body.append("mappingConfig", JSON.stringify({
        dateColumn, dateFormat: "auto", timezone: "UTC", amountMode: "signed", amountColumn,
        invertAmount: false, currencyMode: "account", descriptionColumn,
        delimiter: inspect.detectedDelimiter, hasHeader: true, headerRowIndex: 0, skipLeadingRows: 0,
      }));
      const response = await fetch(`/api/households/${householdId}/accounts/${accountId}/imports/preview`, { method: "POST", body });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? t("errors.generic"));
      setPreview(json.data as Preview);
    } catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : t("errors.generic") }); }
    finally { setBusy(false); }
  };

  const commit = async () => {
    if (!preview || !accountId) return;
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/households/${householdId}/accounts/${accountId}/imports/${preview.batchId}/commit`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ selectedRowIndices: selectedRows }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? t("errors.generic"));
      setMessage({ type: "success", text: t("success", { count: json.data.importedCount }) });
      setPreview(null);
    } catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : t("errors.generic") }); }
    finally { setBusy(false); }
  };

  const toggleRow = (rowIndex: number) => setPreview((current) => current ? ({ ...current, rows: current.rows.map((row) => row.rowIndex === rowIndex ? { ...row, selected: !row.selected } : row) }) : current);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div><h1 className="text-2xl font-semibold text-stone-100">{t("title")}</h1><p className="mt-1 text-sm text-stone-400">{t("description")}</p></div>
      {message && <div role="alert" className={message.type === "error" ? "rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-200" : "rounded-lg border border-emerald-800 bg-emerald-950/40 p-3 text-sm text-emerald-200"}>{message.text}</div>}
      <section className="rounded-2xl border border-stone-800 bg-stone-900/70 p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="flex flex-col gap-2 text-sm text-stone-300">{t("account")}<select value={accountId} onChange={(event) => { setAccountId(event.target.value); setInspect(null); setPreview(null); }} className="rounded-lg border border-stone-700 bg-stone-800 p-2 text-stone-100">{accounts.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.currency})</option>)}</select></label>
          <label className="flex flex-col gap-2 text-sm text-stone-300 md:col-span-2">{t("file")}<input type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="rounded-lg border border-stone-700 bg-stone-800 p-2 text-stone-100" /></label>
        </div>
        <button type="button" disabled={!file || !account || busy} onClick={inspectFile} className="mt-4 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-stone-950 disabled:opacity-50">{busy ? t("working") : t("inspect")}</button>
      </section>
      {inspect && <section className="rounded-2xl border border-stone-800 bg-stone-900/70 p-5"><h2 className="text-lg font-semibold text-stone-100">{t("mapping")}</h2><p className="mt-1 text-sm text-stone-400">{t("detected", { delimiter: inspect.detectedDelimiter, encoding: inspect.detectedEncoding, count: inspect.totalRowCount })}</p><div className="mt-4 grid gap-4 md:grid-cols-3">{([[t("date"), dateColumn, setDateColumn], [t("amount"), amountColumn, setAmountColumn], [t("descriptionColumn"), descriptionColumn, setDescriptionColumn]] as const).map(([label, value, setter]) => <label key={label} className="flex flex-col gap-2 text-sm text-stone-300">{label}<select value={value} onChange={(event) => setter(event.target.value)} className="rounded-lg border border-stone-700 bg-stone-800 p-2 text-stone-100">{inspect.headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>)}</div><button type="button" disabled={busy} onClick={previewFile} className="mt-4 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-stone-950 disabled:opacity-50">{t("preview")}</button></section>}
      {preview && <section className="rounded-2xl border border-stone-800 bg-stone-900/70 p-5"><div className="flex flex-wrap items-baseline justify-between gap-3"><div><h2 className="text-lg font-semibold text-stone-100">{t("review")}</h2><p className="text-sm text-stone-400">{t("counts", { total: preview.totalRowCount, valid: preview.validRowCount, invalid: preview.invalidRowCount, duplicates: preview.duplicateRowCount })}</p></div><button type="button" disabled={busy || selectedRows.length === 0} onClick={commit} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-stone-950 disabled:opacity-50">{t("commit", { count: selectedRows.length })}</button></div><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-stone-400"><tr><th className="p-2">{t("select")}</th><th className="p-2">{t("date")}</th><th className="p-2">{t("amount")}</th><th className="p-2">{t("descriptionColumn")}</th><th className="p-2">{t("status")}</th></tr></thead><tbody>{preview.rows.map((row) => <tr key={row.rowIndex} className="border-t border-stone-800"><td className="p-2"><input type="checkbox" checked={row.selected} disabled={!row.valid || row.status !== "pending" || Boolean(row.possibleMatch)} onChange={() => toggleRow(row.rowIndex)} /></td><td className="p-2 text-stone-300">{row.date ? new Date(row.date).toLocaleDateString() : "—"}</td><td className="p-2 font-mono text-stone-200">{row.formattedAmount ?? row.amountMinor ?? "—"}</td><td className="p-2 text-stone-300">{row.description ?? "—"}</td><td className="p-2 text-stone-400">{row.valid ? row.status : row.errorMessage ?? row.status}</td></tr>)}</tbody></table></div></section>}
    </main>
  );
}
