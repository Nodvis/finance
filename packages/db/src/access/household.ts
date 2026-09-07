import { and, eq } from "drizzle-orm";

import { getDb } from "../client";
import {
  householdMemberships,
  households,
  personAuthLinks,
  persons,
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

export async function isPersonInHousehold(
  householdId: string,
  personId: string,
): Promise<boolean> {
  const [membership] = await getDb()
    .select({ personId: householdMemberships.personId })
    .from(householdMemberships)
    .where(
      and(
        eq(householdMemberships.householdId, householdId),
        eq(householdMemberships.personId, personId),
      ),
    )
    .limit(1);

  return Boolean(membership);
}

export async function findDefaultHouseholdForAuthUser(authUserId: string) {
  const [access] = await getDb()
    .select({
      householdId: householdMemberships.householdId,
      personId: householdMemberships.personId,
      householdName: households.name,
      defaultCurrency: households.defaultCurrency,
      personDisplayName: persons.displayName,
    })
    .from(personAuthLinks)
    .innerJoin(
      householdMemberships,
      eq(personAuthLinks.personId, householdMemberships.personId),
    )
    .innerJoin(
      households,
      eq(householdMemberships.householdId, households.id),
    )
    .innerJoin(
      persons,
      eq(householdMemberships.personId, persons.id),
    )
    .where(eq(personAuthLinks.authUserId, authUserId))
    .limit(1);

  return access ?? null;
}
