"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { SerializedHouseholdAccount } from "@/lib/accounts/serialization";
import type { StatementImportProfileDto } from "@/lib/statement-imports/service";

type Props = {
  householdId: string;
  accounts: SerializedHouseholdAccount[];
  initialAccountId?: string | undefined;
  initialProfiles?: StatementImportProfileDto[] | undefined;
};

type Inspect = {
  headers: string[];
  detectedDelimiter: string;
  detectedEncoding: string;
  totalRowCount: number;
  headerRowIndex: number;
  headerSignature: string;
  suggestedMapping: {
    dateColumn?: string;
    dateFallbackColumn?: string;
    amountColumn?: string;
    amountMode?: "signed" | "separate";
    debitColumn?: string;
    creditColumn?: string;
    descriptionColumn?: string;
    sourceAccountIdColumn?: string;
  };
  mappingConfidence: "high" | "medium" | "low";
};

type PreviewRow = {
  rowIndex: number;
  valid: boolean;
  status: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  date?: string | null;
  kind?: string | null;
  amountMinor?: string | null;
  currency?: string | null;
  formattedAmount?: string | null;
  description?: string | null;
  possibleMatch?: unknown;
  ambiguityState?: "unambiguous" | "ambiguous";
  bankPending?: boolean;
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
  autoCommitted?: {
    batchId: string;
    importedCount: number;
    skippedCount: number;
    committedTransactionIds: string[];
  };
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function localizedImportError(
  json: { code?: unknown; error?: unknown },
  translate: (key: string) => string,
): string {
  if (json.code === "IMPORT_MAPPING_INVALID") return translate("mappingInvalid");
  if (json.code === "CSV_PARSE_INVALID") return translate("parserInvalid");
  const errorCode = typeof json.code === "string" ? json.code : "";
  if (errorCode === "VALIDATION_ERROR" || errorCode === "IMPORT_MAPPING_VALIDATION") return translate("mappingInvalid");
  if (errorCode === "CSV_PARSE_INVALID") return translate("parserInvalid");
  return translate("errors.generic");
}

export function isImportRowSelectable(row: Pick<PreviewRow, "valid" | "status" | "possibleMatch" | "ambiguityState" | "bankPending">): boolean {
  return row.valid
    && row.status === "pending"
    && !row.possibleMatch
    && row.ambiguityState === "unambiguous"
    && !row.bankPending;
}

export function markAutoCommittedRows(preview: Preview): Preview {
  if (!preview.autoCommitted) return preview;
  return {
    ...preview,
    rows: preview.rows.map((row) =>
      row.selected ? { ...row, status: "imported", selected: false } : row,
    ),
  };
}

export function getImportRowStatusKey(row: Pick<PreviewRow, "status" | "ambiguityState">): string {
  return row.ambiguityState !== "unambiguous" ? "review" : row.status;
}

export function buildImportMappingConfig(input: {
  dateColumn: string;
  dateFallbackColumn?: string;
  descriptionColumn: string;
  amountMode: "signed" | "separate";
  amountColumn: string;
  debitColumn: string;
  creditColumn: string;
  mappingConfig?: Partial<StatementImportProfileDto["mappingConfig"]> | undefined;
  sourceAccountIdColumn?: string;
  inspect: Pick<Inspect, "suggestedMapping" | "detectedDelimiter" | "detectedEncoding" | "headerRowIndex" | "headerSignature">;
}) {
  return {
    ...input.mappingConfig,
    dateColumn: input.dateColumn,
    dateFallbackColumn: input.dateFallbackColumn ?? input.mappingConfig?.dateFallbackColumn ?? input.inspect.suggestedMapping.dateFallbackColumn,
    dateFormat: input.mappingConfig?.dateFormat ?? "auto",
    timezone: input.mappingConfig?.timezone ?? "UTC",
    amountMode: input.amountMode,
    ...(input.amountMode === "signed" ? { amountColumn: input.amountColumn } : { debitColumn: input.debitColumn, creditColumn: input.creditColumn }),
    invertAmount: input.mappingConfig?.invertAmount ?? false,
    currencyMode: input.mappingConfig?.currencyMode ?? "account",
    descriptionColumn: input.descriptionColumn,
    sourceAccountIdColumn: input.sourceAccountIdColumn ?? input.mappingConfig?.sourceAccountIdColumn ?? input.inspect.suggestedMapping.sourceAccountIdColumn,
    delimiter: input.mappingConfig?.delimiter ?? input.inspect.detectedDelimiter,
    hasHeader: input.mappingConfig?.hasHeader ?? true,
    headerRowIndex: input.mappingConfig?.headerRowIndex ?? input.inspect.headerRowIndex,
    skipLeadingRows: input.mappingConfig?.skipLeadingRows ?? input.inspect.headerRowIndex,
    encoding: input.mappingConfig?.encoding ?? input.inspect.detectedEncoding,
    headerSignature: input.mappingConfig?.headerSignature ?? input.inspect.headerSignature,
  };
}

export function ImportView({
  householdId,
  accounts,
  initialAccountId,
  initialProfiles = [],
}: Props) {
  const t = useTranslations("Imports");
  const locale = useLocale();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [accountId, setAccountId] = useState(
    initialAccountId ?? accounts[0]?.id ?? "",
  );
  const account = accounts.find((item) => item.id === accountId);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [inspect, setInspect] = useState<Inspect | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  // Mapping state
  const [dateColumn, setDateColumn] = useState("");
  const [amountColumn, setAmountColumn] = useState("");
  const [amountMode, setAmountMode] = useState<"signed" | "separate">("signed");
  const [debitColumn, setDebitColumn] = useState("");
  const [creditColumn, setCreditColumn] = useState("");
  const [descriptionColumn, setDescriptionColumn] = useState("");
  const [sourceAccountIdColumn, setSourceAccountIdColumn] = useState("");

  // Profiles state
  const [profiles, setProfiles] =
    useState<StatementImportProfileDto[]>(initialProfiles);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [showSaveProfileModal, setShowSaveProfileModal] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileIsDefault, setNewProfileIsDefault] = useState(false);
  const [newProfileAutoProcessSafe, setNewProfileAutoProcessSafe] =
    useState(false);

  // Safe Automatic Processing option
  const [autoProcessSafe, setAutoProcessSafe] = useState(false);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  const selectedRows = useMemo(
    () =>
      preview?.rows
        .filter((row) => row.selected)
        .map((row) => row.rowIndex) ?? [],
    [preview],
  );

  // Fetch profiles when account changes
  useEffect(() => {
    if (!householdId || !accountId) return;
    fetch(
      `/api/households/${householdId}/accounts/${accountId}/imports/profiles`,
    )
      .then((res) => res.json())
      .then((json) => {
        if (json.data && Array.isArray(json.data)) {
          setProfiles(json.data);
          const defaultProf = json.data.find(
            (p: StatementImportProfileDto) => p.isDefault,
          );
          if (defaultProf) {
            applyProfile(defaultProf);
          }
        }
      })
      .catch(() => {});
  }, [householdId, accountId]);

  const applyProfile = (p: StatementImportProfileDto, inspection = inspect) => {
    if (inspection && p.mappingConfig.headerSignature !== inspection.headerSignature) {
      setSelectedProfileId("");
      return;
    }
    setSelectedProfileId(p.id);
    if (p.mappingConfig.dateColumn) setDateColumn(p.mappingConfig.dateColumn);
    if (p.mappingConfig.amountColumn)
      setAmountColumn(p.mappingConfig.amountColumn);
    setAmountMode(p.mappingConfig.amountMode);
    setDebitColumn(p.mappingConfig.debitColumn ?? "");
    setCreditColumn(p.mappingConfig.creditColumn ?? "");
    if (p.mappingConfig.descriptionColumn)
      setDescriptionColumn(p.mappingConfig.descriptionColumn);
    setSourceAccountIdColumn(p.mappingConfig.sourceAccountIdColumn ?? "");
    setAutoProcessSafe(p.autoProcessSafe);
  };

  const handleProfileChange = (profileId: string) => {
    setSelectedProfileId(profileId);
    if (!profileId) {
      // Custom mapping: leave columns as detected
      return;
    }
    const found = profiles.find((p) => p.id === profileId);
    if (found) {
      applyProfile(found);
    }
  };

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
      if (!response.ok) throw new Error(localizedImportError(json, t));
      const result = json.data as Inspect;
      setInspect(result);

      // Apply a saved profile only for the exact discovered layout; otherwise use high-confidence suggestions.
      const activeProfile = profiles.find((p) => p.id === selectedProfileId);
      if (activeProfile && activeProfile.mappingConfig.headerSignature === result.headerSignature) {
        applyProfile(activeProfile, result);
      } else if (result.mappingConfidence === "high") {
        setSelectedProfileId("");
        setDateColumn(result.suggestedMapping.dateColumn ?? "");
        setAmountMode(result.suggestedMapping.amountMode ?? "signed");
        setAmountColumn(result.suggestedMapping.amountColumn ?? "");
        setDebitColumn(result.suggestedMapping.debitColumn ?? "");
        setCreditColumn(result.suggestedMapping.creditColumn ?? "");
        setDescriptionColumn(result.suggestedMapping.descriptionColumn ?? "");
        setSourceAccountIdColumn(result.suggestedMapping.sourceAccountIdColumn ?? "");
      } else {
        setSelectedProfileId("");
        setDateColumn("");
        setAmountColumn("");
        setDescriptionColumn("");
        setSourceAccountIdColumn("");
      }
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
        JSON.stringify(buildImportMappingConfig({
          dateColumn,
          descriptionColumn,
          sourceAccountIdColumn,
          amountMode,
          amountColumn,
          debitColumn,
          creditColumn,
          mappingConfig: profiles.find((p) => p.id === selectedProfileId)?.mappingConfig,
          inspect,
        })),
      );
      if (autoProcessSafe) {
        body.append("autoProcessSafe", "true");
      }
      body.append("locale", locale);

      const response = await fetch(
        `/api/households/${householdId}/accounts/${accountId}/imports/preview`,
        { method: "POST", body },
      );
      const json = await response.json();
      if (!response.ok) throw new Error(localizedImportError(json, t));
      const prevData = json.data as Preview;
      setPreview(markAutoCommittedRows(prevData));

      if (prevData.autoCommitted) {
        if (prevData.attentionRowCount === 0) {
          setMessage({
            type: "success",
            text: t("allRowsSafeCommitted", {
              count: prevData.autoCommitted.importedCount,
            }),
          });
        } else {
          setMessage({
            type: "success",
            text: t("autoCommittedSuccess", {
              count: prevData.autoCommitted.importedCount,
              attention: prevData.attentionRowCount,
            }),
          });
        }
      }
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
      if (!response.ok) throw new Error(localizedImportError(json, t));
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

  const commitSafeOnly = async () => {
    if (!preview || !accountId) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/households/${householdId}/accounts/${accountId}/imports/${preview.batchId}/commit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ safeOnly: true }),
        },
      );
      const json = await response.json();
      if (!response.ok) throw new Error(localizedImportError(json, t));
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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim() || !accountId || !inspect) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/households/${householdId}/accounts/${accountId}/imports/profiles`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newProfileName.trim(),
            mappingConfig: buildImportMappingConfig({
              dateColumn,
              descriptionColumn,
              sourceAccountIdColumn,
              amountMode,
              amountColumn,
              debitColumn,
              creditColumn,
              mappingConfig: profiles.find((p) => p.id === selectedProfileId)?.mappingConfig,
              inspect,
            }),
            autoProcessSafe: newProfileAutoProcessSafe,
            isDefault: newProfileIsDefault,
            accountId,
          }),
        },
      );
      const json = await response.json();
      if (!response.ok) throw new Error(localizedImportError(json, t));
      const savedProfile = json.data as StatementImportProfileDto;
      setProfiles((prev) => [
        savedProfile,
        ...prev.filter((p) => p.id !== savedProfile.id),
      ]);
      setSelectedProfileId(savedProfile.id);
      setAutoProcessSafe(savedProfile.autoProcessSafe);
      setShowSaveProfileModal(false);
      setNewProfileName("");
      setMessage({ type: "success", text: t("profileSaved") });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : t("errors.generic"),
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteProfile = async () => {
    if (!selectedProfileId || !accountId) return;
    if (!window.confirm(t("deleteProfileConfirm"))) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/households/${householdId}/accounts/${accountId}/imports/profiles/${selectedProfileId}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const json = await response.json();
        throw new Error(localizedImportError(json, t));
      }
      setProfiles((prev) => prev.filter((p) => p.id !== selectedProfileId));
      setSelectedProfileId("");
      setMessage({ type: "success", text: t("profileDeleted") });
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
              row.rowIndex === rowIndex
                ? { ...row, selected: !row.selected }
                : row,
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
            aria-label={t("dismissMessage")}
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

      {/* Step 2: Column Mapping & Profiles */}
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

          {/* Mapping Profiles Selector Bar */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-stone-800 dark:bg-stone-900/30">
            <div className="flex flex-1 items-center gap-2.5 min-w-[240px]">
              <label
                htmlFor="mapping-profile-select"
                className="text-xs font-semibold text-slate-700 dark:text-stone-300 shrink-0"
              >
                {t("profiles")}:
              </label>
              <select
                id="mapping-profile-select"
                value={selectedProfileId}
                onChange={(e) => handleProfileChange(e.target.value)}
                className="w-full max-w-xs rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 shadow-xs focus:border-emerald-500 focus:outline-none dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
              >
                <option value="">{t("customMapping")}</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.isDefault ? ` (${t("defaultProfileBadge")})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                id="save-profile-btn"
                onClick={() => setShowSaveProfileModal(true)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
              >
                {t("saveProfile")}
              </button>

              {selectedProfileId && (
                <button
                  type="button"
                  id="delete-profile-btn"
                  onClick={handleDeleteProfile}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 shadow-xs hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300 dark:hover:bg-rose-900/60"
                >
                  {t("deleteProfile")}
                </button>
              )}
            </div>
          </div>

          {/* Columns Config */}
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 dark:text-stone-300">
              {t("amountMode")}
              <select value={amountMode} onChange={(event) => setAmountMode(event.target.value as "signed" | "separate")} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100">
                <option value="signed">{t("signedAmount")}</option>
                <option value="separate">{t("separateAmount")}</option>
              </select>
            </label>
            {(
              [
                [t("date"), dateColumn, setDateColumn],
                ...(amountMode === "signed" ? [[t("amount"), amountColumn, setAmountColumn] as const] : []),
                [t("descriptionColumn"), descriptionColumn, setDescriptionColumn],
                [t("sourceAccountIdColumn"), sourceAccountIdColumn, setSourceAccountIdColumn],
                ...(amountMode === "separate" ? [
                  [t("debit"), debitColumn, setDebitColumn] as const,
                  [t("credit"), creditColumn, setCreditColumn] as const,
                ] : []),
              ] as const
            ).map(([label, value, setter]) => (
              <label
                key={label}
                className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 dark:text-stone-300"
              >
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

          {/* Safe Automatic Processing Option */}
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-stone-800 dark:bg-stone-900/40">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                id="auto-process-safe-checkbox"
                checked={autoProcessSafe}
                onChange={(e) => setAutoProcessSafe(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-stone-700 dark:bg-stone-900"
              />
              <div>
                <span className="text-xs font-semibold text-slate-900 dark:text-stone-100">
                  {t("autoProcessSafeCheckbox")}
                </span>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-stone-400 leading-relaxed">
                  {t("autoProcessSafeHint")}
                </p>
              </div>
            </label>
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

            <div className="flex items-center gap-2">
              {/* Safe Only Action */}
              {preview.safeToCommitCount > 0 && !preview.autoCommitted && (
                <button
                  type="button"
                  id="commit-safe-only-btn"
                  disabled={busy}
                  onClick={commitSafeOnly}
                  className="rounded-lg border border-emerald-600 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 shadow-xs transition hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 dark:border-emerald-500/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/70"
                >
                  {busy
                    ? t("working")
                    : t("commitSafeOnly", { count: preview.safeToCommitCount })}
                </button>
              )}

              {/* Standard Review Commit */}
              <button
                type="button"
                id="commit-selected-btn"
                disabled={busy || selectedRows.length === 0}
                onClick={commit}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 dark:bg-emerald-500 dark:text-stone-950 dark:hover:bg-emerald-400"
              >
                {busy
                  ? t("working")
                  : t("commit", { count: selectedRows.length })}
              </button>
            </div>
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
                  const isPending = isImportRowSelectable(row);
                  const rowNeedsReview = row.ambiguityState !== "unambiguous" || row.bankPending;
                  const localizedErrorCodes = [
                    "MISSING_DATE", "INVALID_DATE", "MISSING_AMOUNT", "INVALID_AMOUNT",
                    "INVALID_CURRENCY", "CURRENCY_MISMATCH", "AMBIGUOUS_AMOUNT", "DUPLICATE_ROW",
                    "MATCHES_VOIDED_TRANSACTION", "AUTHORITATIVE_DUPLICATE",
                    "DUPLICATE_AUTHORITATIVE_ID_IN_FILE", "FALLBACK_DUPLICATE",
                    "AMBIGUOUS_AUTHORITATIVE_MATCH", "AMBIGUOUS_FALLBACK_MATCH", "BANK_PENDING",
                  ];
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
                        {row.date
                          ? new Intl.DateTimeFormat(locale).format(new Date(row.date))
                          : "—"}
                      </td>
                      <td className="p-3 font-mono text-xs font-semibold text-slate-900 dark:text-stone-100">
                        {row.formattedAmount ?? "—"}
                      </td>
                      <td className="p-3 text-xs text-slate-700 dark:text-stone-300 max-w-xs truncate">
                        {row.description ?? "—"}
                      </td>
                      <td className="p-3 text-xs">
                        {!row.valid ? (
                          <span className="inline-flex items-center rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
                            {row.errorCode && ["MISSING_DATE", "INVALID_DATE", "MISSING_AMOUNT", "INVALID_AMOUNT", "INVALID_CURRENCY", "CURRENCY_MISMATCH", "AMBIGUOUS_AMOUNT", "DUPLICATE_ROW", "MATCHES_VOIDED_TRANSACTION", "AUTHORITATIVE_DUPLICATE", "DUPLICATE_AUTHORITATIVE_ID_IN_FILE", "FALLBACK_DUPLICATE", "BANK_PENDING"].includes(row.errorCode) ? t(`rowErrors.${row.errorCode}`) : t("rowErrors.GENERIC")}
                          </span>
                        ) : rowNeedsReview ? (
                          <span className="inline-flex items-center rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
                            {row.errorCode && localizedErrorCodes.includes(row.errorCode)
                              ? t(`rowErrors.${row.errorCode}`)
                              : t(`statuses.${getImportRowStatusKey(row)}`)}
                          </span>
                        ) : row.status === "duplicate" || row.possibleMatch ? (
                          <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
                            {t(`statuses.${row.status}`)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
                            {t(`statuses.${row.status}`)}
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

      {/* Modal: Save Mapping Profile */}
      {showSaveProfileModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-profile-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-stone-800 dark:bg-stone-900">
            <h3
              id="save-profile-dialog-title"
              className="text-base font-semibold text-slate-900 dark:text-stone-100"
            >
              {t("saveProfile")}
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-stone-400">
              {t("description")}
            </p>

            <form onSubmit={handleSaveProfile} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="save-profile-name"
                  className="block text-xs font-medium text-slate-700 dark:text-stone-300"
                >
                  {t("profileName")}
                </label>
                <input
                  type="text"
                  id="save-profile-name"
                  required
                  maxLength={160}
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  placeholder={t("profileNamePlaceholder")}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    id="save-profile-default"
                    checked={newProfileIsDefault}
                    onChange={(e) => setNewProfileIsDefault(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-stone-700 dark:bg-stone-900"
                  />
                  <span>{t("defaultProfileBadge")}</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    id="save-profile-auto-safe"
                    checked={newProfileAutoProcessSafe}
                    onChange={(e) =>
                      setNewProfileAutoProcessSafe(e.target.checked)
                    }
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-stone-700 dark:bg-stone-900"
                  />
                  <span>{t("autoProcessSafeCheckbox")}</span>
                </label>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowSaveProfileModal(false)}
                  className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={busy || !newProfileName.trim()}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 dark:bg-emerald-500 dark:text-stone-950 dark:hover:bg-emerald-400"
                >
                  {busy ? t("savingProfile") : t("saveProfileButton")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
