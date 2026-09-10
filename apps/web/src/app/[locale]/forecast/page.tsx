import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getCurrentSession } from "@/lib/auth/session";
import { getCurrentUserHouseholdsStatus } from "@/lib/authorization/household";
import { getHouseholdCashForecast, getHouseholdForecastObligations } from "@/lib/forecast/service";
import { formatAmountPresentation } from "@/lib/transactions/presentation";

import { HouseholdSelectionCard } from "../components/HouseholdSelectionCard";
import { NoHouseholdCard } from "../components/NoHouseholdCard";
import { SignInCard } from "../components/SignInCard";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ horizon?: string | string[] }>;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function dateLabel(value: string, locale: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

export default async function ForecastPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations("Forecast");
  const horizon = first(searchParams ? (await searchParams).horizon : undefined) === "30" ? 30 : 7;
  const session = await getCurrentSession();

  if (!session) return <div className="mx-auto w-full max-w-6xl px-4 py-8"><SignInCard /></div>;
  const status = await getCurrentUserHouseholdsStatus();
  if (status.status === "none") return <div className="mx-auto w-full max-w-6xl px-4 py-8"><NoHouseholdCard email={session.user.email} defaultDisplayName={session.user.name} /></div>;
  if (status.status === "multiple_needs_selection") return <div className="mx-auto w-full max-w-6xl px-4 py-8"><HouseholdSelectionCard households={status.households} email={session.user.email} /></div>;
  if (status.status !== "single" && status.status !== "multiple_selected") return null;

  const context = status.activeContext;
  const asOf = new Date().toISOString().slice(0, 10);
  const forecast = await getHouseholdCashForecast(context, { asOf, horizonDays: horizon });
  const obligations = await getHouseholdForecastObligations(context, { asOf, horizonDays: horizon });

  return (
    <main id="main-content" className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">{t("horizon")}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-stone-50">{t("title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-stone-400">{t("subtitle")}</p>
        </div>
        <div className="flex rounded-xl border border-slate-200 p-1 dark:border-stone-700" aria-label={t("horizon")}>
          <Link href={{ pathname: "/forecast", query: { horizon: "7" } }} className={`rounded-lg px-3 py-2 text-sm font-medium ${horizon === 7 ? "bg-slate-900 text-white dark:bg-stone-100 dark:text-stone-900" : "text-slate-600 dark:text-stone-300"}`}>{t("days7")}</Link>
          <Link href={{ pathname: "/forecast", query: { horizon: "30" } }} className={`rounded-lg px-3 py-2 text-sm font-medium ${horizon === 30 ? "bg-slate-900 text-white dark:bg-stone-100 dark:text-stone-900" : "text-slate-600 dark:text-stone-300"}`}>{t("days30")}</Link>
        </div>
      </div>

      <div className="space-y-6">
        {forecast.byCurrency.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600 dark:border-stone-700 dark:text-stone-400">{t("noData")}</section>
        ) : forecast.byCurrency.map((item) => {
          const contributors = obligations.filter((obligation) => obligation.currency === item.currency);
          return (
            <section key={item.currency} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900 sm:p-6">
              <div className="flex items-center justify-between gap-4"><h2 className="text-xl font-semibold text-slate-950 dark:text-stone-50">{item.currency}</h2><span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.status === "deficit" ? "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200" : item.status === "incomplete" ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"}`}>{item.status === "deficit" ? t("deficit") : item.status === "zero" ? t("zero") : item.status === "incomplete" ? t("incomplete") : t("projected")}</span></div>
              {item.isComplete ? null : <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">{t("incomplete")}</p>}
              <dl className="mt-6 grid gap-4 sm:grid-cols-3">
                <div><dt className="text-sm text-slate-500 dark:text-stone-400">{t("startingCash")}</dt><dd className="mt-1 text-xl font-semibold text-slate-950 dark:text-stone-50">{formatAmountPresentation(item.availableCashMinor, item.currency, locale)}</dd></div>
                <div><dt className="text-sm text-slate-500 dark:text-stone-400">{t("payments")}</dt><dd className="mt-1 text-xl font-semibold text-slate-950 dark:text-stone-50">−{formatAmountPresentation(item.includedObligationsMinor, item.currency, locale)}</dd></div>
                <div><dt className="text-sm text-slate-500 dark:text-stone-400">{t("projected")}</dt><dd className={`mt-1 text-xl font-semibold ${item.status === "deficit" ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300"}`}>{formatAmountPresentation(item.projectedCashMinor, item.currency, locale)}</dd></div>
              </dl>
              <div className="mt-7 border-t border-slate-200 pt-5 dark:border-stone-800"><h3 className="text-sm font-semibold text-slate-950 dark:text-stone-50">{t("contributors")}</h3>{contributors.length === 0 ? <p className="mt-3 text-sm text-slate-500 dark:text-stone-400">{t("noContributors")}</p> : <ul className="mt-3 divide-y divide-slate-100 dark:divide-stone-800">{contributors.map((obligation) => <li key={obligation.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"><span className="text-sm font-medium text-slate-800 dark:text-stone-200">{obligation.title}</span><span className="text-sm text-slate-600 dark:text-stone-400">{t("due", { date: dateLabel(obligation.dueDate, locale) })} · {formatAmountPresentation(obligation.amountMinor, obligation.currency, locale)}</span></li>)}</ul>}</div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
