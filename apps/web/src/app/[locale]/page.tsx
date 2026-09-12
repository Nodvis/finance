import { getTranslations } from "next-intl/server";

import { isInstanceInitialized, listAccountsByHousehold } from "@nodvis/finance-db";
import { getCurrentSession } from "@/lib/auth/session";
import { getCurrentUserHouseholdsStatus } from "@/lib/authorization/household";
import { listHouseholdCategories } from "@/lib/categories/service";
import { serializeOverview } from "@/lib/overview/serialization";
import { overviewQuerySchema } from "@/lib/overview/schema";
import { getHouseholdOverview } from "@/lib/overview/service";
import { getHouseholdCashForecast } from "@/lib/forecast/service";
import { serializeTransaction } from "@/lib/transactions/serialization";
import { listManualTransactions } from "@/lib/transactions/service";

import { CashFlowSection } from "./components/CashFlowSection";
import { ForecastSection } from "./components/ForecastSection";
import { CategorySpendingSection } from "./components/CategorySpendingSection";
import { HouseholdSelectionCard } from "./components/HouseholdSelectionCard";
import { NoHouseholdCard } from "./components/NoHouseholdCard";
import { ObservationWarnings } from "./components/ObservationWarnings";
import { OverviewCards } from "./components/OverviewCards";
import { PeriodHeader } from "./components/PeriodHeader";
import { SignInCard } from "./components/SignInCard";
import { SetupWizard } from "./components/SetupWizard";
import { TransactionForms } from "./components/TransactionForms";
import { TransactionList } from "./components/TransactionList";
import { OverviewCharts } from "./components/OverviewCharts";

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
  const overviewQueryResult = overviewQuerySchema.safeParse({
    month: monthParam,
    from: fromParam,
    to: toParam,
  });
  const overviewQuery = overviewQueryResult.success
    ? overviewQueryResult.data
    : overviewQuerySchema.parse({});

  const t = await getTranslations("HomePage");
  const tForecast = await getTranslations("HomePage.forecast");
  const tAccess = await getTranslations("Accessibility");

  const session = await getCurrentSession();

  // 1. Unauthenticated presentation: strictly public hero and sign-in card.
  // Shows NO dashboard metrics, NO authenticated navigation, NO household bars, and NO admin copy.
  if (!session) {
    const instanceInitialized = await isInstanceInitialized();
    if (!instanceInitialized) {
      return <SetupWizard locale={locale} />;
    }
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col items-center justify-center gap-8 px-4 py-12 sm:px-6 lg:py-16">
        <section aria-label={tAccess("publicShell")} className="w-full text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-stone-100">
            {t("publicHeroTitle")}
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-stone-400">
            {t("publicHeroSubtitle")}
          </p>
        </section>

        <section aria-label={tAccess("authentication")} className="w-full">
          <SignInCard />
        </section>
      </div>
    );
  }

  // 2. Authenticated user status check
  const householdStatus = await getCurrentUserHouseholdsStatus();

  // 3. User with no household (onboarding)
  if (householdStatus.status === "none") {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <section aria-label={tAccess("household")}>
          <NoHouseholdCard
            email={session.user.email}
            defaultDisplayName={session.user.name ?? undefined}
          />
        </section>
      </div>
    );
  }

  // 4. User with multiple households needing selection
  if (householdStatus.status === "multiple_needs_selection") {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <section aria-label={tAccess("householdSelection")}>
          <HouseholdSelectionCard
            households={householdStatus.households}
            email={session.user.email}
          />
        </section>
      </div>
    );
  }

  if (householdStatus.status !== "single" && householdStatus.status !== "multiple_selected") {
    return null;
  }

  // 5. User with active household context: load truthful overview and financial data
  const householdContext = householdStatus.activeContext;

  const [accounts, categories, rawTransactions, overview, forecast] = await Promise.all([
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
      month: overviewQuery.month,
      from: overviewQuery.from,
      to: overviewQuery.to,
    }),
    getHouseholdCashForecast(householdContext, {
      asOf: new Date().toISOString().slice(0, 10),
      horizonDays: 7,
    }),
  ]);

  const serializedTransactions = rawTransactions.map(serializeTransaction);
  const serializedOverview = overview ? serializeOverview(overview) : null;

  return (
    <main className="mx-auto flex w-full max-w-[92rem] flex-col gap-7 px-4 py-7 sm:px-6 lg:px-10 lg:py-9">
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-[var(--border)] pb-6">
        <div>
          <p className="finance-eyebrow text-[var(--finance-signal-dark)] dark:text-[var(--finance-signal)]">
            {t("eyebrow")}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-4xl">
            {t("title")}
          </h1>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-[var(--muted-foreground)]">
          <span className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 font-medium text-[var(--foreground)]">
            {householdContext.defaultCurrency}
          </span>
          <a
            href="#transaction-list"
            className="rounded-lg bg-[var(--foreground)] px-3 py-1.5 font-semibold text-[var(--surface)] transition hover:opacity-80"
          >
            {t("quickActions.viewTransactions")}
          </a>
        </div>
      </header>

      {/* Honest Financial Summary Cards */}
      {serializedOverview ? (
        <OverviewCards overview={serializedOverview} locale={locale} />
      ) : null}

      <ForecastSection
        forecast={forecast}
        locale={locale}
        labels={{
          title: tForecast("title"),
          subtitle: tForecast("subtitle"),
          horizon: tForecast("horizon"),
          days: tForecast("days"),
          available: tForecast("available"),
          obligations: tForecast("obligations"),
          projected: tForecast("projected"),
          incomplete: tForecast("incomplete"),
          included: tForecast("included"),
        }}
      />

      {serializedOverview ? <OverviewCharts flows={serializedOverview.cashFlow.byCurrency} categories={serializedOverview.categorySpending} locale={locale} labels={{ cashFlow: t("charts.cashFlow"), income: t("charts.income"), spending: t("charts.spending"), net: t("charts.net"), spendingBreakdown: t("charts.spendingBreakdown"), empty: t("charts.empty"), spendingDescription: t("charts.spendingDescription"), uncategorized: t("charts.uncategorized") }} /> : null}

      {/* Authenticated Finance Workspace */}
      {serializedOverview && (
        <section
          aria-label={tAccess("householdTransactions")}
          className="flex flex-col gap-6"
        >
          {/* Selected Period Header with Navigation */}
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

          {/* Focused transaction addition flow */}
          <details
            id="transaction-forms"
            className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition-all dark:border-stone-800 dark:bg-stone-900/50"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-slate-800 dark:text-stone-100">
              <span className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white dark:bg-emerald-400 dark:text-stone-950">
                  +
                </span>
                {t("quickActions.addTransaction")}
              </span>
              <span className="text-xs text-slate-500 transition-transform group-open:rotate-180 dark:text-stone-400">
                ▼
              </span>
            </summary>
            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-stone-800">
              <TransactionForms
                householdId={householdContext.householdId}
                accounts={accounts}
                categories={categories}
                defaultCurrency={householdContext.defaultCurrency}
                locale={locale}
              />
            </div>
          </details>

          {/* Truthful Period Spending by Category Breakdown */}
          <CategorySpendingSection
            overview={serializedOverview}
            locale={locale}
          />

          {/* Transaction List and Empty State */}
          <div id="transaction-list" aria-label={tAccess("transactionList")}>
            <TransactionList
              transactions={serializedTransactions}
              accounts={accounts}
              categories={categories}
              locale={locale}
              householdId={householdContext.householdId}
            />
          </div>
        </section>
      )}
    </main>
  );
}
