import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { getCurrentSession } from "@/lib/auth/session";
import { getCurrentUserHouseholdsStatus } from "@/lib/authorization/household";
import { listHouseholdCategories } from "@/lib/categories/service";
import { serializeCategory } from "@/lib/categories/serialization";
import { listHouseholdCategorizationRules } from "@/lib/categorization-rules/service";
import { listTransactionsByHousehold } from "@nodvis/finance-db";
import { serializeTransaction } from "@/lib/transactions/serialization";
import { HouseholdSelectionCard } from "../components/HouseholdSelectionCard";
import { NoHouseholdCard } from "../components/NoHouseholdCard";
import { SignInCard } from "../components/SignInCard";
import { RulesView } from "./RulesView";

export default async function RulesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const session = await getCurrentSession();
  if (!session) return <div className="mx-auto w-full max-w-6xl px-4 py-8"><SignInCard /></div>;
  const status = await getCurrentUserHouseholdsStatus();
  if (status.status === "none") return <div className="mx-auto w-full max-w-6xl px-4 py-8"><NoHouseholdCard email={session.user.email} defaultDisplayName={session.user.name} /></div>;
  if (status.status === "multiple_needs_selection") return <div className="mx-auto w-full max-w-6xl px-4 py-8"><HouseholdSelectionCard households={status.households} email={session.user.email} /></div>;
  if (status.status !== "single" && status.status !== "multiple_selected") return null;
  const context = status.activeContext;
  const [rules, categories, transactions] = await Promise.all([
    listHouseholdCategorizationRules(context),
    listHouseholdCategories(context, { includeArchived: true }),
    listTransactionsByHousehold({ householdId: context.householdId, categoryId: "uncategorized", limit: 50 }),
  ]);
  return <RulesView householdContext={context} initialRules={rules} categories={categories.map(serializeCategory)} transactions={transactions.map(serializeTransaction)} />;
}
