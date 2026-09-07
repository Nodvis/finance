import { and, eq } from "drizzle-orm";

import { getDb } from "../client";
import { accounts } from "../schema/foundation";

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
