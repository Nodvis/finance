import "server-only";

import {
  archiveSavingsGoalInDb,
  completeSavingsGoalInDb,
  contributeToSavingsGoalInDb,
  createSavingsGoalInDb,
  getSavingsGoalById,
  isPersonInHousehold,
  listSavingsGoalsByHousehold,
  unarchiveSavingsGoalInDb,
  uncompleteSavingsGoalInDb,
  updateSavingsGoalInDb,
  SavingsGoalNotFoundError,
  SavingsGoalValidationError,
  SavingsGoalVersionConflictError,
  SavingsGoalAccountInvalidError,
} from "@nodvis/finance-db";
import type { AuthorizedHouseholdUserContext } from "@/lib/authorization/household";
import {
  buildSavingsGoalsOverviewSummary,
  serializeSavingsGoal,
  type SerializedSavingsGoal,
  type SerializedSavingsGoalsOverviewSummary,
} from "./serialization";
import type {
  ArchiveSavingsGoalInput,
  CompleteSavingsGoalInput,
  ContributeSavingsGoalInput,
  CreateSavingsGoalInput,
  SavingsGoalQuery,
  UnarchiveSavingsGoalInput,
  UncompleteSavingsGoalInput,
  UpdateSavingsGoalInput,
} from "./schema";

export class HouseholdAccessDeniedError extends Error {
  constructor(message: string = "Household access denied") {
    super(message);
    this.name = "HouseholdAccessDeniedError";
  }
}

export {
  SavingsGoalNotFoundError,
  SavingsGoalValidationError,
  SavingsGoalVersionConflictError,
  SavingsGoalAccountInvalidError,
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

export async function listHouseholdSavingsGoals(
  context: Pick<AuthorizedHouseholdUserContext, "householdId" | "personId">,
  query?: SavingsGoalQuery,
): Promise<SerializedSavingsGoal[]> {
  await assertHouseholdAccess(context);

  const rows = await listSavingsGoalsByHousehold(context.householdId, {
    status: query?.status ?? undefined,
    accountId: query?.accountId ?? undefined,
    sortBy: query?.sortBy ?? undefined,
    sortOrder: query?.sortOrder ?? undefined,
    limit: query?.limit ?? undefined,
    offset: query?.offset ?? undefined,
  });

  return rows.map((r) => serializeSavingsGoal(r, query?.asOfDate));
}

export async function getHouseholdSavingsGoal(
  context: Pick<AuthorizedHouseholdUserContext, "householdId" | "personId">,
  id: string,
  asOfDate?: string,
): Promise<SerializedSavingsGoal> {
  await assertHouseholdAccess(context);

  const row = await getSavingsGoalById(context.householdId, id);
  return serializeSavingsGoal(row, asOfDate);
}

export async function getHouseholdSavingsGoalsOverview(
  context: Pick<AuthorizedHouseholdUserContext, "householdId" | "personId">,
  asOfDate?: string,
): Promise<SerializedSavingsGoalsOverviewSummary> {
  await assertHouseholdAccess(context);

  const rows = await listSavingsGoalsByHousehold(context.householdId, {
    includeArchived: false,
  });

  return buildSavingsGoalsOverviewSummary(rows, asOfDate);
}

export async function createHouseholdSavingsGoal(
  context: Pick<AuthorizedHouseholdUserContext, "householdId" | "personId">,
  input: CreateSavingsGoalInput,
): Promise<SerializedSavingsGoal> {
  await assertHouseholdAccess(context);

  if (!input.targetAmountMinor) {
    throw new SavingsGoalValidationError("Target amount is required");
  }

  const row = await createSavingsGoalInDb(context.householdId, {
    name: input.name,
    targetAmountMinor: BigInt(input.targetAmountMinor),
    currency: input.currency,
    currentAmountMinor: input.currentAmountMinor
      ? BigInt(input.currentAmountMinor)
      : 0n,
    targetDate: input.targetDate ?? null,
    accountId: input.accountId ?? null,
    notes: input.notes ?? null,
  });

  return serializeSavingsGoal(row);
}

export async function updateHouseholdSavingsGoal(
  context: Pick<AuthorizedHouseholdUserContext, "householdId" | "personId">,
  id: string,
  input: UpdateSavingsGoalInput,
): Promise<SerializedSavingsGoal> {
  await assertHouseholdAccess(context);

  const row = await updateSavingsGoalInDb(
    context.householdId,
    id,
    input.version,
    {
      name: input.name ?? undefined,
      targetAmountMinor:
        input.targetAmountMinor !== undefined
          ? BigInt(input.targetAmountMinor)
          : undefined,
      currency: input.currency ?? undefined,
      currentAmountMinor:
        input.currentAmountMinor !== undefined
          ? BigInt(input.currentAmountMinor)
          : undefined,
      targetDate: input.targetDate !== undefined ? input.targetDate : undefined,
      accountId: input.accountId !== undefined ? input.accountId : undefined,
      notes: input.notes !== undefined ? input.notes : undefined,
    },
  );

  return serializeSavingsGoal(row);
}

export async function contributeToHouseholdSavingsGoal(
  context: Pick<AuthorizedHouseholdUserContext, "householdId" | "personId">,
  id: string,
  input: ContributeSavingsGoalInput,
): Promise<SerializedSavingsGoal> {
  await assertHouseholdAccess(context);

  if (!input.amountMinor) {
    throw new SavingsGoalValidationError("Contribution amount is required");
  }

  const row = await contributeToSavingsGoalInDb(
    context.householdId,
    id,
    input.version,
    BigInt(input.amountMinor),
  );

  return serializeSavingsGoal(row);
}

export async function completeHouseholdSavingsGoal(
  context: Pick<AuthorizedHouseholdUserContext, "householdId" | "personId">,
  id: string,
  input: CompleteSavingsGoalInput,
): Promise<SerializedSavingsGoal> {
  await assertHouseholdAccess(context);

  const row = await completeSavingsGoalInDb(
    context.householdId,
    id,
    input.version,
  );

  return serializeSavingsGoal(row);
}

export async function uncompleteHouseholdSavingsGoal(
  context: Pick<AuthorizedHouseholdUserContext, "householdId" | "personId">,
  id: string,
  input: UncompleteSavingsGoalInput,
): Promise<SerializedSavingsGoal> {
  await assertHouseholdAccess(context);

  const row = await uncompleteSavingsGoalInDb(
    context.householdId,
    id,
    input.version,
  );

  return serializeSavingsGoal(row);
}

export async function archiveHouseholdSavingsGoal(
  context: Pick<AuthorizedHouseholdUserContext, "householdId" | "personId">,
  id: string,
  input: ArchiveSavingsGoalInput,
): Promise<SerializedSavingsGoal> {
  await assertHouseholdAccess(context);

  const row = await archiveSavingsGoalInDb(
    context.householdId,
    id,
    input.version,
  );

  return serializeSavingsGoal(row);
}

export async function unarchiveHouseholdSavingsGoal(
  context: Pick<AuthorizedHouseholdUserContext, "householdId" | "personId">,
  id: string,
  input: UnarchiveSavingsGoalInput,
): Promise<SerializedSavingsGoal> {
  await assertHouseholdAccess(context);

  const row = await unarchiveSavingsGoalInDb(
    context.householdId,
    id,
    input.version,
  );

  return serializeSavingsGoal(row);
}
