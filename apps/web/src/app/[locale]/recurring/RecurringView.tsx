"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { formatAmountPresentation } from "@/lib/transactions/presentation";
import type { SerializedRecurringPattern } from "@/lib/recurring/service";

type Props = {
  householdId: string;
  initialPatterns: SerializedRecurringPattern[];
  locale: string;
};

export function RecurringView({ householdId, initialPatterns, locale }: Props) {
  const t = useTranslations("Recurring");
  const [patterns, setPatterns] = useState(initialPatterns);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function update(patternKey: string, status: "confirmed" | "dismissed") {
    setBusyKey(patternKey);
    setMessage(null);
    try {
      const response = await fetch(`/api/households/${householdId}/recurring`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patternKey, status }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? t("error"));
      setPatterns((current) => current.map((pattern) => pattern.key === patternKey ? json.data : pattern));
      setMessage(status === "confirmed" ? t("confirmed") : t("dismissed"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("error"));
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="border-b border-slate-200 pb-5 dark:border-stone-800">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400">{t("eyebrow")}</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-stone-100">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-stone-400">{t("description")}</p>
      </header>
      {message ? <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">{message}</p> : null}
      {patterns.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-sm text-slate-600 dark:border-stone-700 dark:text-stone-400">{t("empty")}</p>
      ) : (
        <section aria-label={t("sectionLabel")} className="grid gap-4 md:grid-cols-2">
          {patterns.map((pattern) => (
            <article key={pattern.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-950">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-900 dark:text-stone-100">{pattern.counterparty}</h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-stone-400">{pattern.kind === "income" ? t("income") : t("expense")} · {pattern.frequency === "monthly" ? t("monthly") : t("weekly")}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-stone-900 dark:text-stone-300">{t(pattern.status)}</span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-slate-500 dark:text-stone-500">{t("typicalAmount")}</dt><dd className="font-medium text-slate-900 dark:text-stone-100">{formatAmountPresentation(pattern.typicalAmountMinor, pattern.currency, locale)}</dd></div>
                <div><dt className="text-slate-500 dark:text-stone-500">{t("observations")}</dt><dd className="font-medium text-slate-900 dark:text-stone-100">{pattern.observationIds.length}</dd></div>
                <div><dt className="text-slate-500 dark:text-stone-500">{t("lastObserved")}</dt><dd className="font-medium text-slate-900 dark:text-stone-100">{new Intl.DateTimeFormat(locale).format(new Date(pattern.lastObservedOn))}</dd></div>
                <div><dt className="text-slate-500 dark:text-stone-500">{t("nextExpected")}</dt><dd className="font-medium text-slate-900 dark:text-stone-100">{new Intl.DateTimeFormat(locale).format(new Date(pattern.nextExpectedOn))}</dd></div>
              </dl>
              {pattern.status === "suggested" ? <div className="mt-5 flex flex-wrap gap-2"><button type="button" disabled={busyKey === pattern.key} onClick={() => update(pattern.key, "confirmed")} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 dark:bg-emerald-400 dark:text-stone-950">{t("confirm")}</button><button type="button" disabled={busyKey === pattern.key} onClick={() => update(pattern.key, "dismissed")} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:border-stone-700 dark:text-stone-200">{t("dismiss")}</button></div> : null}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
