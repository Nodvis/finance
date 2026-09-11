import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";

import { routing } from "@/i18n/routing";
import { getCurrentSession } from "@/lib/auth/session";
import { getCurrentUserHouseholdsStatus } from "@/lib/authorization/household";
import {
  listHouseholdObligations,
  getHouseholdUpcomingSummary,
} from "@/lib/obligations/service";
import { obligationQuerySchema } from "@/lib/obligations/schema";
import { serializeUpcomingObligationsSummary } from "@/lib/obligations/serialization";

import { HouseholdSelectionCard } from "../components/HouseholdSelectionCard";
import { NoHouseholdCard } from "../components/NoHouseholdCard";
import { SignInCard } from "../components/SignInCard";
import { UpcomingView } from "./UpcomingView";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

type UpcomingPageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{
    status?: string | string[];
    currency?: string | string[];
    sortOrder?: string | string[];
    offset?: string | string[];
  }>;
};

function firstSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function UpcomingPage({
  params,
  searchParams,
}: UpcomingPageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const queryResult = obligationQuerySchema.safeParse({
    status: firstSearchParam(resolvedSearchParams?.status),
    currency: firstSearchParam(resolvedSearchParams?.currency),
    sortOrder: firstSearchParam(resolvedSearchParams?.sortOrder),
    offset: firstSearchParam(resolvedSearchParams?.offset),
    limit: PAGE_SIZE + 1,
  });
  const query = queryResult.success
    ? queryResult.data
    : obligationQuerySchema.parse({ limit: PAGE_SIZE + 1, offset: 0 });

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
    listHouseholdObligations(context, query),
    getHouseholdUpcomingSummary(context),
  ]);

  const summary = serializeUpcomingObligationsSummary(rawSummary);
  const pageObligations = obligations.slice(0, PAGE_SIZE);

  return (
    <UpcomingView
      key={`${query.status ?? "all"}:${query.currency ?? "all"}:${query.sortOrder ?? "default"}`}
      householdContext={context}
      initialObligations={pageObligations}
      initialSummary={summary}
      locale={locale}
      initialStatus={query.status}
      initialCurrency={query.currency}
      initialSortOrder={
        query.sortOrder === "asc" || query.sortOrder === "desc"
          ? query.sortOrder
          : undefined
      }
      initialOffset={query.offset ?? 0}
      initialHasMore={obligations.length > PAGE_SIZE}
    />
  );
}
