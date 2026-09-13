import Link from "next/link";
import { getTranslations } from "next-intl/server";

import type { SerializedHouseholdOverview } from "@/lib/overview/schema";
import type { SerializedNetWorthSummary } from "@/lib/net-worth/serialization";
import { formatAmountPresentation } from "@/lib/transactions/presentation";

type OverviewCardsProps = {
  overview: SerializedHouseholdOverview;
  netWorth?: SerializedNetWorthSummary | null;
  locale: string;
};

export async function OverviewCards({ overview, netWorth, locale }: OverviewCardsProps) {
  const t = await getTranslations("Overview");
  const tHome = await getTranslations("HomePage");
  const tAccess = await getTranslations("Accessibility");

  const { availableCash } = overview;
  const hasFresh = availableCash.freshAccountsCount > 0;
  const isComplete = availableCash.isFullyKnown;

  return (
    <section
      aria-label={tAccess("financialSummary")}
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      {/* 1. Observed Available Cash Card */}
      <article className="flex flex-col justify-between finance-card p-5 transition-colors hover:border-[var(--finance-signal-dark)] dark:hover:border-stone-700/80">
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-stone-400">
              {t("availableCash.title")}
            </p>
            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-600 bg-slate-100 dark:text-stone-400 dark:bg-stone-800">
              {t("availableCash.creditCardsExcluded")}
            </span>
          </div>

          <div className="mt-3 space-y-1">
            {hasFresh ? (
              availableCash.byCurrency.map((curr) => (
                <p
                  key={curr.currency}
                  className="font-mono text-2xl font-semibold tracking-tight text-emerald-600 dark:text-emerald-400 sm:text-3xl"
                >
                  {formatAmountPresentation(
                    curr.amountMinor,
                    curr.currency,
                    locale,
                  )}
                </p>
              ))
            ) : (
              <p className="font-mono text-3xl font-semibold tracking-tight text-slate-900 dark:text-stone-100">
                —
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 border-t border-slate-100 pt-3 text-xs dark:border-stone-800/80">
          {!hasFresh ? (
            <p className="text-slate-500 dark:text-stone-400">
              {t("availableCash.noSnapshots")}
            </p>
          ) : isComplete ? (
            <p className="text-emerald-600 font-medium dark:text-emerald-500/90">
              {t("availableCash.allFresh", {
                count: availableCash.freshAccountsCount,
              })}
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              <p className="text-amber-600 font-medium dark:text-amber-400/90">
                {t("availableCash.partialWarning", {
                  count:
                    availableCash.missingAccounts.length +
                    availableCash.staleAccounts.length,
                })}
              </p>
              <Link
                href={`/${locale}/accounts`}
                className="text-slate-500 hover:text-slate-800 underline underline-offset-2 dark:text-stone-400 dark:hover:text-stone-200"
              >
                {t("availableCash.updateAccountsPrompt")} →
              </Link>
            </div>
          )}
        </div>
      </article>

      {/* 2. Upcoming Obligations Card */}
      <article className="flex flex-col justify-between finance-card p-5 transition-colors hover:border-[var(--finance-signal-dark)] dark:hover:border-stone-700/80">
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-stone-400">
              {t("upcoming.title")}
            </p>
            {overview.upcoming && overview.upcoming.overdueCount > 0 ? (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-medium text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-950/60">
                {t("upcoming.overdueCount", { count: overview.upcoming.overdueCount })}
              </span>
            ) : null}
          </div>

          <div className="mt-3 space-y-1">
            {overview.upcoming && overview.upcoming.upcomingByCurrency.length > 0 ? (
              overview.upcoming.upcomingByCurrency.map((curr) => (
                <p
                  key={curr.currency}
                  className="font-mono text-2xl font-semibold tracking-tight text-slate-900 dark:text-stone-100 sm:text-3xl"
                >
                  {formatAmountPresentation(
                    curr.totalMinor,
                    curr.currency,
                    locale,
                  )}
                </p>
              ))
            ) : (
              <p className="font-mono text-3xl font-semibold tracking-tight text-slate-900 dark:text-stone-100">
                —
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 border-t border-slate-100 pt-3 text-xs dark:border-stone-800/80">
          {overview.upcoming ? (
            <div className="flex flex-col gap-1">
              <p className="text-slate-600 dark:text-stone-300">
                {overview.upcoming.upcomingCount > 0
                  ? t("upcoming.upcomingCount", { count: overview.upcoming.upcomingCount })
                  : t("upcoming.empty")}
              </p>
              <Link
                href={`/${locale}/upcoming`}
                className="text-slate-500 hover:text-slate-800 underline underline-offset-2 dark:text-stone-400 dark:hover:text-stone-200"
              >
                {t("upcoming.viewAll")} →
              </Link>
            </div>
          ) : (
            <>
              <p className="font-medium text-slate-700 dark:text-stone-300">
                {t("upcoming.notModeled")}
              </p>
              <p className="mt-0.5 text-slate-400 text-[11px] leading-relaxed dark:text-stone-500">
                {t("upcoming.note")}
              </p>
            </>
          )}
        </div>
      </article>

      {/* 3. Debt & Net Worth Position Card */}
      <article className="flex flex-col justify-between finance-card p-5 transition-colors hover:border-[var(--finance-signal-dark)] dark:hover:border-stone-700/80">
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-stone-400">
              {t("debt.title")}
            </p>
            {netWorth && netWorth.byCurrency.some((c) => c.currentConfidence !== "no_data") ? (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-600 bg-slate-100 dark:text-stone-400 dark:bg-stone-800">
                {netWorth.byCurrency[0]?.currentIsComplete ? t("availableCash.allFresh", { count: 1 }) : t("availableCash.partialWarning", { count: 1 })}
              </span>
            ) : null}
          </div>

          <div className="mt-3 space-y-1">
            {netWorth && netWorth.byCurrency.some((c) => c.currentConfidence !== "no_data") ? (
              netWorth.byCurrency.map((curr) => (
                <p
                  key={curr.currency}
                  className="font-mono text-2xl font-semibold tracking-tight text-slate-900 dark:text-stone-100 sm:text-3xl"
                >
                  {formatAmountPresentation(
                    curr.currentNetWorthMinor,
                    curr.currency,
                    locale,
                  )}
                </p>
              ))
            ) : (
              <p className="font-mono text-3xl font-semibold tracking-tight text-slate-900 dark:text-stone-100">
                —
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-stone-800/80 dark:text-stone-400">
          <div className="flex flex-col gap-1">
            <p className="font-medium text-slate-700 dark:text-stone-300">
              {netWorth && netWorth.byCurrency.some((c) => c.currentConfidence !== "no_data")
                ? t("debt.modeled")
                : t("debt.notModeled")}
            </p>
            <Link
              href={`/${locale}/net-worth`}
              className="text-slate-500 hover:text-slate-800 underline underline-offset-2 dark:text-stone-400 dark:hover:text-stone-200"
            >
              {t("debt.viewDetails")} →
            </Link>
          </div>
        </div>
      </article>

      {/* 4. Monthly cash flow card — only shown when a real period exists */}
      <article className="finance-card dashboard-kpi dashboard-kpi-accent flex flex-col justify-between p-5 transition-colors hover:border-[var(--finance-signal-dark)] dark:hover:border-stone-700/80">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-stone-400">{tHome("cards.monthly")}</p>
          <span className="finance-icon-box" aria-hidden="true">↗</span>
        </div>
        <div className="mt-5">
          {overview.cashFlow.byCurrency.length > 0 ? (
            overview.cashFlow.byCurrency.map((currency) => (
              <p key={currency.currency} className={`finance-metric ${BigInt(currency.netCashFlowMinor) >= 0n ? "text-[var(--finance-signal-dark)] dark:text-[var(--finance-signal)]" : "text-amber-700 dark:text-amber-300"}`}>
                {BigInt(currency.netCashFlowMinor) > 0n ? "+" : ""}{formatAmountPresentation(currency.netCashFlowMinor, currency.currency, locale)}
              </p>
            ))
          ) : <p className="finance-metric">—</p>}
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">{overview.cashFlow.byCurrency.length > 0 ? tHome("charts.net") : tHome("cards.noMonthly")}</p>
        </div>
      </article>
    </section>
  );
}
