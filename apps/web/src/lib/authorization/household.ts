import "server-only";

import { z } from "zod";

import {
  findDefaultHouseholdForAuthUser,
  findHouseholdAccessForAuthUser,
} from "@nodvis/finance-db";
import {
  householdId as toHouseholdId,
  personId as toPersonId,
} from "@nodvis/finance-domain";
import type { HouseholdId, PersonId } from "@nodvis/finance-domain";

import { getCurrentSession, requireCurrentSession } from "@/lib/auth/session";

const householdIdInput = z.uuid();

export class HouseholdAccessDeniedError extends Error {
  constructor() {
    super("Household access denied");
    this.name = "HouseholdAccessDeniedError";
  }
}

export type AuthorizedHouseholdUserContext = Readonly<{
  authUserId: string;
  householdId: HouseholdId;
  householdName: string;
  personId: PersonId;
  personDisplayName: string;
  defaultCurrency: string;
}>;

export async function getCurrentUserHouseholdContext(): Promise<AuthorizedHouseholdUserContext | null> {
  const session = await getCurrentSession();
  if (!session) {
    return null;
  }

  const access = await findDefaultHouseholdForAuthUser(session.user.id);
  if (!access) {
    return null;
  }

  return Object.freeze({
    authUserId: session.user.id,
    householdId: toHouseholdId(access.householdId),
    householdName: access.householdName,
    personId: toPersonId(access.personId),
    personDisplayName: access.personDisplayName,
    defaultCurrency: access.defaultCurrency,
  });
}

export async function requireCurrentUserHouseholdContext(): Promise<AuthorizedHouseholdUserContext> {
  const session = await requireCurrentSession();
  const access = await findDefaultHouseholdForAuthUser(session.user.id);
  if (!access) {
    throw new HouseholdAccessDeniedError();
  }

  return Object.freeze({
    authUserId: session.user.id,
    householdId: toHouseholdId(access.householdId),
    householdName: access.householdName,
    personId: toPersonId(access.personId),
    personDisplayName: access.personDisplayName,
    defaultCurrency: access.defaultCurrency,
  });
}

export async function requireHouseholdAccess(untrustedHouseholdId: string) {
  const householdId = householdIdInput.parse(untrustedHouseholdId);
  const session = await requireCurrentSession();

  const access = await findHouseholdAccessForAuthUser(
    session.user.id,
    householdId,
  );

  if (!access) {
    throw new HouseholdAccessDeniedError();
  }

  return Object.freeze({
    authUserId: session.user.id,
    householdId: toHouseholdId(access.householdId),
    personId: toPersonId(access.personId),
  });
}
