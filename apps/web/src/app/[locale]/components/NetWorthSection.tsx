"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Info, Scale } from "lucide-react";
import type { SerializedNetWorthSummary } from "@/lib/net-worth/serialization";
import { formatAmountPresentation } from "@/lib/transactions/presentation";
import { StatusBadge } from "./ui";
import { NetWorthChart } from "./NetWorthChart";

type Props = {
  summary: SerializedNetWorthSummary;
  locale: string;
  labels: {
    title: string;
    eyebrow: string;
    viewDetails: string;
    assets: string;
    liabilities: string;
    netWorth: string;
    complete: string;
    incomplete: string;
    missing: string;
    explanation: string;
    emptyTitle: string;
    emptyDescription: string;
    recordObservation: string;
  };
};

export function NetWorthSection({ summary, locale, labels }: Props) {
  const currencies = summary.byCurrency;
  const [selectedCurrency, setSelectedCurrency] = useState<string>(
    currencies[0]?.currency ?? "PLN",
  );

  const activeSeries =
    currencies.find((c) => c.currency === selectedCurrency) ?? currencies[0];

  const hasAnyData = currencies.some((c) => c.currentConfidence !== "no_data");

  return (
    <section
      aria-labelledby="net-worth-section-title"
      className="finance-card p-6 flex flex-col gap-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="finance-icon-box" aria-hidden="true">
              <Scale size={18} strokeWidth={2} />
            </span>
            <p className="finance-eyebrow">{labels.eyebrow}</p>
          </div>
          <h2 id="net-worth-section-title" className="finance-section-title mt-1">
            {labels.title}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {currencies.length > 1 ? (
            <div
              className="flex rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-1"
              role="tablist"
              aria-label="Currency"
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

          <Link
            href={`/${locale}/net-worth`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
          >
            <span>{labels.viewDetails}</span>
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* Honest Calculation Explanation */}
      <div className="flex items-start gap-3 rounded-xl bg-[var(--surface-muted)] p-3 text-xs text-[var(--muted-foreground)]">
        <Info size={16} className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
        <p className="leading-relaxed">{labels.explanation}</p>
      </div>

      {!hasAnyData || !activeSeries ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] p-8 text-center">
          <p className="text-base font-semibold text-[var(--foreground)]">
            {labels.emptyTitle}
          </p>
          <p className="mt-1 max-w-md text-sm text-[var(--muted-foreground)]">
            {labels.emptyDescription}
          </p>
          <Link
            href={`/${locale}/net-worth`}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--foreground)] px-4 py-2 text-sm font-semibold text-[var(--surface)] transition hover:opacity-90"
          >
            {labels.recordObservation}
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
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
              <p className="mt-2 font-mono text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
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

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                {labels.assets}
              </p>
              <p className="mt-2 font-mono text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 sm:text-3xl">
                {formatAmountPresentation(
                  activeSeries.currentAssetsMinor,
                  activeSeries.currency,
                  locale,
                )}
              </p>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                {labels.liabilities}
              </p>
              <p className="mt-2 font-mono text-2xl font-bold tracking-tight text-slate-700 dark:text-stone-300 sm:text-3xl">
                {formatAmountPresentation(
                  activeSeries.currentLiabilitiesMinor,
                  activeSeries.currency,
                  locale,
                )}
              </p>
            </div>
          </div>

          {/* Historical Series Chart */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
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
          </div>
        </div>
      )}
    </section>
  );
}
