import "server-only";

import {
  ObligationMatchConflictError,
  ObligationNotFoundError,
  ObligationValidationError,
  ObligationVersionConflictError,
  cancelObligationInDb,
  createObligationInDb,
  getObligationById,
  getUpcomingObligationsSummary,
  isPersonInHousehold,
  listCandidateTransactionsForObligation,
  listObligationsByHousehold,
  matchObligationInDb,
  unlinkObligationInDb,
  updateObligationInDb,
  type ObligationWithTransaction,
  type UpcomingObligationsSummary,
} from "@nodvis/finance-db";
import { parseNaturalDecimalToMinor } from "@/lib/transactions/money-entry";
import type { AuthorizedHouseholdUserContext } from "@/lib/authorization/household";
import {
  serializeHouseholdObligation,
} from "./serialization";
import type {
  CancelObligationInput,
  CreateObligationInput,
  MatchObligationInput,
  ObligationQuery,
  SerializedHouseholdObligation,
  UnlinkObligationInput,
  UpdateObligationInput,
} from "./schema";

export class HouseholdAccessDeniedError extends Error {
  constructor(message: string = "Household access denied") {
    super(message);
    this.name = "HouseholdAccessDeniedError";
  }
}

export {
  ObligationMatchConflictError,
  ObligationNotFoundError,
  ObligationValidationError,
  ObligationVersionConflictError,
};

async function assertHouseholdAccess(
  context: Pick<AuthorizedHouseholdUserContext, "householdId" | "personId">,
): Promise<void> {
  const isMember = await isPersonInHousehold(
    context.householdId,
    context.personId,
  );
  if (!isMember) {
    throw new HouseholdAccessDeniedError();
  }
}

export async function listHouseholdObligations(
  context: Pick<AuthorizedHouseholdUserContext, "householdId" | "personId">,
  query?: ObligationQuery,
): Promise<SerializedHouseholdObligation[]> {
  await assertHouseholdAccess(context);

  const rows = await listObligationsByHousehold(context.householdId, {
    status: query?.status ?? undefined,
    scope: query?.scope ?? undefined,
    currency: query?.currency ?? undefined,
    sortBy: query?.sortBy ?? undefined,
    sortOrder: query?.sortOrder ?? undefined,
    today: query?.today ?? undefined,
    limit: query?.limit ?? undefined,
    offset: query?.offset ?? undefined,
  });

  return rows.map(serializeHouseholdObligation);
}

export async function getHouseholdObligation(
  context: Pick<AuthorizedHouseholdUserContext, "householdId" | "personId">,
  obligationId: string,
  today?: string,
): Promise<SerializedHouseholdObligation> {
  await assertHouseholdAccess(context);

  const row = await getObligationById(
    context.householdId,
    obligationId,
    today,
  );

  return serializeHouseholdObligation(row);
}

export async function createHouseholdObligation(
  context: Pick<AuthorizedHouseholdUserContext, "householdId" | "personId">,
  input: CreateObligationInput,
): Promise<SerializedHouseholdObligation> {
  await assertHouseholdAccess(context);

  let amountMinor: bigint;
  if (input.amountMinor) {
    amountMinor = BigInt(input.amountMinor);
  } else if (input.amountNatural) {
    const parsed = parseNaturalDecimalToMinor(
      input.amountNatural,
      input.currency,
    );
    if (!parsed.success || !parsed.amountMinor) {
      throw new ObligationValidationError(
        `Invalid amount format: ${parsed.error ?? "invalid"}`,
      );
    }
    amountMinor = BigInt(parsed.amountMinor);
  } else {
    throw new ObligationValidationError(
      "Either amountMinor or amountNatural is required",
    );
  }

  const row = await createObligationInDb(context.householdId, {
    title: input.title,
    amountMinor,
    currency: input.currency,
    dueDate: input.dueDate,
    notes: input.notes ?? undefined,
  });

  return serializeHouseholdObligation(row);
}

export async function updateHouseholdObligation(
  context: Pick<AuthorizedHouseholdUserContext, "householdId" | "personId">,
  obligationId: string,
  input: UpdateObligationInput,
): Promise<SerializedHouseholdObligation> {
  await assertHouseholdAccess(context);

  let amountMinor: bigint | undefined = undefined;
  if (input.amountMinor !== undefined) {
    amountMinor = BigInt(input.amountMinor);
  } else if (input.amountNatural !== undefined) {
    const existing = await getObligationById(context.householdId, obligationId);
    const currency = input.currency ?? existing.currency;
    const parsed = parseNaturalDecimalToMinor(input.amountNatural, currency);
    if (!parsed.success || !parsed.amountMinor) {
      throw new ObligationValidationError(
        `Invalid amount format: ${parsed.error ?? "invalid"}`,
      );
    }
    amountMinor = BigInt(parsed.amountMinor);
  }

  const row = await updateObligationInDb(
    context.householdId,
    obligationId,
    input.version,
    {
      title: input.title ?? undefined,
      amountMinor,
      currency: input.currency ?? undefined,
      dueDate: input.dueDate ?? undefined,
      notes: input.notes !== undefined ? input.notes : undefined,
    },
  );

  return serializeHouseholdObligation(row);
}

export async function cancelHouseholdObligation(
  context: Pick<AuthorizedHouseholdUserContext, "householdId" | "personId">,
  obligationId: string,
  input: CancelObligationInput,
): Promise<SerializedHouseholdObligation> {
  await assertHouseholdAccess(context);

  const row = await cancelObligationInDb(
    context.householdId,
    obligationId,
    input.version,
  );

  return serializeHouseholdObligation(row);
}

export async function matchHouseholdObligation(
  context: Pick<AuthorizedHouseholdUserContext, "householdId" | "personId">,
  obligationId: string,
  input: MatchObligationInput,
): Promise<SerializedHouseholdObligation> {
  await assertHouseholdAccess(context);

  const row = await matchObligationInDb(
    context.householdId,
    obligationId,
    input.version,
    input.transactionId,
  );

  return serializeHouseholdObligation(row);
}

export async function unlinkHouseholdObligation(
  context: Pick<AuthorizedHouseholdUserContext, "householdId" | "personId">,
  obligationId: string,
  input: UnlinkObligationInput,
): Promise<SerializedHouseholdObligation> {
  await assertHouseholdAccess(context);

  const row = await unlinkObligationInDb(
    context.householdId,
    obligationId,
    input.version,
  );

  return serializeHouseholdObligation(row);
}

export async function listHouseholdObligationCandidates(
  context: Pick<AuthorizedHouseholdUserContext, "householdId" | "personId">,
  obligationId: string,
) {
  await assertHouseholdAccess(context);

  const candidates = await listCandidateTransactionsForObligation(
    context.householdId,
    obligationId,
  );

  return candidates.map((c) => ({
    id: c.id,
    payee: c.payee,
    occurredOn: c.occurredOn.toISOString(),
    amountMinor: c.amountMinor.toString(),
    currency: c.currency,
  }));
}

export async function getHouseholdUpcomingSummary(
  context: Pick<AuthorizedHouseholdUserContext, "householdId" | "personId">,
  query?: { today?: string | undefined } | undefined,
): Promise<UpcomingObligationsSummary> {
  await assertHouseholdAccess(context);

  return await getUpcomingObligationsSummary(
    context.householdId,
    query?.today ?? undefined,
  );
}
