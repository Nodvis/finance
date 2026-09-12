"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coins,
  History,
  Info,
  Plus,
  Scale,
} from "lucide-react";
import type {
  SerializedBalanceObservation,
  SerializedNetWorthSummary,
} from "@/lib/net-worth/serialization";
import type { HouseholdAccountSummary } from "@nodvis/finance-db";
import { formatAmountPresentation } from "@/lib/transactions/presentation";
import { NetWorthChart } from "../components/NetWorthChart";
import { StatusBadge } from "../components/ui";

type Props = {
  householdId: string;
  summary: SerializedNetWorthSummary;
  accounts: HouseholdAccountSummary[];
  liabilities: Array<{ id: string; name: string; kind: string; currency: string }>;
  observations: SerializedBalanceObservation[];
  locale: string;
  labels: {
    title: string;
    subtitle: string;
    netWorth: string;
    assets: string;
    liabilities: string;
    complete: string;
    incomplete: string;
    missing: string;
    explanation: string;
    explanationDetails: string;
    emptyTitle: string;
    emptyDescription: string;
    recordObservation: string;
    historyTitle: string;
    colDate: string;
    colSubject: string;
    colBalance: string;
    colSource: string;
    colNote: string;
    formTitle: string;
    selectSubject: string;
    selectTarget: string;
    amountPlaceholder: string;
    amountLabel: string;
    dateLabel: string;
    noteLabel: string;
    notePlaceholder: string;
    cancelButton: string;
    saveButton: string;
    savingButton: string;
    subjectAccount: string;
    subjectLiability: string;
    successMessage: string;
    sourceManual: string;
    sourceImported: string;
    sourceReconciled: string;
    sourceLegacy: string;
  };
};

