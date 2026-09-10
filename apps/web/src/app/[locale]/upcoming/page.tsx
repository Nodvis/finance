import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";

import { routing } from "@/i18n/routing";
import { getCurrentSession } from "@/lib/auth/session";
import { getCurrentUserHouseholdsStatus } from "@/lib/authorization/household";
import {
  listHouseholdObligations,
  getHouseholdUpcomingSummary,
} from "@/lib/obligations/service";
import { serializeUpcomingObligationsSummary } from "@/lib/obligations/serialization";

import { HouseholdSelectionCard } from "../components/HouseholdSelectionCard";
import { NoHouseholdCard } from "../components/NoHouseholdCard";
import { SignInCard } from "../components/SignInCard";
import { UpcomingView } from "./UpcomingView";

type UpcomingPageProps = { params: Promise<{ locale: string }> };

export default async function UpcomingPage({ params }: UpcomingPageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const session = await getCurrentSession();
  if (!session) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <SignInCard />
      </div>
    );
  }

  const status = await getCurrentUserHouseholdsStatus();
  if (status.status === "none") {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <NoHouseholdCard
          email={session.user.email}
          defaultDisplayName={session.user.name}
        />
      </div>
    );
  }
  if (status.status === "multiple_needs_selection") {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <HouseholdSelectionCard
          households={status.households}
          email={session.user.email}
        />
      </div>
    );
  }
  if (status.status !== "single" && status.status !== "multiple_selected") {
    return null;
  }

  const context = status.activeContext;
  const [obligations, rawSummary] = await Promise.all([
    listHouseholdObligations(context),
    getHouseholdUpcomingSummary(context),
  ]);

  const summary = serializeUpcomingObligationsSummary(rawSummary);

  return (
    <UpcomingView
      householdContext={context}
      initialObligations={obligations}
      initialSummary={summary}
      locale={locale}
    />
  );
}
