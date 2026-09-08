import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { listAccountsByHousehold } from "@nodvis/finance-db";
import { getCurrentSession } from "@/lib/auth/session";
import { getCurrentUserHouseholdsStatus } from "@/lib/authorization/household";
import { listHouseholdCategories } from "@/lib/categories/service";
import { serializeTransaction } from "@/lib/transactions/serialization";
import { listManualTransactions } from "@/lib/transactions/service";

import { HouseholdSelectionCard } from "./components/HouseholdSelectionCard";
import { NoHouseholdCard } from "./components/NoHouseholdCard";
import { SignInCard } from "./components/SignInCard";
import { SignOutButton } from "./components/SignOutButton";
import { TransactionForms } from "./components/TransactionForms";
import { TransactionList } from "./components/TransactionList";

type HomePageProps = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  const t = await getTranslations("HomePage");
  const tNav = await getTranslations("Navigation");
  const tHousehold = await getTranslations("Household");
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

  const accounts = householdContext
    ? await listAccountsByHousehold(householdContext.householdId, {
        includeArchived: false,
      })
    : [];

  const categories = householdContext
    ? await listHouseholdCategories(householdContext, {
        includeArchived: true,
      })
    : [];

  const rawTransactions = householdContext
    ? await listManualTransactions(householdContext, {
        limit: 50,
        offset: 0,
        includeVoided: true,
      })
    : [];

  const serializedTransactions = rawTransactions.map(serializeTransaction);

  const summaryCards = [
    { key: "available", label: t("cards.available") },
    { key: "upcoming", label: t("cards.upcoming") },
    { key: "debt", label: t("cards.debt") },
  ] as const;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Calm, professional dashboard overview header replacing oversized hero */}
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

      {/* Honest Financial Summary Cards preserving snapshot semantics */}
      <section
        aria-label={tAccess("financialSummary")}
        className="grid gap-4 sm:grid-cols-3"
      >
        {summaryCards.map((card) => (
          <article
            key={card.key}
            className="rounded-2xl border border-stone-800 bg-stone-900/70 p-5 shadow-xs backdrop-blur-xs transition-colors hover:border-stone-700/80"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-stone-400">
              {card.label}
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-stone-100 font-mono">
              —
            </p>
            <p className="mt-2 text-xs text-stone-400">
              {t("noData")}
            </p>
          </article>
        ))}
      </section>

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
      ) : householdContext ? (
        <section
          aria-label={tAccess("householdTransactions")}
          className="flex flex-col gap-8"
        >
          {/* Household Context Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-800 bg-stone-900/60 p-4 shadow-xs backdrop-blur-xs">
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <div>
                <span className="text-stone-400">
                  {tHousehold("label")}:{" "}
                </span>
                <span className="font-semibold text-stone-100">
                  {householdContext.householdName}
                </span>
              </div>
              <div>
                <span className="text-stone-400">
                  {tHousehold("member")}:{" "}
                </span>
                <span className="font-medium text-stone-200">
                  {householdContext.personDisplayName}
                </span>
              </div>
              <div>
                <span className="text-stone-400">
                  {tHousehold("currency")}:{" "}
                </span>
                <span className="font-mono font-semibold text-stone-100">
                  {householdContext.defaultCurrency}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
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

          {/* Transaction Creation Forms (Expense, Income, Transfer) */}
          <div aria-label={tAccess("transactionForms")}>
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
