import Link from "next/link";
import { getTranslations } from "next-intl/server";

import type { SerializedHouseholdOverview } from "@/lib/overview/schema";
import type { AuthorizedHouseholdUserContext } from "@/lib/authorization/household";
import { SignOutButton } from "./SignOutButton";

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
  const tHousehold = await getTranslations("Household");
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
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div>
            <span className="text-stone-400">{tHousehold("label")}: </span>
            <span className="font-semibold text-stone-100">
              {householdContext.householdName}
            </span>
          </div>
          <div>
            <span className="text-stone-400">{tHousehold("member")}: </span>
            <span className="font-medium text-stone-200">
              {householdContext.personDisplayName}
            </span>
          </div>
          <div>
            <span className="text-stone-400">{tHousehold("currency")}: </span>
            <span className="font-mono font-semibold text-stone-100">
              {householdContext.defaultCurrency}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="#transaction-forms"
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50"
          >
            + {tOverview("addTransactionAction")}
          </a>
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
          <SignOutButton />
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
