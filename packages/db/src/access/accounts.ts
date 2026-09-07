import { and, asc, eq } from "drizzle-orm";
import type { ACCOUNT_TYPES } from "@nodvis/finance-domain";

import { getDb } from "../client";
import { accounts } from "../schema/foundation";

export type HouseholdAccountSummary = {
  id: string;
  householdId: string;
  name: string;
  type: (typeof ACCOUNT_TYPES)[number];
  currency: string;
};

export async function findAccountInHousehold(
  householdId: string,
  accountId: string,
) {
  const [account] = await getDb()
    .select({
      id: accounts.id,
      householdId: accounts.householdId,
      name: accounts.name,
      type: accounts.type,
      currency: accounts.currency,
      balanceSnapshotMinor: accounts.balanceSnapshotMinor,
      balanceSnapshotAt: accounts.balanceSnapshotAt,
    })
    .from(accounts)
    .where(
      and(
        eq(accounts.householdId, householdId),
        eq(accounts.id, accountId),
      ),
    )
    .limit(1);

  return account ?? null;
}

export async function listAccountsByHousehold(
  householdId: string,
): Promise<HouseholdAccountSummary[]> {
  return await getDb()
    .select({
      id: accounts.id,
      householdId: accounts.householdId,
      name: accounts.name,
      type: accounts.type,
      currency: accounts.currency,
    })
    .from(accounts)
    .where(eq(accounts.householdId, householdId))
    .orderBy(asc(accounts.name));
}
