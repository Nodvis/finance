import "server-only";

import {
  AccountInvalidOwnerError,
  AccountNotFoundError,
  archiveHouseholdAccount,
  createHouseholdAccount,
  findAccountInHousehold,
  listAccountsByHousehold,
  listHouseholdMembers,
  unarchiveHouseholdAccount,
  updateHouseholdAccountMetadata,
} from "@nodvis/finance-db";
import type { HouseholdAccountSummary } from "@nodvis/finance-db";
import type { AuthorizedHouseholdContext } from "@/lib/transactions/service";
import type { AuthorizedHouseholdUserContext } from "@/lib/authorization/household";
import { parseAccountBalanceToMinor } from "@/lib/transactions/money-entry";
import type { CreateAccountInput, UpdateAccountMetadataInput } from "./schema";

export { AccountInvalidOwnerError, AccountNotFoundError };

export type HouseholdContext =
  | AuthorizedHouseholdUserContext
  | AuthorizedHouseholdContext;

export async function listHouseholdAccountsSummary(
  context: HouseholdContext,
  options?: { includeArchived?: boolean },
): Promise<HouseholdAccountSummary[]> {
  return await listAccountsByHousehold(context.householdId, options);
}

export async function getHouseholdAccount(
  context: HouseholdContext,
  accountId: string,
): Promise<HouseholdAccountSummary> {
  const account = await findAccountInHousehold(context.householdId, accountId);
  if (!account) {
    throw new AccountNotFoundError();
  }
  return account;
}

export async function createHouseholdAccountEntry(
  context: HouseholdContext,
  input: CreateAccountInput,
): Promise<HouseholdAccountSummary> {
  let snapshotMinor: bigint | null = null;
  let snapshotAt: Date | null = null;

  if (
    input.initialBalance &&
    input.initialBalance.amountNatural !== undefined &&
    input.initialBalance.amountNatural !== null
  ) {
    const parseResult = parseAccountBalanceToMinor(
      input.initialBalance.amountNatural,
      input.currency,
    );
    if (!parseResult.success) {
      throw new Error(`Invalid balance format: ${parseResult.error}`);
    }
    snapshotMinor = parseResult.amountMinor;
    if (snapshotMinor !== null) {
      snapshotAt = input.initialBalance.capturedAt ?? new Date();
    }
  }

  let overdraftLimitMinor: bigint | undefined;
  if (input.overdraft?.enabled) {
    const parsedLimit = parseAccountBalanceToMinor(
      input.overdraft.approvedLimitNatural,
      input.currency,
    );
    if (!parsedLimit.success || parsedLimit.amountMinor === null || parsedLimit.amountMinor < 0n) {
      throw new Error("Invalid overdraft limit format");
    }
    overdraftLimitMinor = parsedLimit.amountMinor;
  }

  return await createHouseholdAccount({
    householdId: context.householdId,
    name: input.name,
    type: input.type,
    currency: input.currency,
    ownerPersonIds: input.ownerPersonIds,
    balanceSnapshotMinor: snapshotMinor,
    balanceSnapshotAt: snapshotAt,
    ...(overdraftLimitMinor === undefined
      ? {}
      : { overdraft: { name: "Overdraft facility", approvedLimitMinor: overdraftLimitMinor } }),
  });
}

export async function updateHouseholdAccountMetadataEntry(
  context: HouseholdContext,
  accountId: string,
  input: UpdateAccountMetadataInput,
): Promise<HouseholdAccountSummary> {
  return await updateHouseholdAccountMetadata({
    householdId: context.householdId,
    accountId,
    name: input.name,
    ownerPersonIds: input.ownerPersonIds,
  });
}

export async function archiveAccount(
  context: HouseholdContext,
  accountId: string,
): Promise<HouseholdAccountSummary> {
  return await archiveHouseholdAccount(context.householdId, accountId);
}

export async function unarchiveAccount(
  context: HouseholdContext,
  accountId: string,
): Promise<HouseholdAccountSummary> {
  return await unarchiveHouseholdAccount(context.householdId, accountId);
}

export async function listMembersInHousehold(context: HouseholdContext) {
  return await listHouseholdMembers(context.householdId);
}
