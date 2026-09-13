import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getCurrentSession } from "@/lib/auth/session";
import { getCurrentUserHouseholdsStatus } from "@/lib/authorization/household";
import { getHouseholdPlanning } from "@/lib/planning/service";
import { formatAmountPresentation } from "@/lib/transactions/presentation";
import { HouseholdSelectionCard } from "../components/HouseholdSelectionCard";
import { NoHouseholdCard } from "../components/NoHouseholdCard";
import { SignInCard } from "../components/SignInCard";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ strategy?: string }> };
const strategies = ["stabilization", "50-30-20", "pay-yourself-first", "debt-avalanche", "debt-snowball", "sinking-fund"] as const;

export default async function PlanPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations("Planning");
  const session = await getCurrentSession();
  if (!session) return <div className="mx-auto w-full max-w-6xl px-4 py-8"><SignInCard /></div>;
  const status = await getCurrentUserHouseholdsStatus();
  if (status.status === "none") return <div className="mx-auto w-full max-w-6xl px-4 py-8"><NoHouseholdCard email={session.user.email} defaultDisplayName={session.user.name} /></div>;
  if (status.status === "multiple_needs_selection") return <div className="mx-auto w-full max-w-6xl px-4 py-8"><HouseholdSelectionCard households={status.households} email={session.user.email} /></div>;
  if (status.status !== "single" && status.status !== "multiple_selected") return null;
  const strategy = strategies.includes((await searchParams).strategy as typeof strategies[number]) ? (await searchParams).strategy as typeof strategies[number] : "stabilization";
  const month = new Date().toISOString().slice(0, 7);
  const plan = await getHouseholdPlanning(status.activeContext, { strategy, month, asOf: new Date().toISOString().slice(0, 10), horizonDays: 30 });
  return <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
    <header><p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">{t("eyebrow")}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{t("title")}</h1><p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-stone-400">{t("description")}</p></header>
    <nav aria-label={t("strategyLabel")} className="grid gap-2 sm:grid-cols-3"><span className="sr-only">{t("strategyLabel")}</span>{strategies.map((item) => <Link key={item} href={{ pathname: "/plan", query: { strategy: item } }} aria-current={strategy === item ? "page" : undefined} className={`rounded-xl border px-3 py-3 text-sm font-medium ${strategy === item ? "border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100" : "border-slate-200 dark:border-stone-800"}`}>{t(`strategies.${item}`)}</Link>)}</nav>
    {!plan.hasData ? <section className="rounded-2xl border border-dashed p-8 text-center"><h2 className="font-semibold">{t("empty.title")}</h2><p className="mt-2 text-sm text-slate-600 dark:text-stone-400">{t("empty.description")}</p></section> : <div className="space-y-5">{plan.byCurrency.map((item) => <section key={item.currency} className="finance-card p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">{item.currency}</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold dark:bg-stone-800">{t(`status.${item.status}`)}</span></div><p className="mt-4 text-sm text-slate-600 dark:text-stone-400">{t("projected", { amount: formatAmountPresentation(item.projectedCashMinor, item.currency, locale) })}</p>{item.suggestions.length ? <ul className="mt-5 space-y-3">{item.suggestions.map((suggestion, index) => <li key={`${suggestion.code}-${index}`} className="rounded-xl border border-slate-200 p-4 text-sm dark:border-stone-800"><span className="font-medium">{t(`suggestions.${suggestion.code}`)}</span>{suggestion.amountMinor !== undefined ? <span className="ml-2 font-semibold">{formatAmountPresentation(suggestion.amountMinor, item.currency, locale)}</span> : null}</li>)}</ul> : null}</section>)}</div>}
    <p className="text-xs text-slate-500 dark:text-stone-400">{t("disclaimer")}</p>
  </main>;
}
