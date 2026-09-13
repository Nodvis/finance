import { getTranslations } from "next-intl/server";

import { isInstanceInitialized, listAccountsByHousehold } from "@nodvis/finance-db";
import { getCurrentSession } from "@/lib/auth/session";
import { getCurrentUserHouseholdsStatus } from "@/lib/authorization/household";
import { listHouseholdCategories } from "@/lib/categories/service";
import { serializeOverview } from "@/lib/overview/serialization";
import { overviewQuerySchema } from "@/lib/overview/schema";
import { getHouseholdOverview } from "@/lib/overview/service";

import { getHouseholdNetWorthSummary } from "@/lib/net-worth/service";
import { getHouseholdCashForecast } from "@/lib/forecast/service";
import { serializeNetWorthSummary } from "@/lib/net-worth/serialization";
import { serializeTransaction } from "@/lib/transactions/serialization";
import { listManualTransactions } from "@/lib/transactions/service";
import { listHouseholdBudgets } from "@/lib/budgets/service";
import { getHouseholdSavingsGoalsOverview } from "@/lib/savings-goals/service";

import { NetWorthSection } from "./components/NetWorthSection";
import { HouseholdSelectionCard } from "./components/HouseholdSelectionCard";
import { NoHouseholdCard } from "./components/NoHouseholdCard";
import { ObservationWarnings } from "./components/ObservationWarnings";
import { OverviewCards } from "./components/OverviewCards";

