import { getTranslations } from "next-intl/server";

import type { SerializedHouseholdOverview } from "@/lib/overview/schema";
import { formatAmountPresentation } from "@/lib/transactions/presentation";

type CashFlowSectionProps = {
  overview: SerializedHouseholdOverview;
  locale: string;
};

export async function CashFlowSection({
  overview,
  locale,
}: CashFlowSectionProps) {
  const t = await getTranslations("Overview");
  const tAccess = await getTranslations("Accessibility");

  const { cashFlow, period } = overview;
  const startDate = new Date(period.startDate);
  const formattedPeriod = period.monthKey
    ? new Intl.DateTimeFormat(locale, {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(startDate)
    : `${new Intl.DateTimeFormat(locale, { timeZone: "UTC" }).format(
        startDate,
      )}`;

  const hasFlow = cashFlow.byCurrency.length > 0;

  return (
    <section
      aria-label={tAccess("cashFlowSummary")}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl dark:text-stone-100">
          {t("cashFlow.title", { period: formattedPeriod })}
        </h2>
        <p className="text-xs text-slate-500 dark:text-stone-400">
          {t("cashFlow.description")}
        </p>
      </div>

      {!hasFlow ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-stone-800 dark:bg-stone-900/40">
          <p className="text-sm font-semibold text-slate-700 dark:text-stone-300">
            {t("cashFlow.emptyTitle")}
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-stone-500">
            {t("cashFlow.emptyDescription", { period: formattedPeriod })}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {cashFlow.byCurrency.map((currFlow) => {
            const netMinor = BigInt(currFlow.netCashFlowMinor);
            const isPositiveNet = netMinor > 0n;
            const isZeroNet = netMinor === 0n;

            return (
              <div
                key={currFlow.currency}
                className="grid gap-4 sm:grid-cols-3"
              >
                {/* Actual Income Card */}
                <article className="finance-card p-5 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400/90">
                      {t("cashFlow.actualIncome")}
                    </p>
                    <span className="font-mono text-xs text-slate-500 dark:text-stone-400">
                      {currFlow.currency}
                    </span>
                  </div>
                  <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-emerald-600 sm:text-3xl dark:text-emerald-400">
                    +{formatAmountPresentation(
                      currFlow.incomeMinor,
                      currFlow.currency,
                      locale,
                    )}
                  </p>
                  <p className="mt-2 text-[11px] text-slate-500 dark:text-stone-400">
                    {t("cashFlow.incomeNote")}
                  </p>
                </article>

                {/* Actual Spending Card */}
                <article className="finance-card p-5 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-stone-300">
                      {t("cashFlow.actualSpending")}
                    </p>
                    <span className="font-mono text-xs text-slate-500 dark:text-stone-400">
                      {currFlow.currency}
                    </span>
                  </div>
                  <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-stone-100">
                    -{formatAmountPresentation(
                      currFlow.spendingMinor,
                      currFlow.currency,
                      locale,
                    )}
                  </p>
                  <p className="mt-2 text-[11px] text-slate-500 dark:text-stone-400">
                    {t("cashFlow.spendingNote")}
                  </p>
                </article>

                {/* Net Cash Flow Card */}
                <article
                  className={`rounded-2xl border p-5 shadow-xs transition-colors ${
                    isPositiveNet
                      ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-800/60 dark:bg-emerald-950/20"
                      : isZeroNet
                      ? "border-slate-200 bg-white dark:border-stone-800 dark:bg-stone-900/60"
                      : "border-amber-200 bg-amber-50/70 dark:border-amber-800/50 dark:bg-amber-950/20"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-stone-400">
                      {t("cashFlow.netCashFlow")}
                    </p>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        isPositiveNet
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
                          : isZeroNet
                          ? "bg-slate-100 text-slate-600 dark:bg-stone-800 dark:text-stone-400"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
                      }`}
                    >
                      {isPositiveNet
                        ? t("cashFlow.netPositive")
                        : isZeroNet
                        ? "0"
                        : t("cashFlow.netNegative")}
                    </span>
                  </div>
                  <p
                    className={`mt-2 font-mono text-2xl font-semibold tracking-tight sm:text-3xl ${
                      isPositiveNet
                        ? "text-emerald-700 dark:text-emerald-300"
                        : isZeroNet
                        ? "text-slate-800 dark:text-stone-300"
                        : "text-amber-700 dark:text-amber-300"
                    }`}
                  >
                    {isPositiveNet ? "+" : ""}
                    {formatAmountPresentation(
                      currFlow.netCashFlowMinor,
                      currFlow.currency,
                      locale,
                    )}
                  </p>
                  <p className="mt-2 text-[11px] text-slate-500 dark:text-stone-400">
                    {currFlow.transactionCount}{" "}
                    {t("categorySpending.colCount").toLowerCase()}
                  </p>
                </article>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
