import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getCurrentSession } from "@/lib/auth/session";
import { getCurrentUserHouseholdsStatus } from "@/lib/authorization/household";
import { listHouseholdBudgets } from "@/lib/budgets/service";
import { listCategoriesByHousehold } from "@nodvis/finance-db";
import { BudgetCreateForm } from "./BudgetCreateForm";
import { BudgetList } from "./BudgetList";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ month?: string }> };
function shift(month: string, delta: number) { const [y, m] = month.split("-").map(Number); return new Date(Date.UTC(y!, m! - 1 + delta, 1)).toISOString().slice(0, 7); }
export default async function BudgetsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations("Budgets");
  const session = await getCurrentSession();
  if (!session) return <main className="mx-auto max-w-6xl p-8">{t("description")}</main>;
  const status = await getCurrentUserHouseholdsStatus();
  if (status.status !== "single" && status.status !== "multiple_selected") return <main className="mx-auto max-w-6xl p-8">{t("empty")}</main>;
  const requested = (await searchParams).month;
  const month = requested && /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : new Date().toISOString().slice(0, 7);
  const [budgets, cats] = await Promise.all([
    listHouseholdBudgets(status.activeContext, { month, includeArchived: false }),
    listCategoriesByHousehold(status.activeContext.householdId, { includeArchived: false, applicability: "expense" }),
  ]);
  const labels = { spent: t("spent"), remaining: t("remaining"), over: t("over"), edit: t("edit"), archive: t("archive"), save: t("saveChanges"), cancel: t("cancel"), archiving: t("archiving"), saving: t("saving"), invalid: t("invalid"), archiveConfirm: t("archiveConfirm") };
  return <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
    <header><p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">{t("eyebrow")}</p><h1 className="mt-2 text-3xl font-semibold">{t("title")} · {month}</h1><p className="mt-2 text-sm text-slate-600 dark:text-stone-400">{t("description")}</p><nav className="mt-4 flex flex-wrap gap-3"><Link className="rounded-lg border px-3 py-2 text-sm" href={`/budgets?month=${shift(month, -1)}`}>{t("previous")}</Link><Link className="rounded-lg border px-3 py-2 text-sm" href={`/budgets?month=${shift(month, 1)}`}>{t("next")}</Link></nav></header>
    <details className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm"><summary className="cursor-pointer font-semibold">{t("explain")}</summary><p className="mt-2 text-[var(--muted-foreground)]">{t("explanation")}</p></details>
    <BudgetCreateForm householdId={status.activeContext.householdId} month={month} categories={cats.map(c => ({ id: c.id, name: c.name }))} labels={{ category: t("category"), limit: t("limit"), currency: t("currency"), save: t("save"), invalid: t("invalid") }} />
    {budgets.length === 0 ? <section className="rounded-2xl border border-dashed p-8 text-center"><p>{t("empty")}</p></section> : <BudgetList initialBudgets={budgets} householdId={status.activeContext.householdId} locale={locale} labels={labels} />}
  </main>;
}
