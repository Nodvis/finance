import { and, asc, eq } from "drizzle-orm";
import {
  DEFAULT_POLISH_CATEGORIES,
  createHousehold,
  createPerson,
  generateDefaultCategoryId,
  householdId as toHouseholdId,
  personId as toPersonId,
} from "@nodvis/finance-domain";

import { getDb } from "../client";
import { authUsers } from "../schema/auth";
import { categories } from "../schema/categories";
import {
  householdMemberships,
  households,
  personAuthLinks,
  persons,
} from "../schema/foundation";
import { instanceState } from "../schema/instance";
import { InstanceAlreadyInitializedError } from "./instance";

export type HouseholdAccessSummary = {
  householdId: string;
  personId: string;
  householdName: string;
  defaultCurrency: string;
  personDisplayName: string;
};

export type HouseholdMemberSummary = {
  personId: string;
  displayName: string;
  joinedAt: Date;
};

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

export async function listHouseholdsForAuthUser(
  authUserId: string,
): Promise<HouseholdAccessSummary[]> {
  return await getDb()
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
    .orderBy(asc(households.name));
}

export async function listHouseholdMembers(
  householdId: string,
): Promise<HouseholdMemberSummary[]> {
  return await getDb()
    .select({
      personId: persons.id,
      displayName: persons.displayName,
      joinedAt: householdMemberships.createdAt,
    })
    .from(householdMemberships)
    .innerJoin(
      persons,
      eq(householdMemberships.personId, persons.id),
    )
    .where(eq(householdMemberships.householdId, householdId))
    .orderBy(asc(persons.displayName));
}

export async function findHouseholdForAuthUser(
  authUserId: string,
  householdId: string,
): Promise<HouseholdAccessSummary | null> {
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
    .where(
      and(
        eq(personAuthLinks.authUserId, authUserId),
        eq(householdMemberships.householdId, householdId),
      ),
    )
    .limit(1);

  return access ?? null;
}

/**
 * Resolves the default household for a user:
 * - If selectedHouseholdId is specified, returns that household if the user has access.
 * - If selectedHouseholdId is NOT specified:
 *   - If user belongs to exactly 1 household, returns that household.
 *   - If user belongs to > 1 households, returns null to avoid silently picking.
 *   - If user belongs to 0 households, returns null.
 */
export async function findDefaultHouseholdForAuthUser(
  authUserId: string,
  selectedHouseholdId?: string,
): Promise<HouseholdAccessSummary | null> {
  if (selectedHouseholdId) {
    return await findHouseholdForAuthUser(authUserId, selectedHouseholdId);
  }

  const allHouseholds = await listHouseholdsForAuthUser(authUserId);
  if (allHouseholds.length === 1) {
    return allHouseholds[0]!;
  }
  // When 0 or > 1 households exist, do NOT silently pick!
  return null;
}

export type CreateHouseholdOnboardingInput = {
  authUserId: string;
  householdName: string;
  defaultCurrency: string;
  personDisplayName?: string | undefined;
  bootstrap?: boolean | undefined;
};

/**
 * Creates a household for a signed-in user transactionally.
 * Safe retry:
 * - Reuses existing person if the auth user already has a linked person.
 * - Preserves existing household memberships without duplicating.
 * - Ensures either all records (household + membership) commit or none do.
 */
export async function createHouseholdOnboarding(
  input: CreateHouseholdOnboardingInput,
): Promise<HouseholdAccessSummary> {
  const db = getDb();

  return await db.transaction(async (tx) => {
    if (input.bootstrap) {
      const [state] = await tx
        .select({ initializedAt: instanceState.initializedAt })
        .from(instanceState)
        .where(eq(instanceState.id, 1))
        .for("update")
        .limit(1);
      if (!state || state.initializedAt !== null) {
        throw new InstanceAlreadyInitializedError();
      }
    }

    // 1. Ensure person & personAuthLink exist for this auth user
    let personId: string;
    let personDisplayName: string;

    const [existingLink] = await tx
      .select({
        personId: personAuthLinks.personId,
        displayName: persons.displayName,
      })
      .from(personAuthLinks)
      .innerJoin(persons, eq(personAuthLinks.personId, persons.id))
      .where(eq(personAuthLinks.authUserId, input.authUserId))
      .limit(1);

    if (existingLink) {
      personId = existingLink.personId;
      personDisplayName = existingLink.displayName;

      // A retry after the first successful submission must resolve to the
      // existing household instead of creating a duplicate household.
      const [existingMembership] = await tx
        .select({ householdId: householdMemberships.householdId })
        .from(householdMemberships)
        .where(eq(householdMemberships.personId, personId))
        .orderBy(asc(householdMemberships.createdAt))
        .limit(1);
      if (existingMembership) {
        if (input.bootstrap) {
          throw new InstanceAlreadyInitializedError();
        }
        const [existingHousehold] = await tx
          .select({
            householdId: households.id,
            householdName: households.name,
            defaultCurrency: households.defaultCurrency,
          })
          .from(households)
          .where(eq(households.id, existingMembership.householdId))
          .limit(1);
        if (existingHousehold && !input.bootstrap) {
          return {
            ...existingHousehold,
            personId,
            personDisplayName,
          };
        }
      }
    } else {
      const [user] = await tx
        .select({
          name: authUsers.name,
          email: authUsers.email,
        })
        .from(authUsers)
        .where(eq(authUsers.id, input.authUserId))
        .limit(1);

      const resolvedDisplayName =
        input.personDisplayName?.trim() ||
        user?.name?.trim() ||
        user?.email?.split("@")[0] ||
        "Household Member";

      const newPersonDomain = createPerson({
        id: toPersonId(crypto.randomUUID()),
        displayName: resolvedDisplayName,
      });

      personId = newPersonDomain.id;
      personDisplayName = newPersonDomain.displayName;

      await tx.insert(persons).values({
        id: personId,
        displayName: personDisplayName,
      });

      await tx.insert(personAuthLinks).values({
        authUserId: input.authUserId,
        personId,
      });
    }

    // 2. Validate and create the household
    const newHouseholdDomain = createHousehold({
      id: toHouseholdId(crypto.randomUUID()),
      name: input.householdName,
      defaultCurrency: input.defaultCurrency,
    });

    await tx.insert(households).values({
      id: newHouseholdDomain.id,
      name: newHouseholdDomain.name,
      defaultCurrency: newHouseholdDomain.defaultCurrency,
    });

    // 3. Create household membership
    await tx.insert(householdMemberships).values({
      householdId: newHouseholdDomain.id,
      personId,
    });

    if (input.bootstrap) {
      await tx
        .update(instanceState)
        .set({ initializedAt: new Date(), ownerAuthUserId: input.authUserId })
        .where(eq(instanceState.id, 1));
    }

    // 4. Seed modest Polish default categories for the new household
    for (const def of DEFAULT_POLISH_CATEGORIES) {
      const stableId = generateDefaultCategoryId(newHouseholdDomain.id, def.key);
      await tx
        .insert(categories)
        .values({
          id: stableId,
          householdId: newHouseholdDomain.id,
          name: def.name,
          applicability: def.applicability,
          archivedAt: null,
        })
        .onConflictDoNothing();
    }

    return {
      householdId: newHouseholdDomain.id,
      householdName: newHouseholdDomain.name,
      defaultCurrency: newHouseholdDomain.defaultCurrency,
      personId,
      personDisplayName,
    };
  });
}
