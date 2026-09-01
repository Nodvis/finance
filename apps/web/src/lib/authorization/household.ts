import "server-only";

import { z } from "zod";

import { findHouseholdAccessForAuthUser } from "@nodvis/finance-db";
import {
  householdId as toHouseholdId,
  personId as toPersonId,
} from "@nodvis/finance-domain";

import { requireCurrentSession } from "@/lib/auth/session";

const householdIdInput = z.uuid();

export class HouseholdAccessDeniedError extends Error {
  constructor() {
    super("Household access denied");
    this.name = "HouseholdAccessDeniedError";
  }
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
