import "server-only";

import {
  findAccountInHousehold,
  findLiabilityById,
  isPersonInHousehold,
  listAccountsByHousehold,
  listHouseholdBalanceObservations,
  listLiabilitiesByHousehold,
  recordAccountBalanceObservation,
  recordLiabilityBalanceObservation,
  AccountNotFoundError,
  LiabilityNotFoundError,
  type BalanceObservationRecord,
} from "@nodvis/finance-db";
import {
  calculateHistoricalNetWorthSeries,
  type AccountType,
  type HistoricalSeriesObservation,
  type HistoricalSeriesSubject,
  type NetWorthHistorySummary,
} from "@nodvis/finance-domain";

import { HouseholdAccessDeniedError } from "@/lib/authorization/household";
import type { AuthorizedHouseholdContext } from "@/lib/overview/service";
import { parseAccountBalanceToMinor } from "@/lib/transactions/money-entry";
import type { NetWorthQuery, RecordBalanceObservationInput } from "./schema";

export async function getHouseholdNetWorthSummary(
  context: AuthorizedHouseholdContext,
  query?: NetWorthQuery,
): Promise<NetWorthHistorySummary> {
  const isMember = await isPersonInHousehold(context.householdId, context.personId);
  if (!isMember) {
    throw new HouseholdAccessDeniedError(
      `Person ${context.personId} is not a member of household ${context.householdId}`,
    );
  }

  const asOf = query?.to
    ? new Date(query.to)
    : query?.asOf
      ? new Date(query.asOf)
      : new Date();
  const from = query?.from ? new Date(query.from) : null;

  const [accountRows, liabilityRows, rawObservations] = await Promise.all([
    listAccountsByHousehold(context.householdId, { includeArchived: false }),
    listLiabilitiesByHousehold(context.householdId, { includeArchived: false }),
    listHouseholdBalanceObservations(context.householdId, {
      to: asOf,
    }),
  ]);

  const subjects: HistoricalSeriesSubject[] = [
    ...accountRows.map((a) => ({
      id: a.id,
      name: a.name,
      kind: "account" as const,
      accountType: a.type as AccountType,
      currency: a.currency,
      archivedAt: a.archivedAt,
    })),
    ...liabilityRows.map((l) => ({
      id: l.id,
      name: l.name,
      kind: "liability" as const,
      currency: l.currency,
      archivedAt: l.archivedAt,
    })),
  ];

  const observations: HistoricalSeriesObservation[] = rawObservations.map((o) => ({
    id: o.id,
    subjectId: (o.accountId ?? o.liabilityId)!,
    subjectKind: o.accountId ? "account" : "liability",
    amountMinor: o.amountMinor,
    currency: o.currency,
    observedAt: o.observedAt,
    createdAt: o.createdAt,
    source: o.source,
    note: o.note,
  }));

  return calculateHistoricalNetWorthSeries({
    subjects,
    observations,
    asOf,
    ...(from
      ? { dates: [from.toISOString().slice(0, 10), asOf.toISOString().slice(0, 10)] }
      : {}),
  });
}

export async function recordHouseholdBalanceObservation(
  context: AuthorizedHouseholdContext,
  input: RecordBalanceObservationInput,
): Promise<BalanceObservationRecord> {
  const isMember = await isPersonInHousehold(context.householdId, context.personId);
  if (!isMember) {
    throw new HouseholdAccessDeniedError(
      `Person ${context.personId} is not a member of household ${context.householdId}`,
    );
  }

  const observedDate = new Date(input.observedAt);
  if (Number.isNaN(observedDate.getTime())) {
    throw new Error("Invalid observation date");
  }

  if (input.subjectType === "account") {
    const account = await findAccountInHousehold(context.householdId, input.subjectId);
    if (!account) {
      throw new AccountNotFoundError(`Account ${input.subjectId} not found in household`);
    }

    const parsed = parseAccountBalanceToMinor(input.amountNatural, account.currency);
    if (!parsed.success || parsed.amountMinor === null) {
      throw new Error(`Invalid balance format: ${parsed.error ?? "invalid_format"}`);
    }

    return await recordAccountBalanceObservation({
      householdId: context.householdId,
      accountId: account.id,
      amountMinor: parsed.amountMinor,
      currency: account.currency,
      observedAt: observedDate,
      source: "manual",
      note: input.note ?? null,
    });
  }

  if (input.subjectType === "liability") {
    const liability = await findLiabilityById(context.householdId, input.subjectId);
    if (!liability) {
      throw new LiabilityNotFoundError(`Liability ${input.subjectId} not found in household`);
    }

    const parsed = parseAccountBalanceToMinor(input.amountNatural, liability.currency);
    if (!parsed.success || parsed.amountMinor === null || parsed.amountMinor < 0n) {
      throw new Error("Invalid liability amount: liability debt must be non-negative");
    }

    return await recordLiabilityBalanceObservation({
      householdId: context.householdId,
      liabilityId: liability.id,
      amountMinor: parsed.amountMinor,
      currency: liability.currency,
      observedAt: observedDate,
      source: "manual",
      note: input.note ?? null,
    });
  }

  throw new Error("Invalid subject type: must be 'account' or 'liability'");
}

export async function listHouseholdBalanceHistory(
  context: AuthorizedHouseholdContext,
  options?: {
    accountId?: string | undefined;
    liabilityId?: string | undefined;
    limit?: number | undefined;
  },
): Promise<BalanceObservationRecord[]> {
  const isMember = await isPersonInHousehold(context.householdId, context.personId);
  if (!isMember) {
    throw new HouseholdAccessDeniedError(
      `Person ${context.personId} is not a member of household ${context.householdId}`,
    );
  }

  return await listHouseholdBalanceObservations(context.householdId, options);
}
