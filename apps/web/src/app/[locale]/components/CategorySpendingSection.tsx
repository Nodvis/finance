import { getTranslations } from "next-intl/server";

import type { SerializedHouseholdOverview } from "@/lib/overview/schema";
import { formatAmountPresentation } from "@/lib/transactions/presentation";

type CategorySpendingSectionProps = {
  overview: SerializedHouseholdOverview;
  locale: string;
};

export async function CategorySpendingSection({
  overview,
  locale,
}: CategorySpendingSectionProps) {
  const t = await getTranslations("Overview");
  const tAccess = await getTranslations("Accessibility");

  const { categorySpending, period } = overview;
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

  const hasSpending = categorySpending.length > 0;

  return (
    <section
      aria-label={tAccess("categoryBreakdown")}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl dark:text-stone-100">
          {t("categorySpending.title")}
        </h2>
        <p className="text-xs text-slate-500 dark:text-stone-400">
          {t("categorySpending.description")}
        </p>
      </div>

      {!hasSpending ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-stone-800 dark:bg-stone-900/40">
          <p className="text-sm font-semibold text-slate-700 dark:text-stone-300">
            {t("categorySpending.emptyTitle")}
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-stone-500">
            {t("categorySpending.emptyDescription", { period: formattedPeriod })}
          </p>
        </div>
      ) : (
        <div className="finance-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-stone-800 dark:bg-stone-950/40 dark:text-stone-400">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    {t("categorySpending.colCategory")}
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    {t("categorySpending.colAmount")}
                  </th>
                  <th scope="col" className="px-5 py-3.5 w-1/3">
                    {t("categorySpending.colShare")}
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    {t("categorySpending.colCount")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-stone-800/60">
                {categorySpending.map((cat, idx) => {
                  const isUncategorized = cat.categoryId === null;
                  return (
                    <tr
                      key={`${cat.currency}:::${cat.categoryId ?? `uncat-${idx}`}`}
                      className="transition-colors hover:bg-slate-50/80 dark:hover:bg-stone-800/30"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                              isUncategorized
                                ? "bg-slate-100 text-slate-500 italic dark:bg-stone-800 dark:text-stone-400"
                                : "bg-slate-100 text-slate-800 dark:bg-stone-800/80 dark:text-stone-200"
                            }`}
                          >
                            {isUncategorized
                              ? t("categorySpending.uncategorized")
                              : cat.categoryName}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-medium text-slate-900 dark:text-stone-100">
                        {formatAmountPresentation(
                          cat.amountMinor,
                          cat.currency,
                          locale,
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100 dark:bg-stone-800">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                              style={{
                                width: `${Math.min(
                                  Math.max(cat.percentage, 0),
                                  100,
                                )}%`,
                              }}
                            />
                          </div>
                          <span className="font-mono text-xs text-slate-500 min-w-[3rem] dark:text-stone-400">
                            {cat.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-xs text-slate-500 dark:text-stone-400">
                        {cat.transactionCount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
