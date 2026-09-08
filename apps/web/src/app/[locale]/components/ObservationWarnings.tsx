import Link from "next/link";
import { getTranslations } from "next-intl/server";

import type { SerializedHouseholdOverview } from "@/lib/overview/schema";

type ObservationWarningsProps = {
  overview: SerializedHouseholdOverview;
  locale: string;
};

export async function ObservationWarnings({
  overview,
  locale,
}: ObservationWarningsProps) {
  const t = await getTranslations("Overview");
  const tAccess = await getTranslations("Accessibility");

  const { availableCash } = overview;
  const { missingAccounts, staleAccounts } = availableCash;

  if (missingAccounts.length === 0 && staleAccounts.length === 0) {
    return null;
  }

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  });

  return (
    <aside
      aria-label={tAccess("accountObservations")}
      className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-xs dark:border-amber-800/40 dark:bg-amber-950/20"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-300">
          {t("observations.title")}
        </h3>
        <Link
          href={`/${locale}/accounts`}
          className="text-xs font-medium text-amber-700 hover:text-amber-800 underline underline-offset-2 dark:text-amber-400 dark:hover:text-amber-300"
        >
          {t("availableCash.updateAccountsPrompt")} →
        </Link>
      </div>

      <ul className="mt-3 flex flex-col gap-1.5 text-xs text-slate-700 dark:text-stone-300">
        {missingAccounts.map((acc) => (
          <li key={acc.id} className="flex items-start gap-2">
            <span className="text-amber-500 font-bold">•</span>
            <span>
              {t("observations.missingAccount", {
                name: acc.name,
                currency: acc.currency,
              })}
            </span>
          </li>
        ))}
        {staleAccounts.map((acc) => (
          <li key={acc.id} className="flex items-start gap-2">
            <span className="text-amber-500 font-bold">•</span>
            <span>
              {t("observations.staleAccount", {
                name: acc.name,
                currency: acc.currency,
                date: dateFormatter.format(new Date(acc.capturedAt)),
              })}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
