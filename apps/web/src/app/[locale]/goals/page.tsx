import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getCurrentSession } from "@/lib/auth/session";
import { getCurrentUserHouseholdsStatus } from "@/lib/authorization/household";
import { getHouseholdSavingsGoalsOverview } from "@/lib/savings-goals/service";
import { formatAmountPresentation } from "@/lib/transactions/presentation";
import { HouseholdSelectionCard } from "../components/HouseholdSelectionCard";
import { NoHouseholdCard } from "../components/NoHouseholdCard";
import { SignInCard } from "../components/SignInCard";
import { GoalsCreateForm } from "./GoalsCreateForm";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

function dateLabel(value: string | null, locale: string, fallback: string): string {
  if (!value) return fallback;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

export default async function GoalsPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations("Goals");
  const session = await getCurrentSession();
  if (!session) return <div className="mx-auto w-full max-w-6xl px-4 py-8"><SignInCard /></div>;

  const status = await getCurrentUserHouseholdsStatus();
  if (status.status === "none") return <div className="mx-auto w-full max-w-6xl px-4 py-8"><NoHouseholdCard email={session.user.email} defaultDisplayName={session.user.name} /></div>;
  if (status.status === "multiple_needs_selection") return <div className="mx-auto w-full max-w-6xl px-4 py-8"><HouseholdSelectionCard households={status.households} email={session.user.email} /></div>;
  if (status.status !== "single" && status.status !== "multiple_selected") return null;

  const overview = await getHouseholdSavingsGoalsOverview(status.activeContext);
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">{t("eyebrow")}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-stone-50">{t("title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-stone-400">{t("description")}</p>
        </div>
        <GoalsCreateForm householdId={status.activeContext.householdId} labels={{ name: t("form.name"), target: t("form.targetAmount"), currency: t("form.currency"), date: t("form.targetDate"), submit: t("addGoal"), invalid: t("form.invalid") }} />
      </header>
      {overview.goals.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-stone-700">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-stone-50">{t("empty.title")}</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600 dark:text-stone-400">{t("empty.description")}</p>
          <GoalsCreateForm householdId={status.activeContext.householdId} labels={{ name: t("form.name"), target: t("form.targetAmount"), currency: t("form.currency"), date: t("form.targetDate"), submit: t("empty.action"), invalid: t("form.invalid") }} />
        </section>
      ) : (
        <div className="space-y-6">
          <section aria-label={t("summary.totalGoals")} className="grid gap-4 sm:grid-cols-3">
            <Metric label={t("summary.activeGoals")} value={String(overview.activeGoalsCount)} />
            <Metric label={t("summary.completedGoals")} value={String(overview.completedGoalsCount)} />
            <Metric label={t("summary.totalGoals")} value={String(overview.totalGoalsCount)} />
          </section>
          <section className="grid gap-4 lg:grid-cols-2">
            {overview.goals.map((goal) => (
              <article key={goal.id} className="finance-card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div><h2 className="text-lg font-semibold text-slate-950 dark:text-stone-50">{goal.name}</h2><p className="mt-1 text-xs uppercase tracking-wide text-slate-500 dark:text-stone-400">{t(`tabs.${goal.status}` as "tabs.active" | "tabs.completed" | "tabs.archived")}</p></div>
                  <span className="font-mono text-sm font-semibold text-slate-700 dark:text-stone-200">{goal.calculation.progressPercentage.toFixed(2)}%</span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-stone-800"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, goal.calculation.progressPercentage)}%` }} /></div>
                <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                  <Value label={t("card.saved")} value={formatAmountPresentation(goal.currentAmountMinor, goal.currency, locale)} />
                  <Value label={t("card.target")} value={formatAmountPresentation(goal.targetAmountMinor, goal.currency, locale)} />
                  <Value label={t("card.remaining")} value={formatAmountPresentation(goal.calculation.remainingAmountMinor, goal.currency, locale)} />
                  <Value label={t("card.targetDate")} value={dateLabel(goal.targetDate, locale, t("card.noTargetDate"))} />
                  <Value label={t("card.monthly")} value={goal.calculation.suggestedMonthlyContributionMinor === null ? "—" : formatAmountPresentation(goal.calculation.suggestedMonthlyContributionMinor, goal.currency, locale)} />
                </dl>
                <details className="mt-5 border-t border-slate-200 pt-4 text-sm dark:border-stone-800"><summary className="cursor-pointer font-semibold text-slate-700 dark:text-stone-200">{t("card.explainNumber")}</summary><p className="mt-3 text-slate-600 dark:text-stone-400">{t("explain.formulaCeiling")}</p></details>
              </article>
            ))}
          </section>
        </div>
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="finance-card p-5"><p className="text-sm text-slate-500 dark:text-stone-400">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-stone-50">{value}</p></div>; }
function Value({ label, value }: { label: string; value: string }) { return <div><dt className="text-slate-500 dark:text-stone-400">{label}</dt><dd className="mt-1 font-medium text-slate-900 dark:text-stone-100">{value}</dd></div>; }
