import Link from "next/link";
import { getTranslations } from "next-intl/server";

import type { SerializedHouseholdOverview } from "@/lib/overview/schema";
import type { AuthorizedHouseholdUserContext } from "@/lib/authorization/household";

type PeriodHeaderProps = {
  householdContext: AuthorizedHouseholdUserContext;
  overview: SerializedHouseholdOverview;
  locale: string;
};

export async function PeriodHeader({
  overview,
  locale,
}: PeriodHeaderProps) {
  const tOverview = await getTranslations("Overview");
  const tAccess = await getTranslations("Accessibility");

  const { period } = overview;
  const startDate = new Date(period.startDate);

  let periodLabel = "";
  if (period.monthKey) {
    const rawMonth = new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(startDate);
    periodLabel = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1);
  } else {
    const formatter = new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    });
    periodLabel = `${formatter.format(startDate)} – ${formatter.format(
      new Date(period.endDate),
    )}`;
  }

  return (
    <div
      aria-label={tAccess("periodNavigation")}
      className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-stone-800 dark:bg-stone-900/60"
    >
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-stone-400">
          {tOverview("periodLabel")}:
        </span>
        <span className="text-base font-semibold text-slate-900 font-mono sm:text-lg dark:text-stone-100">
          {periodLabel}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/${locale}?month=${period.prevMonthKey}`}
          className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-stone-700 dark:bg-stone-800/70 dark:text-stone-300 dark:hover:border-stone-600 dark:hover:text-stone-100"
          aria-label={tOverview("previousMonth")}
        >
          ← {tOverview("previousMonth")}
        </Link>
        <Link
          href={`/${locale}`}
          className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-stone-700 dark:bg-stone-800/70 dark:text-stone-300 dark:hover:border-stone-600 dark:hover:text-stone-100"
        >
          {tOverview("thisMonth")}
        </Link>
        <Link
          href={`/${locale}?month=${period.nextMonthKey}`}
          className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-stone-700 dark:bg-stone-800/70 dark:text-stone-300 dark:hover:border-stone-600 dark:hover:text-stone-100"
          aria-label={tOverview("nextMonth")}
        >
          {tOverview("nextMonth")} →
        </Link>
      </div>
    </div>
  );
}
