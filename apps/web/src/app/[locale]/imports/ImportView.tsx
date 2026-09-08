"use client";

import { useMemo, useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
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
  safeToCommitCount: number;
  attentionRowCount: number;
  rows: PreviewRow[];
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImportView({ householdId, accounts, initialAccountId }: Props) {
  const t = useTranslations("Imports");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [accountId, setAccountId] = useState(initialAccountId ?? accounts[0]?.id ?? "");
  const account = accounts.find((item) => item.id === accountId);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
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
    setBusy(true);
    setMessage(null);
    setPreview(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(
        `/api/households/${householdId}/accounts/${accountId}/imports/inspect`,
        { method: "POST", body },
      );
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? t("errors.generic"));
      const result = json.data as Inspect;
      setInspect(result);
      setDateColumn(result.headers[0] ?? "");
      setAmountColumn(result.headers[1] ?? "");
      setDescriptionColumn(result.headers[2] ?? result.headers[1] ?? "");
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : t("errors.generic"),
      });
    } finally {
      setBusy(false);
    }
  };

  const previewFile = async () => {
    if (!file || !accountId || !inspect) return;
    setBusy(true);
    setMessage(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append(
        "mappingConfig",
        JSON.stringify({
          dateColumn,
          dateFormat: "auto",
          timezone: "UTC",
          amountMode: "signed",
          amountColumn,
          invertAmount: false,
          currencyMode: "account",
          descriptionColumn,
          delimiter: inspect.detectedDelimiter,
          hasHeader: true,
          headerRowIndex: 0,
          skipLeadingRows: 0,
        }),
      );
      const response = await fetch(
        `/api/households/${householdId}/accounts/${accountId}/imports/preview`,
        { method: "POST", body },
      );
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? t("errors.generic"));
      setPreview(json.data as Preview);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : t("errors.generic"),
      });
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!preview || !accountId) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/households/${householdId}/accounts/${accountId}/imports/${preview.batchId}/commit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selectedRowIndices: selectedRows }),
        },
      );
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? t("errors.generic"));
      setMessage({
        type: "success",
        text: t("success", { count: json.data.importedCount }),
      });
      setPreview(null);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : t("errors.generic"),
      });
    } finally {
      setBusy(false);
    }
  };

  const toggleRow = (rowIndex: number) =>
    setPreview((current) =>
      current
        ? {
            ...current,
            rows: current.rows.map((row) =>
              row.rowIndex === rowIndex ? { ...row, selected: !row.selected } : row,
            ),
          }
        : current,
    );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      setFile(droppedFile);
      setInspect(null);
      setPreview(null);
    }
  };

  if (accounts.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            CSV
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-stone-100 sm:text-3xl">
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-stone-400">
            {t("description")}
          </p>
        </div>

        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center dark:border-stone-800 dark:bg-stone-900/30">
          <h2 className="text-base font-semibold text-slate-900 dark:text-stone-200">
            {t("noAccountsTitle")}
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-stone-400 max-w-md mx-auto">
            {t("noAccountsDescription")}
          </p>
          <Link
            href="/accounts"
            className="mt-5 inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-500 focus:outline-none dark:bg-emerald-500 dark:text-stone-950 dark:hover:bg-emerald-400"
          >
            {t("createAccountAction")}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          CSV
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-stone-100 sm:text-3xl">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-stone-400">
          {t("description")}
        </p>
      </div>

      {/* Status / Alert Message */}
      {message && (
        <div
          role="alert"
          className={`flex items-center justify-between rounded-lg border p-3 text-sm ${
            message.type === "error"
              ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/80 dark:bg-rose-950/60 dark:text-rose-200"
              : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/80 dark:bg-emerald-950/60 dark:text-emerald-200"
          }`}
        >
          <span>{message.text}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="ml-4 text-xs font-semibold hover:opacity-75 focus:outline-none"
            aria-label="Dismiss message"
          >
            ✕
          </button>
        </div>
      )}

      {/* Step 1: Upload Landing / File Selection */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-stone-800 dark:bg-stone-900/60">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600 dark:text-stone-300 mb-4">
          1. {t("file")}
        </h2>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Target Account Selector */}
          <div>
            <label
              htmlFor="target-account-select"
              className="block text-sm font-medium text-slate-700 dark:text-stone-300"
            >
              {t("account")}
            </label>
            <select
              id="target-account-select"
              value={accountId}
              onChange={(event) => {
                setAccountId(event.target.value);
                setInspect(null);
                setPreview(null);
              }}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
            >
              {accounts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.currency})
                </option>
              ))}
            </select>
          </div>

          {/* Drag & Drop File Zone */}
          <div className="md:col-span-2">
            <span className="block text-sm font-medium text-slate-700 dark:text-stone-300 mb-1">
              {t("file")}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setInspect(null);
                setPreview(null);
              }}
              className="hidden"
            />

            {!file ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? "border-emerald-500 bg-emerald-50/50 dark:border-emerald-400 dark:bg-emerald-950/20"
                    : "border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50 dark:border-stone-700 dark:bg-stone-900/30 dark:hover:border-stone-600"
                }`}
              >
                <svg
                  className="h-8 w-8 text-slate-400 dark:text-stone-500 mb-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                  />
                </svg>
                <p className="text-xs text-slate-600 dark:text-stone-300">
                  {t("dropzoneHint")}
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-stone-800 dark:bg-stone-900/50">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                    <span className="text-xs font-bold uppercase">CSV</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-stone-100">
                      {file.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-stone-400">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setInspect(null);
                    setPreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
                >
                  {t("resetFile")}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            disabled={!file || !account || busy}
            onClick={inspectFile}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 dark:bg-emerald-500 dark:text-stone-950 dark:hover:bg-emerald-400"
          >
            {busy ? t("working") : t("inspect")}
          </button>
        </div>
      </section>

      {/* Step 2: Column Mapping */}
      {inspect && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-stone-800 dark:bg-stone-900/60">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-3 dark:border-stone-800">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600 dark:text-stone-300">
              2. {t("mapping")}
            </h2>
            <span className="text-xs text-slate-500 dark:text-stone-400 font-mono">
              {t("detected", {
                delimiter: inspect.detectedDelimiter,
                encoding: inspect.detectedEncoding,
                count: inspect.totalRowCount,
              })}
            </span>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {(
              [
                [t("date"), dateColumn, setDateColumn],
                [t("amount"), amountColumn, setAmountColumn],
                [t("descriptionColumn"), descriptionColumn, setDescriptionColumn],
              ] as const
            ).map(([label, value, setter]) => (
              <label key={label} className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 dark:text-stone-300">
                {label}
                <select
                  value={value}
                  onChange={(event) => setter(event.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
                >
                  {inspect.headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={previewFile}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 dark:bg-emerald-500 dark:text-stone-950 dark:hover:bg-emerald-400"
            >
              {busy ? t("working") : t("preview")}
            </button>
          </div>
        </section>
      )}

      {/* Step 3: Review & Commit */}
      {preview && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-stone-800 dark:bg-stone-900/60">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-stone-800">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600 dark:text-stone-300">
                3. {t("review")}
              </h2>
              <p className="text-xs text-slate-500 dark:text-stone-400 mt-1">
                {t("counts", {
                  total: preview.totalRowCount,
                  valid: preview.validRowCount,
                  invalid: preview.invalidRowCount,
                  duplicates: preview.duplicateRowCount,
                })}
              </p>
              <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                {t("automaticSummary", {
                  safe: preview.safeToCommitCount,
                  attention: preview.attentionRowCount,
                })}
              </p>
            </div>

            <button
              type="button"
              disabled={busy || selectedRows.length === 0}
              onClick={commit}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 dark:bg-emerald-500 dark:text-stone-950 dark:hover:bg-emerald-400"
            >
              {busy ? t("working") : t("commit", { count: selectedRows.length })}
            </button>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-stone-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:border-stone-800 dark:bg-stone-900/80 dark:text-stone-400">
                <tr>
                  <th className="p-3 w-12 text-center">{t("select")}</th>
                  <th className="p-3">{t("date")}</th>
                  <th className="p-3">{t("amount")}</th>
                  <th className="p-3">{t("descriptionColumn")}</th>
                  <th className="p-3">{t("status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-stone-800">
                {preview.rows.map((row) => {
                  const isPending = row.valid && row.status === "pending" && !row.possibleMatch;
                  return (
                    <tr
                      key={row.rowIndex}
                      className={`transition-colors ${
                        row.selected
                          ? "bg-emerald-50/30 dark:bg-emerald-950/15"
                          : "hover:bg-slate-50/60 dark:hover:bg-stone-800/40"
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          disabled={!isPending}
                          onChange={() => toggleRow(row.rowIndex)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-stone-700 dark:bg-stone-900"
                        />
                      </td>
                      <td className="p-3 text-xs text-slate-700 dark:text-stone-300">
                        {row.date ? new Date(row.date).toLocaleDateString() : "—"}
                      </td>
                      <td className="p-3 font-mono text-xs font-semibold text-slate-900 dark:text-stone-100">
                        {row.formattedAmount ?? row.amountMinor ?? "—"}
                      </td>
                      <td className="p-3 text-xs text-slate-700 dark:text-stone-300 max-w-xs truncate">
                        {row.description ?? "—"}
                      </td>
                      <td className="p-3 text-xs">
                        {!row.valid ? (
                          <span className="inline-flex items-center rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
                            {row.errorMessage ?? row.status}
                          </span>
                        ) : row.status === "duplicate" || row.possibleMatch ? (
                          <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
                            {row.status}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
                            {row.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
