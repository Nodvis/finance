import { getTranslations } from "next-intl/server";

import { listAccountsByHousehold } from "@nodvis/finance-db";
import { getCurrentSession } from "@/lib/auth/session";
import { getCurrentUserHouseholdContext } from "@/lib/authorization/household";
import { serializeTransaction } from "@/lib/transactions/serialization";
import { listManualTransactions } from "@/lib/transactions/service";

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
  const tHousehold = await getTranslations("Household");

  const session = await getCurrentSession();
  const householdContext = session
    ? await getCurrentUserHouseholdContext()
    : null;

  const accounts = householdContext
    ? await listAccountsByHousehold(householdContext.householdId)
    : [];

  const rawTransactions = householdContext
    ? await listManualTransactions(householdContext, { limit: 50, offset: 0 })
    : [];

  const serializedTransactions = rawTransactions.map(serializeTransaction);

  const summaryCards = [
    { key: "available", label: t("cards.available") },
    { key: "upcoming", label: t("cards.upcoming") },
    { key: "debt", label: t("cards.debt") },
  ] as const;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-5 py-10 sm:px-8 lg:px-12">
      <header className="flex max-w-3xl flex-col gap-3">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500 dark:text-stone-400">
          {t("eyebrow")}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          {t("title")}
        </h1>
        <p className="max-w-2xl text-base leading-7 text-stone-600 dark:text-stone-300">
          {t("description")}
        </p>
      </header>

      {/* Financial Summary Cards */}
      <section
        aria-label={t("summaryLabel")}
        className="grid gap-4 md:grid-cols-3"
      >
        {summaryCards.map((card) => (
          <article
            key={card.key}
            className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900"
          >
            <p className="text-sm font-medium text-stone-500 dark:text-stone-400">
              {card.label}
            </p>
            <p className="mt-5 text-3xl font-semibold">—</p>
            <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
              {t("noData")}
            </p>
          </article>
        ))}
      </section>

      {/* Authenticated Flow */}
      {!session ? (
        <section aria-label="Authentication">
          <SignInCard />
        </section>
      ) : !householdContext ? (
        <section aria-label="Household">
          <NoHouseholdCard email={session.user.email} />
        </section>
      ) : (
        <section aria-label="Household Transactions" className="flex flex-col gap-8">
          {/* Household Context Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-800 dark:bg-stone-900/50">
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <div>
                <span className="text-stone-500 dark:text-stone-400">
                  {tHousehold("label")}:{" "}
                </span>
                <span className="font-semibold text-stone-900 dark:text-stone-100">
                  {householdContext.householdName}
                </span>
              </div>
              <div>
                <span className="text-stone-500 dark:text-stone-400">
                  {tHousehold("member")}:{" "}
                </span>
                <span className="font-medium text-stone-900 dark:text-stone-100">
                  {householdContext.personDisplayName}
                </span>
              </div>
              <div>
                <span className="text-stone-500 dark:text-stone-400">
                  {tHousehold("currency")}:{" "}
                </span>
                <span className="font-semibold text-stone-900 dark:text-stone-100">
                  {householdContext.defaultCurrency}
                </span>
              </div>
            </div>
            <SignOutButton />
          </div>

          {/* Transaction Creation Forms (Expense, Income, Transfer) */}
          <TransactionForms
            householdId={householdContext.householdId}
            accounts={accounts}
            defaultCurrency={householdContext.defaultCurrency}
            locale={locale}
          />

          {/* Transaction List and Empty State */}
          <TransactionList
            transactions={serializedTransactions}
            accounts={accounts}
            locale={locale}
          />
        </section>
      )}
    </main>
  );
}
