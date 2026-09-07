import "server-only";

import { cookies } from "next/headers";
import { z } from "zod";

import {
  findDefaultHouseholdForAuthUser,
  findHouseholdAccessForAuthUser,
  listHouseholdsForAuthUser,
} from "@nodvis/finance-db";
import type { HouseholdAccessSummary } from "@nodvis/finance-db";
import {
  householdId as toHouseholdId,
  personId as toPersonId,
} from "@nodvis/finance-domain";
import type { HouseholdId, PersonId } from "@nodvis/finance-domain";

import { getCurrentSession, requireCurrentSession } from "@/lib/auth/session";

const householdIdInput = z.uuid();

export const ACTIVE_HOUSEHOLD_COOKIE_NAME = "nodvis_active_household";

export class HouseholdAccessDeniedError extends Error {
  constructor(message: string = "Household access denied") {
    super(message);
    this.name = "HouseholdAccessDeniedError";
  }
}

export class HouseholdSelectionRequiredError extends HouseholdAccessDeniedError {
  constructor(
    message: string = "Multiple households exist; explicit selection is required",
  ) {
    super(message);
    this.name = "HouseholdSelectionRequiredError";
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

export type UserHouseholdsStatus =
  | { status: "unauthenticated" }
  | { status: "none" }
  | { status: "single"; activeContext: AuthorizedHouseholdUserContext }
  | {
      status: "multiple_needs_selection";
      households: HouseholdAccessSummary[];
    }
  | {
      status: "multiple_selected";
      activeContext: AuthorizedHouseholdUserContext;
      households: HouseholdAccessSummary[];
    };

async function getSelectedHouseholdCookie(): Promise<string | undefined> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(ACTIVE_HOUSEHOLD_COOKIE_NAME)?.value;
  } catch {
    return undefined;
  }
}

export async function getCurrentUserHouseholdsStatus(): Promise<UserHouseholdsStatus> {
  const session = await getCurrentSession();
  if (!session) {
    return { status: "unauthenticated" };
  }

  const allHouseholds = await listHouseholdsForAuthUser(session.user.id);
  if (allHouseholds.length === 0) {
    return { status: "none" };
  }

  if (allHouseholds.length === 1) {
    const single = allHouseholds[0]!;
    return {
      status: "single",
      activeContext: Object.freeze({
        authUserId: session.user.id,
        householdId: toHouseholdId(single.householdId),
        householdName: single.householdName,
        personId: toPersonId(single.personId),
        personDisplayName: single.personDisplayName,
        defaultCurrency: single.defaultCurrency,
      }),
    };
  }

  const cookieId = await getSelectedHouseholdCookie();
  const matched = cookieId
    ? allHouseholds.find((h) => h.householdId === cookieId)
    : null;

  if (matched) {
    return {
      status: "multiple_selected",
      activeContext: Object.freeze({
        authUserId: session.user.id,
        householdId: toHouseholdId(matched.householdId),
        householdName: matched.householdName,
        personId: toPersonId(matched.personId),
        personDisplayName: matched.personDisplayName,
        defaultCurrency: matched.defaultCurrency,
      }),
      households: allHouseholds,
    };
  }

  return {
    status: "multiple_needs_selection",
    households: allHouseholds,
  };
}

export async function getCurrentUserHouseholdContext(
  requestedHouseholdId?: string,
): Promise<AuthorizedHouseholdUserContext | null> {
  const session = await getCurrentSession();
  if (!session) {
    return null;
  }

  const selectedId =
    requestedHouseholdId ?? (await getSelectedHouseholdCookie());
  const access = selectedId
    ? await findDefaultHouseholdForAuthUser(session.user.id, selectedId)
    : await findDefaultHouseholdForAuthUser(session.user.id);
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

export async function requireCurrentUserHouseholdContext(
  requestedHouseholdId?: string,
): Promise<AuthorizedHouseholdUserContext> {
  const session = await requireCurrentSession();
  const selectedId =
    requestedHouseholdId ?? (await getSelectedHouseholdCookie());
  const access = selectedId
    ? await findDefaultHouseholdForAuthUser(session.user.id, selectedId)
    : await findDefaultHouseholdForAuthUser(session.user.id);
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
