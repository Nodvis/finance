import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";

import { routing } from "@/i18n/routing";
import { getCurrentSession } from "@/lib/auth/session";
import { getCurrentUserHouseholdsStatus } from "@/lib/authorization/household";
import {
  getHouseholdTransferCandidates,
  listReconciledTransfers,
  serializeReconciledTransfer,
} from "@/lib/transfers/service";
import { HouseholdSelectionCard } from "../components/HouseholdSelectionCard";
import { NoHouseholdCard } from "../components/NoHouseholdCard";
import { SignInCard } from "../components/SignInCard";
import { TransfersView } from "./TransfersView";

type TransfersPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function TransfersPage({ params }: TransfersPageProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const session = await getCurrentSession();
  if (!session) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <SignInCard />
      </div>
    );
  }

  const status = await getCurrentUserHouseholdsStatus();

  if (status.status === "none") {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <NoHouseholdCard
          email={session.user.email}
          defaultDisplayName={session.user.name}
        />
      </div>
    );
  }

  if (status.status === "multiple_needs_selection") {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <HouseholdSelectionCard
          households={status.households}
          email={session.user.email}
        />
      </div>
    );
  }

  if (status.status === "single" || status.status === "multiple_selected") {
    const activeContext = status.activeContext;
    const allHouseholds =
      status.status === "multiple_selected"
        ? status.households
        : [
            {
              householdId: activeContext.householdId,
              personId: activeContext.personId,
              householdName: activeContext.householdName,
              defaultCurrency: activeContext.defaultCurrency,
              personDisplayName: activeContext.personDisplayName,
            },
          ];

    const [summary, reconciledRecords] = await Promise.all([
      getHouseholdTransferCandidates(activeContext),
      listReconciledTransfers(activeContext, { limit: 100 }),
    ]);

    const serializedReconciled = reconciledRecords.map(serializeReconciledTransfer);

    return (
      <TransfersView
        householdContext={activeContext}
        allHouseholds={allHouseholds}
        initialSummary={summary}
        initialReconciled={serializedReconciled}
        locale={locale}
      />
    );
  }

  return null;
}
