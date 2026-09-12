import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";

import { routing } from "@/i18n/routing";
import { getCurrentSession } from "@/lib/auth/session";
import { getCurrentUserHouseholdsStatus } from "@/lib/authorization/household";
import {
  listAccountsByHousehold,
  listLiabilitiesByHousehold,
} from "@nodvis/finance-db";
import {
  getHouseholdNetWorthSummary,
  listHouseholdBalanceHistory,
} from "@/lib/net-worth/service";
import {
  serializeBalanceObservation,
  serializeNetWorthSummary,
} from "@/lib/net-worth/serialization";

import { HouseholdSelectionCard } from "../components/HouseholdSelectionCard";
import { NoHouseholdCard } from "../components/NoHouseholdCard";
import { SignInCard } from "../components/SignInCard";
import { NetWorthView } from "./NetWorthView";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function NetWorthPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const t = await getTranslations("NetWorth");

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

  const [rawSummary, accounts, rawLiabilities, rawObservations] = await Promise.all([
    getHouseholdNetWorthSummary(context),
    listAccountsByHousehold(context.householdId, { includeArchived: false }),
    listLiabilitiesByHousehold(context.householdId, { includeArchived: false }),
    listHouseholdBalanceHistory(context, { limit: 100 }),
  ]);

  const serializedSummary = serializeNetWorthSummary(rawSummary);
  const serializedObservations = rawObservations.map(serializeBalanceObservation);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <NetWorthView
        householdId={context.householdId}
        summary={serializedSummary}
        accounts={accounts}
        liabilities={rawLiabilities.map((l) => ({
          id: l.id,
          name: l.name,
          kind: l.kind,
          currency: l.currency,
        }))}
        observations={serializedObservations}
        locale={locale}
        labels={{
          title: t("title"),
          subtitle: t("subtitle"),
          netWorth: t("currentNetWorth"),
          assets: t("totalAssets"),
          liabilities: t("totalLiabilities"),
          complete: t("confidence.complete"),
          incomplete: t("confidence.incomplete"),
          missing: t("confidence.missingLabel"),
          explanation: t("calculationExplanation"),
          explanationDetails: t("calculationExplanationDetails"),
          emptyTitle: t("empty.title"),
          emptyDescription: t("empty.description"),
          recordObservation: t("empty.action"),
          historyTitle: t("history.title"),
          colDate: t("history.date"),
          colSubject: t("history.account"),
          colBalance: t("history.balance"),
          colSource: t("history.source"),
          colNote: t("history.note"),
          formTitle: t("form.title"),
          selectSubject: t("form.subject"),
          selectTarget: t("form.target"),
          amountPlaceholder: t("form.amountPlaceholder"),
          amountLabel: t("form.amount"),
          dateLabel: t("form.observedAt"),
          noteLabel: t("form.note"),
          notePlaceholder: t("form.notePlaceholder"),
          cancelButton: t("form.cancel"),
          saveButton: t("form.submit"),
          savingButton: t("form.saving"),
          subjectAccount: t("form.subjectAccount"),
          subjectLiability: t("form.subjectLiability"),
          successMessage: t("form.success"),
          sourceManual: t("history.manual"),
          sourceImported: t("history.imported"),
          sourceReconciled: t("history.reconciled"),
          sourceLegacy: t("history.legacy"),
        }}
      />
    </main>
  );
}
