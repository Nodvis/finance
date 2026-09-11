import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";

import { listHouseholdAccountsSummary } from "@/lib/accounts/service";
import { getCurrentSession } from "@/lib/auth/session";
import { getCurrentUserHouseholdsStatus } from "@/lib/authorization/household";
import { listHouseholdCategories } from "@/lib/categories/service";
import { routing } from "@/i18n/routing";
import { listTransactionsQuerySchema } from "@/lib/transactions/schema";
import { serializeTransaction } from "@/lib/transactions/serialization";
import { queryManualTransactions } from "@/lib/transactions/service";

import { HouseholdSelectionCard } from "../components/HouseholdSelectionCard";
import { NoHouseholdCard } from "../components/NoHouseholdCard";
import { SignInCard } from "../components/SignInCard";
import { TransactionList } from "../components/TransactionList";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TransactionsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const session = await getCurrentSession();
  if (!session) return <div className="mx-auto w-full max-w-6xl px-4 py-8"><SignInCard /></div>;

  const status = await getCurrentUserHouseholdsStatus();
  if (status.status === "none") return <div className="mx-auto w-full max-w-6xl px-4 py-8"><NoHouseholdCard email={session.user.email} defaultDisplayName={session.user.name} /></div>;
  if (status.status === "multiple_needs_selection") return <div className="mx-auto w-full max-w-6xl px-4 py-8"><HouseholdSelectionCard households={status.households} email={session.user.email} /></div>;
  if (status.status !== "single" && status.status !== "multiple_selected") return null;

  const rawParams = searchParams ? await searchParams : {};
  const parsedQuery = listTransactionsQuerySchema.safeParse(
    Object.fromEntries(Object.entries(rawParams).map(([key, value]) => [key, first(value)])),
  );
  const query = parsedQuery.success ? parsedQuery.data : listTransactionsQuerySchema.parse({});
  const context = status.activeContext;
  const [accounts, categories, transactionResult] = await Promise.all([
    listHouseholdAccountsSummary(context),
    listHouseholdCategories(context, { includeArchived: true }),
    queryManualTransactions(context, query),
  ]);
  const t = await getTranslations("Transactions");

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="border-b border-slate-200 pb-5 dark:border-stone-800/80">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400/80">{t("pageEyebrow")}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-stone-100 sm:text-3xl">{t("pageTitle")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-stone-400">{t("pageDescription")}</p>
      </header>
      <TransactionList transactions={transactionResult.transactions.map(serializeTransaction)} initialTotalCount={transactionResult.total} accounts={accounts} categories={categories} locale={locale} householdId={context.householdId} />
    </main>
  );
}