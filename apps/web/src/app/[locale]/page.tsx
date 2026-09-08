import { getTranslations } from "next-intl/server";

import { listAccountsByHousehold } from "@nodvis/finance-db";
import { getCurrentSession } from "@/lib/auth/session";
import { getCurrentUserHouseholdsStatus } from "@/lib/authorization/household";
import { listHouseholdCategories } from "@/lib/categories/service";
import { serializeOverview } from "@/lib/overview/serialization";
import { getHouseholdOverview } from "@/lib/overview/service";
import { serializeTransaction } from "@/lib/transactions/serialization";
import { listManualTransactions } from "@/lib/transactions/service";

import { CashFlowSection } from "./components/CashFlowSection";
import { CategorySpendingSection } from "./components/CategorySpendingSection";
import { HouseholdSelectionCard } from "./components/HouseholdSelectionCard";
import { NoHouseholdCard } from "./components/NoHouseholdCard";
import { ObservationWarnings } from "./components/ObservationWarnings";
import { OverviewCards } from "./components/OverviewCards";
import { PeriodHeader } from "./components/PeriodHeader";
import { SignInCard } from "./components/SignInCard";
import { TransactionForms } from "./components/TransactionForms";
import { TransactionList } from "./components/TransactionList";

type HomePageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function HomePage({
  params,
  searchParams,
}: HomePageProps) {
  const { locale } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const monthParam =
    typeof resolvedSearchParams.month === "string"
      ? resolvedSearchParams.month
      : undefined;
  const fromParam =
    typeof resolvedSearchParams.from === "string"
      ? resolvedSearchParams.from
      : undefined;
  const toParam =
    typeof resolvedSearchParams.to === "string"
      ? resolvedSearchParams.to
      : undefined;

  const t = await getTranslations("HomePage");
  const tAccess = await getTranslations("Accessibility");

  const session = await getCurrentSession();
  const householdStatus = session
    ? await getCurrentUserHouseholdsStatus()
    : { status: "unauthenticated" as const };

  const householdContext =
    householdStatus.status === "single" ||
    householdStatus.status === "multiple_selected"
      ? householdStatus.activeContext
      : null;

  const [accounts, categories, rawTransactions, overview] =
    householdContext
      ? await Promise.all([
          listAccountsByHousehold(householdContext.householdId, {
            includeArchived: false,
          }),
          listHouseholdCategories(householdContext, {
            includeArchived: true,
          }),
          listManualTransactions(householdContext, {
            limit: 50,
            offset: 0,
            includeVoided: true,
          }),
          getHouseholdOverview(householdContext, {
            month: monthParam,
            from: fromParam,
            to: toParam,
          }),
        ])
      : [[], [], [], null];

  const serializedTransactions = rawTransactions.map(serializeTransaction);
  const serializedOverview = overview ? serializeOverview(overview) : null;

  const placeholderSummaryCards = [
    { key: "available", label: t("cards.available") },
    { key: "upcoming", label: t("cards.upcoming") },
    { key: "debt", label: t("cards.debt") },
  ] as const;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Calm, professional dashboard overview header */}
      <header className="flex max-w-3xl flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-100 sm:text-3xl">
          {t("title")}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-stone-400 sm:text-base">
          {t("description")}
        </p>
      </header>

      {/* Honest Financial Summary Cards */}
      {serializedOverview ? (
        <OverviewCards overview={serializedOverview} locale={locale} />
      ) : (
        <section
          aria-label={tAccess("financialSummary")}
          className="grid gap-4 sm:grid-cols-3"
        >
          {placeholderSummaryCards.map((card) => (
            <article
              key={card.key}
              className="rounded-2xl border border-stone-800 bg-stone-900/70 p-5 shadow-xs backdrop-blur-xs transition-colors hover:border-stone-700/80"
            >
              <p className="text-xs font-medium uppercase tracking-wider text-stone-400">
                {card.label}
              </p>
              <p className="mt-3 font-mono text-3xl font-semibold tracking-tight text-stone-100">
                —
              </p>
              <p className="mt-2 text-xs text-stone-400">
                {t("noData")}
              </p>
            </article>
          ))}
        </section>
      )}

      {/* Main flow: Unauthenticated, No Household, Multiple Households Needs Selection, or Authenticated Transactions */}
      {!session ? (
        <section aria-label={tAccess("authentication")}>
          <SignInCard />
        </section>
      ) : householdStatus.status === "none" ? (
        <section aria-label={tAccess("household")}>
          <NoHouseholdCard
            email={session.user.email}
            defaultDisplayName={session.user.name ?? undefined}
          />
        </section>
      ) : householdStatus.status === "multiple_needs_selection" ? (
        <section aria-label={tAccess("householdSelection")}>
          <HouseholdSelectionCard
            households={householdStatus.households}
            email={session.user.email}
          />
        </section>
      ) : householdContext && serializedOverview ? (
        <section
          aria-label={tAccess("householdTransactions")}
          className="flex flex-col gap-8"
        >
          {/* Selected Household & Period Header with Add Transaction action */}
          <PeriodHeader
            householdContext={householdContext}
            overview={serializedOverview}
            locale={locale}
          />

          {/* Stale or missing snapshot warning if any */}
          <ObservationWarnings
            overview={serializedOverview}
            locale={locale}
          />

          {/* Truthful Period Cash Flow Metrics */}
          <CashFlowSection
            overview={serializedOverview}
            locale={locale}
          />

          {/* Truthful Period Spending by Category Breakdown */}
          <CategorySpendingSection
            overview={serializedOverview}
            locale={locale}
          />

          {/* Transaction Creation Forms (Expense, Income, Transfer) with anchor */}
          <div id="transaction-forms" aria-label={tAccess("transactionForms")}>
            <TransactionForms
              householdId={householdContext.householdId}
              accounts={accounts}
              categories={categories}
              defaultCurrency={householdContext.defaultCurrency}
              locale={locale}
            />
          </div>

          {/* Transaction List and Empty State */}
          <div aria-label={tAccess("transactionList")}>
            <TransactionList
              transactions={serializedTransactions}
              accounts={accounts}
              categories={categories}
              locale={locale}
              householdId={householdContext.householdId}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
