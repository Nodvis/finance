import Link from "next/link";
import { getTranslations } from "next-intl/server";

import type { SerializedHouseholdOverview } from "@/lib/overview/schema";
import { formatAmountPresentation } from "@/lib/transactions/presentation";

type OverviewCardsProps = {
  overview: SerializedHouseholdOverview;
  locale: string;
};

export async function OverviewCards({ overview, locale }: OverviewCardsProps) {
  const t = await getTranslations("Overview");
  const tAccess = await getTranslations("Accessibility");

  const { availableCash } = overview;
  const hasFresh = availableCash.freshAccountsCount > 0;
  const isComplete = availableCash.isFullyKnown;

  return (
    <section
      aria-label={tAccess("financialSummary")}
      className="grid gap-4 sm:grid-cols-3"
    >
      {/* 1. Observed Available Cash Card */}
      <article className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-colors hover:border-slate-300 dark:border-stone-800 dark:bg-stone-900/70 dark:hover:border-stone-700/80">
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

      {/* 2. Upcoming Obligations Card (Preserving INV-014, not fabricating obligations) */}
      <article className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-colors hover:border-slate-300 dark:border-stone-800 dark:bg-stone-900/70 dark:hover:border-stone-700/80">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-stone-400">
            {t("upcoming.title")}
          </p>
          <p className="mt-3 font-mono text-3xl font-semibold tracking-tight text-slate-900 dark:text-stone-100">
            —
          </p>
        </div>
        <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-stone-800/80 dark:text-stone-400">
          <p className="font-medium text-slate-700 dark:text-stone-300">
            {t("upcoming.notModeled")}
          </p>
          <p className="mt-0.5 text-slate-400 text-[11px] leading-relaxed dark:text-stone-500">
            {t("upcoming.note")}
          </p>
        </div>
      </article>

      {/* 3. Debt & Liabilities Card (Preserving INV-013, not fabricating debts) */}
      <article className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-colors hover:border-slate-300 dark:border-stone-800 dark:bg-stone-900/70 dark:hover:border-stone-700/80">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-stone-400">
            {t("debt.title")}
          </p>
          <p className="mt-3 font-mono text-3xl font-semibold tracking-tight text-slate-900 dark:text-stone-100">
            —
          </p>
        </div>
        <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-stone-800/80 dark:text-stone-400">
          <p className="font-medium text-slate-700 dark:text-stone-300">
            {t("debt.notModeled")}
          </p>
          <p className="mt-0.5 text-slate-400 text-[11px] leading-relaxed dark:text-stone-500">
            {t("debt.note")}
          </p>
        </div>
      </article>
    </section>
  );
}
