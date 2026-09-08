import "server-only";

import {
  AccountIdentifierNotFoundError,
  DuplicateAccountIdentifierError,
  InvalidAccountIdentifierError,
  addAccountIdentifier,
  deleteAccountIdentifier,
  findAccountIdentifierById,
  listAccountIdentifiersByHousehold,
  type AccountIdentifierRecord,
} from "@nodvis/finance-db";
import type { HouseholdContext } from "@/lib/accounts/service";
import type { AddAccountIdentifierSchemaInput } from "./schema";

export {
  AccountIdentifierNotFoundError,
  DuplicateAccountIdentifierError,
  InvalidAccountIdentifierError,
};

export type SerializedAccountIdentifier = {
  id: string;
  householdId: string;
  accountId: string;
  identifierType: "iban" | "domestic_nrb";
  formattedIdentifier: string;
  maskedIdentifier: string;
  label: string | null;
  createdAt: string;
  updatedAt: string;
};

export function serializeAccountIdentifier(
  record: AccountIdentifierRecord,
): SerializedAccountIdentifier {
  return {
    id: record.id,
    householdId: record.householdId,
    accountId: record.accountId,
    identifierType: record.identifierType,
    formattedIdentifier: record.formattedIdentifier,
    maskedIdentifier: record.maskedIdentifier,
    label: record.label,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function listHouseholdAccountIdentifiers(
  context: HouseholdContext,
  accountId?: string,
): Promise<AccountIdentifierRecord[]> {
  return await listAccountIdentifiersByHousehold(
    context.householdId,
    accountId,
  );
}

export async function getHouseholdAccountIdentifier(
  context: HouseholdContext,
  identifierId: string,
): Promise<AccountIdentifierRecord> {
  const found = await findAccountIdentifierById(
    context.householdId,
    identifierId,
  );
  if (!found) {
    throw new AccountIdentifierNotFoundError();
  }
  return found;
}

export async function createHouseholdAccountIdentifier(
  context: HouseholdContext,
  accountId: string,
  input: AddAccountIdentifierSchemaInput,
): Promise<AccountIdentifierRecord> {
  return await addAccountIdentifier({
    householdId: context.householdId,
    accountId,
    rawIdentifier: input.rawIdentifier,
    label: input.label,
  });
}

export async function removeHouseholdAccountIdentifier(
  context: HouseholdContext,
  identifierId: string,
): Promise<void> {
  await deleteAccountIdentifier(context.householdId, identifierId);
}
