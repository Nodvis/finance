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
  householdContext,
  overview,
  locale,
}: PeriodHeaderProps) {
  const tNav = await getTranslations("Navigation");

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
    <div className="flex flex-col gap-4 rounded-2xl border border-stone-800 bg-stone-900/60 p-4 shadow-xs backdrop-blur-xs">
      {/* Top row: Household Context Info + Nav actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-800/60 pb-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-stone-400">
            {tOverview("periodLabel")}
          </p>
          <p className="mt-1 text-base font-semibold text-stone-100">{periodLabel}</p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/${locale}/accounts`}
            className="rounded-lg border border-stone-700 bg-stone-800/80 px-3 py-1.5 text-xs font-medium text-stone-300 transition-colors hover:border-stone-600 hover:text-stone-100"
          >
            {tNav("accounts")}
          </Link>
          <Link
            href={`/${locale}/categories`}
            className="rounded-lg border border-stone-700 bg-stone-800/80 px-3 py-1.5 text-xs font-medium text-stone-300 transition-colors hover:border-stone-600 hover:text-stone-100"
          >
            {tNav("categories")}
          </Link>
        </div>
      </div>

      {/* Bottom row: Period Selector & Display */}
      <div
        aria-label={tAccess("periodNavigation")}
        className="flex flex-wrap items-center justify-between gap-4 pt-1"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-stone-400 font-medium">
            {tOverview("periodLabel")}:
          </span>
          <span className="text-base font-semibold text-stone-100 font-mono sm:text-lg">
            {periodLabel}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/${locale}?month=${period.prevMonthKey}`}
            className="rounded-lg border border-stone-700 bg-stone-800/70 px-2.5 py-1 text-xs font-medium text-stone-300 transition-colors hover:border-stone-600 hover:text-stone-100"
            aria-label={tOverview("previousMonth")}
          >
            ← {tOverview("previousMonth")}
          </Link>
          <Link
            href={`/${locale}`}
            className="rounded-lg border border-stone-700 bg-stone-800/70 px-2.5 py-1 text-xs font-medium text-stone-300 transition-colors hover:border-stone-600 hover:text-stone-100"
          >
            {tOverview("thisMonth")}
          </Link>
          <Link
            href={`/${locale}?month=${period.nextMonthKey}`}
            className="rounded-lg border border-stone-700 bg-stone-800/70 px-2.5 py-1 text-xs font-medium text-stone-300 transition-colors hover:border-stone-600 hover:text-stone-100"
            aria-label={tOverview("nextMonth")}
          >
            {tOverview("nextMonth")} →
          </Link>
        </div>
      </div>
    </div>
  );
}
