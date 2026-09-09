"use client";

import { useTranslations } from "next-intl";
import { formatAmountPresentation } from "@/lib/transactions/presentation";

type Summary = {
  currency: string;
  incomeMinor: string;
  expenseMinor: string;
  netMinor: string;
  uncategorizedMinor: string;
  months: Array<{ month: string; incomeMinor: string; expenseMinor: string; netMinor: string }>;
  categories: Array<{ name: string; amountMinor: string }>;
  counterparties: Array<{ name: string; amountMinor: string }>;
  largest: Array<{ id: string; label: string; amountMinor: string; occurredOn: string }>;
};

export default function AnalyticsView({ locale, summaries }: { locale: string; summaries: Summary[] }) {
  const t = useTranslations("Analytics");
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <header><h1 className="text-2xl font-semibold">{t("title")}</h1><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t("subtitle")}</p></header>
      {summaries.length === 0 ? <p className="rounded-2xl border p-6 text-sm">{t("empty")}</p> : summaries.map((summary) => (
        <section key={summary.currency} className="space-y-4 rounded-2xl border p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">{summary.currency}</h2>
          <div className="grid gap-3 sm:grid-cols-4">
            <Metric label={t("income")} value={formatAmountPresentation(summary.incomeMinor, summary.currency, locale)} />
            <Metric label={t("spending")} value={formatAmountPresentation(summary.expenseMinor, summary.currency, locale)} />
            <Metric label={t("net") } value={formatAmountPresentation(summary.netMinor, summary.currency, locale)} />
            <Metric label={t("uncategorized")} value={formatAmountPresentation(summary.uncategorizedMinor, summary.currency, locale)} />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Table title={t("byCategory")} rows={summary.categories.map((row) => [row.name, formatAmountPresentation(row.amountMinor, summary.currency, locale)])} empty={t("noCategories")} />
            <Table title={t("byCounterparty")} rows={summary.counterparties.map((row) => [row.name, formatAmountPresentation(row.amountMinor, summary.currency, locale)])} empty={t("noCounterparties")} />
            <Table title={t("largest")} rows={summary.largest.map((row) => [row.label, formatAmountPresentation(row.amountMinor, summary.currency, locale)])} empty={t("noExpenses")} />
          </div>
          <div className="overflow-x-auto"><h3 className="mb-2 font-medium">{t("monthly")}</h3><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">{t("month")}</th><th className="p-2">{t("income")}</th><th className="p-2">{t("spending")}</th><th className="p-2">{t("net")}</th></tr></thead><tbody>{summary.months.map((row) => <tr key={row.month} className="border-b last:border-0"><td className="p-2">{row.month}</td><td className="p-2">{formatAmountPresentation(row.incomeMinor, summary.currency, locale)}</td><td className="p-2">{formatAmountPresentation(row.expenseMinor, summary.currency, locale)}</td><td className="p-2">{formatAmountPresentation(row.netMinor, summary.currency, locale)}</td></tr>)}</tbody></table></div>
        </section>
      ))}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 font-semibold">{value}</div></div>; }
function Table({ title, rows, empty }: { title: string; rows: string[][]; empty: string }) { return <div><h3 className="mb-2 font-medium">{title}</h3>{rows.length ? <ul className="space-y-2 text-sm">{rows.map(([name, value]) => <li key={name} className="flex justify-between gap-3 border-b pb-1 last:border-0"><span className="truncate">{name}</span><span className="whitespace-nowrap">{value}</span></li>)}</ul> : <p className="text-sm text-slate-500">{empty}</p>}</div>; }