import { SignInCard } from "./components/SignInCard";
import { SetupWizard } from "./components/SetupWizard";
import { TransactionForms } from "./components/TransactionForms";
import { OverviewCharts } from "./components/OverviewCharts";
import { DashboardSupportCards } from "./components/DashboardSupportCards";
import { DashboardAddTransactionButton } from "./components/DashboardAddTransactionButton";
import { DashboardEmptyState } from "./components/DashboardEmptyState";
import { ForecastSection } from "./components/ForecastSection";


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

  const tNetWorth = await getTranslations("HomePage.netWorth");
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

  const [accounts, categories, rawTransactions, overview, forecast, rawNetWorth, budgets, goalsOverview] = await Promise.all([
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
    getHouseholdNetWorthSummary(householdContext),
    listHouseholdBudgets(householdContext, {
      month: overviewQuery.month ?? new Date().toISOString().slice(0, 7),
      includeArchived: false,
    }),
    getHouseholdSavingsGoalsOverview(householdContext, new Date().toISOString().slice(0, 10)),
  ]);

  const serializedTransactions = rawTransactions.map(serializeTransaction);
  const serializedOverview = overview ? serializeOverview(overview) : null;
  const serializedNetWorth = rawNetWorth ? serializeNetWorthSummary(rawNetWorth) : null;
  const hasCashFlow = (serializedOverview?.cashFlow.totalTransactionsCount ?? 0) > 0;
  const setupSteps = [
    { label: t("dashboard.setup.account"), complete: accounts.length > 0, href: `/${locale}/accounts` },
    { label: t("dashboard.setup.balance"), complete: (serializedOverview?.availableCash.freshAccountsCount ?? 0) > 0, href: `/${locale}/accounts` },
    { label: t("dashboard.setup.transaction"), complete: serializedTransactions.length > 0, href: `/${locale}/transactions` },
    { label: t("dashboard.setup.budget"), complete: budgets.length > 0, href: `/${locale}/budgets` },
    { label: t("dashboard.setup.goal"), complete: goalsOverview.goals.length > 0, href: `/${locale}/goals` },
  ];

  return (
    <main className="mx-auto flex w-full max-w-[92rem] flex-col gap-6 px-4 py-7 sm:px-6 lg:px-10 lg:py-9">
      <header className="dashboard-header flex flex-wrap items-end justify-between gap-5 border-b border-[var(--border)] pb-6">
        <div>
          <p className="finance-eyebrow text-[var(--finance-signal-dark)] dark:text-[var(--finance-signal)]">{t("eyebrow")}</p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight text-[var(--foreground)] sm:text-5xl">{t("title")}</h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--muted-foreground)]">{t("description")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
          <span className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 font-semibold text-[var(--foreground)]">{householdContext.defaultCurrency}</span>
          <DashboardAddTransactionButton label={t("quickActions.addTransaction")} />
        </div>
      </header>

      <details id="transaction-forms" className="group dashboard-form-disclosure w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-xs transition-all">
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold"><span className="flex items-center gap-2"><span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--finance-signal-dark)] text-xs font-bold text-[var(--foreground)] dark:bg-[var(--finance-signal)]">+</span>{t("quickActions.addTransaction")}</span><span className="text-xs text-[var(--muted-foreground)] transition-transform group-open:rotate-180">▼</span></summary>
        <div className="mt-4 border-t border-[var(--border)] pt-4"><TransactionForms householdId={householdContext.householdId} accounts={accounts} categories={categories} defaultCurrency={householdContext.defaultCurrency} locale={locale} /></div>
      </details>

      {serializedOverview ? <OverviewCards overview={serializedOverview} netWorth={serializedNetWorth} locale={locale} /> : null}

      {serializedOverview && hasCashFlow ? <OverviewCharts flows={serializedOverview.cashFlow.byCurrency} categories={serializedOverview.categorySpending} locale={locale} labels={{ cashFlow: t("charts.cashFlow"), income: t("charts.income"), spending: t("charts.spending"), net: t("charts.net"), spendingBreakdown: t("charts.spendingBreakdown"), empty: t("charts.empty"), spendingDescription: t("charts.spendingDescription"), uncategorized: t("charts.uncategorized") }} /> : null}

      {serializedOverview && !hasCashFlow ? <DashboardEmptyState steps={setupSteps} title={t("dashboard.setup.title")} description={t("dashboard.setup.description")} nextTitle={t("dashboard.emptyVisual.nextTitle")} nextDescription={t("dashboard.emptyVisual.nextDescription")} done={t("dashboard.setup.done")} locale={locale} /> : null}

      {serializedOverview && hasCashFlow ? <DashboardSupportCards overview={serializedOverview} accounts={accounts} budgets={budgets} goals={goalsOverview.goals} transactions={serializedTransactions} locale={locale} labels={{ attention: t("dashboard.attention"), calm: t("dashboard.calm"), account: t("dashboard.setup.account"), balance: t("dashboard.setup.balance"), transaction: t("dashboard.setup.transaction"), budget: t("dashboard.setup.budget"), goal: t("dashboard.setup.goal"), add: t("quickActions.addTransaction"), create: t("dashboard.create"), view: t("dashboard.view"), upcoming: t("dashboard.upcoming"), overdue: t("dashboard.overdue"), missingBalance: t("dashboard.missingBalance"), setupTitle: t("dashboard.setup.title"), setupDescription: t("dashboard.setup.description"), done: t("dashboard.setup.done"), budgets: t("dashboard.budgets"), budgetsEmpty: t("dashboard.budgetsEmpty"), goals: t("dashboard.goals"), goalsEmpty: t("dashboard.goalsEmpty"), recent: t("dashboard.recent"), recentEmpty: t("dashboard.recentEmpty"), allTransactions: t("dashboard.allTransactions"), spent: t("dashboard.spent"), saved: t("dashboard.saved"), target: t("dashboard.target"), income: t("charts.income"), expense: t("charts.spending"), transfer: t("dashboard.transfer") }} /> : null}

      {forecast && hasCashFlow ? <div className="dashboard-forecast-detail"><ForecastSection forecast={forecast} locale={locale} labels={{ title: tForecast("title"), subtitle: tForecast("subtitle"), horizon: tForecast("horizon"), days: tForecast("days"), available: tForecast("available"), obligations: tForecast("obligations"), projected: tForecast("projected"), incomplete: tForecast("incomplete"), included: tForecast("included") }} /></div> : null}

      {serializedNetWorth && hasCashFlow ? <div className="dashboard-secondary-detail"><NetWorthSection summary={serializedNetWorth} locale={locale} labels={{ title: tNetWorth("title"), eyebrow: tNetWorth("eyebrow"), viewDetails: tNetWorth("viewDetails"), assets: tNetWorth("assets"), liabilities: tNetWorth("liabilities"), netWorth: tNetWorth("netWorth"), complete: tNetWorth("complete"), incomplete: tNetWorth("incomplete"), missing: tNetWorth("missing"), explanation: tNetWorth("explanation"), emptyTitle: tNetWorth("emptyTitle"), emptyDescription: tNetWorth("emptyDescription"), recordObservation: tNetWorth("recordObservation") }} /></div> : null}

      {serializedOverview && hasCashFlow ? <ObservationWarnings overview={serializedOverview} locale={locale} /> : null}
    </main>
  );
}
