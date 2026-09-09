import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";

import { routing } from "@/i18n/routing";
import { getCurrentSession } from "@/lib/auth/session";
import { getCurrentUserHouseholdsStatus } from "@/lib/authorization/household";
import { listHouseholdAccountsSummary } from "@/lib/accounts/service";
import { serializeAccount } from "@/lib/accounts/serialization";
import {
  getHouseholdLiability,
  listHouseholdLiabilityRepayments,
} from "@/lib/liabilities/service";
import {
  serializeLiability,
  serializeRepayment,
} from "@/lib/liabilities/serialization";

import { HouseholdSelectionCard } from "../../components/HouseholdSelectionCard";
import { NoHouseholdCard } from "../../components/NoHouseholdCard";
import { SignInCard } from "../../components/SignInCard";
import { LiabilityDetailView } from "./LiabilityDetailView";

type Props = {
  params: Promise<{ locale: string; liabilityId: string }>;
};

export default async function LiabilityDetailPage({ params }: Props) {
  const { locale, liabilityId } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const session = await getCurrentSession();
  if (!session) return <div className="mx-auto w-full max-w-6xl px-4 py-8"><SignInCard /></div>;

  const status = await getCurrentUserHouseholdsStatus();
  if (status.status === "none") {
    return <div className="mx-auto w-full max-w-6xl px-4 py-8"><NoHouseholdCard email={session.user.email} defaultDisplayName={session.user.name} /></div>;
  }
  if (status.status === "multiple_needs_selection") {
    return <div className="mx-auto w-full max-w-6xl px-4 py-8"><HouseholdSelectionCard households={status.households} email={session.user.email} /></div>;
  }
  if (status.status !== "single" && status.status !== "multiple_selected") return null;

  const context = status.activeContext;
  const liability = await getHouseholdLiability(context, liabilityId);
  const [repayments, accounts] = await Promise.all([
    listHouseholdLiabilityRepayments(context, liabilityId, { includeVoided: true }),
    listHouseholdAccountsSummary(context),
  ]);

  return (
    <LiabilityDetailView
      householdId={context.householdId}
      locale={locale}
      initialLiability={serializeLiability(liability)}
      initialRepayments={repayments.map(serializeRepayment)}
      accounts={accounts.map(serializeAccount)}
    />
  );
}
