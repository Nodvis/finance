import { and, eq } from "drizzle-orm";

import { getDb } from "../client";
import {
  householdMemberships,
  personAuthLinks,
} from "../schema/foundation";

export async function findHouseholdAccessForAuthUser(
  authUserId: string,
  householdId: string,
) {
  const [access] = await getDb()
    .select({
      householdId: householdMemberships.householdId,
      personId: householdMemberships.personId,
    })
    .from(personAuthLinks)
    .innerJoin(
      householdMemberships,
      eq(personAuthLinks.personId, householdMemberships.personId),
    )
    .where(
      and(
        eq(personAuthLinks.authUserId, authUserId),
        eq(householdMemberships.householdId, householdId),
      ),
    )
    .limit(1);

  return access ?? null;
}
