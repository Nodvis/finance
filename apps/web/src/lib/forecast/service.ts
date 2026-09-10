import "server-only";

import { getHouseholdEligibleAccounts, isPersonInHousehold, listObligationsByHousehold, materializeRecurringObligationsInDb } from "@nodvis/finance-db";
import { aggregateAvailableCash, accountId as toAccountId, calculateCashForecast, money, type CashForecast } from "@nodvis/finance-domain";
import type { AuthorizedHouseholdContext } from "@/lib/overview/service";

export async function getHouseholdCashForecast(
  context: AuthorizedHouseholdContext,
  options: { asOf: string; horizonDays: 7 | 30 },
): Promise<CashForecast> {
  if (!(await isPersonInHousehold(context.householdId, context.personId))) {
    throw new Error("Household access denied");
  }

  await materializeRecurringObligationsInDb(context.householdId, forecastEndDate(options.asOf, options.horizonDays), options.asOf);
  const accounts = await getHouseholdEligibleAccounts(context.householdId);
  const cash = aggregateAvailableCash(accounts.map((account) => ({
    id: toAccountId(account.id),
    name: account.name,
    type: account.type,
    currency: account.currency,
    balanceSnapshot: account.balanceSnapshotMinor !== null && account.balanceSnapshotAt !== null
      ? { balance: money(account.balanceSnapshotMinor, account.currency), capturedAt: account.balanceSnapshotAt }
      : null,
    archivedAt: null,
  })), { asOf: new Date(`${options.asOf}T23:59:59.999Z`) });
  const obligations = await listObligationsByHousehold(context.householdId, {
    status: "active",
    today: options.asOf,
    dueFrom: options.asOf,
    dueTo: forecastEndDate(options.asOf, options.horizonDays),
  });

  return calculateCashForecast({
    asOf: options.asOf,
    horizonDays: options.horizonDays,
    availableCash: cash.byCurrency.map((item) => ({ currency: item.currency, amountMinor: item.amountMinor, isComplete: item.isComplete })),
    obligations: obligations.map((item) => ({ currency: item.currency, amountMinor: item.amountMinor, dueDate: item.dueDate, status: item.status })),
  });
}

export async function getHouseholdForecastObligations(
  context: AuthorizedHouseholdContext,
  options: { asOf: string; horizonDays: 7 | 30 },
) {
  if (!(await isPersonInHousehold(context.householdId, context.personId))) {
    throw new Error("Household access denied");
  }
  return listObligationsByHousehold(context.householdId, {
    status: "active",
    today: options.asOf,
    dueFrom: options.asOf,
    dueTo: forecastEndDate(options.asOf, options.horizonDays),
  });
}

function forecastEndDate(asOf: string, horizonDays: 7 | 30): string {
  const date = new Date(`${asOf}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + horizonDays);
  return date.toISOString().slice(0, 10);
}