export function NetWorthView({
  householdId,
  summary,
  accounts,
  liabilities,
  observations,
  locale,
  labels,
}: Props) {
  const router = useRouter();
  const currencies = summary.byCurrency;
  const [selectedCurrency, setSelectedCurrency] = useState<string>(
    currencies[0]?.currency ?? "PLN",
  );

  const [formOpen, setFormOpen] = useState(false);
  const [subjectType, setSubjectType] = useState<"account" | "liability">("account");
  const [subjectId, setSubjectId] = useState<string>(accounts[0]?.id ?? "");
  const [amountNatural, setAmountNatural] = useState<string>("");
  const [observedAt, setObservedAt] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [note, setNote] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const activeSeries =
    currencies.find((c) => c.currency === selectedCurrency) ?? currencies[0];

  const handleSubjectTypeChange = (type: "account" | "liability") => {
    setSubjectType(type);
    if (type === "account") {
      setSubjectId(accounts[0]?.id ?? "");
    } else {
      setSubjectId(liabilities[0]?.id ?? "");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const res = await fetch(
        `/api/households/${householdId}/balance-observations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subjectType,
            subjectId,
            amountNatural,
            observedAt: `${observedAt}T12:00:00.000Z`,
            note: note.trim() || undefined,
          }),
        },
      );

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to save observation");
      }

      setSuccessMessage(labels.successMessage);
      setAmountNatural("");
      setNote("");
      setFormOpen(false);
      router.refresh();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border)] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="finance-icon-box" aria-hidden="true">
              <Scale size={20} strokeWidth={2} />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
              {labels.title}
            </h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-[var(--muted-foreground)]">
            {labels.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {currencies.length > 1 ? (
            <div
              className="flex rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-1"
              role="tablist"
              aria-label="Currencies"
            >
              {currencies.map((c) => (
                <button
                  key={c.currency}
                  type="button"
                  role="tab"
                  aria-selected={c.currency === selectedCurrency}
                  onClick={() => setSelectedCurrency(c.currency)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    c.currency === selectedCurrency
                      ? "bg-[var(--foreground)] text-[var(--surface)] shadow-xs"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {c.currency}
                </button>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setFormOpen((open) => !open)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--foreground)] px-4 py-2 text-xs font-semibold text-[var(--surface)] transition hover:opacity-90"
          >
            <Plus size={16} aria-hidden="true" />
            <span>{labels.recordObservation}</span>
          </button>
        </div>
      </div>

      {/* Record Observation Form (Collapsible) */}
      {formOpen ? (
        <section
          aria-labelledby="record-observation-heading"
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
            <h2 id="record-observation-heading" className="text-base font-semibold text-[var(--foreground)]">
              {labels.formTitle}
            </h2>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4 max-w-xl">
            {errorMessage ? (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                <AlertCircle size={16} className="shrink-0" />
                <span>{errorMessage}</span>
              </div>
            ) : null}

            {successMessage ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>{successMessage}</span>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-xs font-medium text-[var(--foreground)]">
                <span>{labels.selectSubject}</span>
                <select
                  value={subjectType}
                  onChange={(e) => handleSubjectTypeChange(e.target.value as "account" | "liability")}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                >
                  <option value="account">{labels.subjectAccount}</option>
                  <option value="liability">{labels.subjectLiability}</option>
                </select>
              </label>

              <label className="flex flex-col gap-1.5 text-xs font-medium text-[var(--foreground)]">
                <span>{labels.selectTarget}</span>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                  required
                >
                  {subjectType === "account"
                    ? accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.currency})
                        </option>
                      ))
                    : liabilities.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name} ({l.currency})
                        </option>
                      ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-xs font-medium text-[var(--foreground)]">
                <span>{labels.amountLabel}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amountNatural}
                  onChange={(e) => setAmountNatural(e.target.value)}
                  placeholder={labels.amountPlaceholder}
                  required
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-sm text-[var(--foreground)]"
                />
              </label>

              <label className="flex flex-col gap-1.5 text-xs font-medium text-[var(--foreground)]">
                <span>{labels.dateLabel}</span>
                <input
                  type="date"
                  value={observedAt}
                  onChange={(e) => setObservedAt(e.target.value)}
                  required
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1.5 text-xs font-medium text-[var(--foreground)]">
              <span>{labels.noteLabel}</span>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={280}
                placeholder={labels.notePlaceholder}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              />
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-xs font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                {labels.cancelButton}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-[var(--foreground)] px-5 py-2 text-xs font-semibold text-[var(--surface)] transition hover:opacity-90 disabled:opacity-50"
              >
                {isSubmitting ? labels.savingButton : labels.saveButton}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {/* Honest Calculation Invariant Details */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-5">
        <div className="flex items-start gap-3">
          <Info size={18} className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
          <div className="space-y-1 text-xs text-[var(--muted-foreground)]">
            <p className="font-semibold text-[var(--foreground)]">
              {labels.explanation}
            </p>
            <p className="leading-relaxed">
              {labels.explanationDetails}
            </p>
          </div>
        </div>
      </div>

      {activeSeries ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="finance-card p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  {labels.netWorth} ({activeSeries.currency})
                </p>
                <StatusBadge
                  tone={activeSeries.currentIsComplete ? "positive" : "warning"}
                >
                  {activeSeries.currentIsComplete ? labels.complete : labels.incomplete}
                </StatusBadge>
              </div>
              <p className="mt-3 font-mono text-3xl font-bold tracking-tight text-[var(--foreground)]">
                {formatAmountPresentation(
                  activeSeries.currentNetWorthMinor,
                  activeSeries.currency,
                  locale,
                )}
              </p>
              {!activeSeries.currentIsComplete && activeSeries.missingSubjectNames.length > 0 ? (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  {labels.missing}: {activeSeries.missingSubjectNames.join(", ")}
                </p>
              ) : null}
            </div>

            <div className="finance-card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                {labels.assets}
              </p>
              <p className="mt-3 font-mono text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {formatAmountPresentation(
                  activeSeries.currentAssetsMinor,
                  activeSeries.currency,
                  locale,
                )}
              </p>
            </div>

            <div className="finance-card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                {labels.liabilities}
              </p>
              <p className="mt-3 font-mono text-3xl font-bold tracking-tight text-slate-700 dark:text-stone-300">
                {formatAmountPresentation(
                  activeSeries.currentLiabilitiesMinor,
                  activeSeries.currency,
                  locale,
                )}
              </p>
            </div>
          </div>

          {/* Historical Chart */}
          <section
            aria-label={`${labels.title} (${activeSeries.currency})`}
            className="finance-card p-6"
          >
            <div className="mb-4">
              <h2 className="finance-section-title">
                {labels.title} ({activeSeries.currency})
              </h2>
            </div>
            <NetWorthChart
              series={activeSeries}
              locale={locale}
              labels={{
                netWorth: labels.netWorth,
                assets: labels.assets,
                liabilities: labels.liabilities,
                complete: labels.complete,
                incomplete: labels.incomplete,
                missing: labels.missing,
                empty: labels.emptyTitle,
              }}
            />
          </section>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] p-12 text-center">
          <Scale size={36} className="text-[var(--muted-foreground)] mb-3" />
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            {labels.emptyTitle}
          </h2>
          <p className="mt-1 max-w-md text-sm text-[var(--muted-foreground)]">
            {labels.emptyDescription}
          </p>
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="mt-4 rounded-xl bg-[var(--foreground)] px-4 py-2 text-sm font-semibold text-[var(--surface)] transition hover:opacity-90"
          >
            {labels.recordObservation}
          </button>
        </div>
      )}

      {/* Balance History Table */}
      <section
        aria-labelledby="balance-history-heading"
        className="finance-card p-6"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4 mb-4">
          <div className="flex items-center gap-2">
            <History size={18} className="text-slate-500" />
            <h2 id="balance-history-heading" className="finance-section-title">
              {labels.historyTitle}
            </h2>
          </div>
          <span className="text-xs text-[var(--muted-foreground)]">
            {observations.length} {labels.historyTitle.toLowerCase()}
          </span>
        </div>

        {observations.length === 0 ? (
          <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">
            {labels.emptyDescription}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                <tr>
                  <th scope="col" className="pb-3 pr-4 font-semibold">{labels.colDate}</th>
                  <th scope="col" className="pb-3 px-4 font-semibold">{labels.colSubject}</th>
                  <th scope="col" className="pb-3 px-4 text-right font-semibold">{labels.colBalance}</th>
                  <th scope="col" className="pb-3 px-4 font-semibold">{labels.colSource}</th>
                  <th scope="col" className="pb-3 pl-4 font-semibold">{labels.colNote}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] font-normal text-[var(--foreground)]">
                {observations.map((obs) => (
                  <tr key={obs.id} className="hover:bg-[var(--surface-muted)] transition-colors">
                    <td className="py-3.5 pr-4 whitespace-nowrap text-xs text-[var(--muted-foreground)]">
                      {obs.observedAt.slice(0, 10)}
                    </td>
                    <td className="py-3.5 px-4 font-medium">
                      <div className="flex items-center gap-2">
                        <span>{obs.subjectName ?? "—"}</span>
                        <span className="text-[10px] rounded px-1.5 py-0.5 bg-[var(--surface-muted)] text-[var(--muted-foreground)] uppercase">
                          {obs.subjectKind === "account" ? (obs.accountType ?? "account") : "liability"}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold whitespace-nowrap">
                      {formatAmountPresentation(obs.amountMinor, obs.currency, locale)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-[var(--surface-muted)] text-[var(--muted-foreground)]">
                        {obs.source === "manual"
                          ? labels.sourceManual
                          : obs.source === "imported"
                          ? labels.sourceImported
                          : obs.source === "reconciled"
                          ? labels.sourceReconciled
                          : labels.sourceLegacy}
                      </span>
                    </td>
                    <td className="py-3.5 pl-4 text-xs text-[var(--muted-foreground)] max-w-xs truncate">
                      {obs.note ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
