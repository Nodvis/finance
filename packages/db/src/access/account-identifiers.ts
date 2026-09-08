import { and, desc, eq } from "drizzle-orm";

import {
  formatAccountIdentifier,
  maskAccountIdentifier,
  validateAccountIdentifier,
} from "@nodvis/finance-domain";

import { getDb } from "../client";
import { accountIdentifiers } from "../schema/account-identifiers";
import { accounts } from "../schema/foundation";

export class AccountIdentifierNotFoundError extends Error {
  constructor(message: string = "Account identifier not found in household") {
    super(message);
    this.name = "AccountIdentifierNotFoundError";
  }
}

export class DuplicateAccountIdentifierError extends Error {
  constructor(
    message: string = "Account identifier already registered in this household",
  ) {
    super(message);
    this.name = "DuplicateAccountIdentifierError";
  }
}

export class InvalidAccountIdentifierError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAccountIdentifierError";
  }
}

export type AccountIdentifierRecord = {
  id: string;
  householdId: string;
  accountId: string;
  identifierType: "iban" | "domestic_nrb";
  rawIdentifier: string;
  normalizedIdentifier: string;
  formattedIdentifier: string;
  maskedIdentifier: string;
  label: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function mapAccountIdentifierRow(
  row: typeof accountIdentifiers.$inferSelect,
): AccountIdentifierRecord {
  return {
    id: row.id,
    householdId: row.householdId,
    accountId: row.accountId,
    identifierType: row.identifierType,
    rawIdentifier: row.rawIdentifier,
    normalizedIdentifier: row.normalizedIdentifier,
    formattedIdentifier: formatAccountIdentifier(row.normalizedIdentifier),
    maskedIdentifier: maskAccountIdentifier(row.normalizedIdentifier),
    label: row.label,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listAccountIdentifiersByHousehold(
  householdId: string,
  accountId?: string,
): Promise<AccountIdentifierRecord[]> {
  const db = getDb();
  const conditions = [eq(accountIdentifiers.householdId, householdId)];
  if (accountId) {
    conditions.push(eq(accountIdentifiers.accountId, accountId));
  }

  const rows = await db
    .select()
    .from(accountIdentifiers)
    .where(and(...conditions))
    .orderBy(desc(accountIdentifiers.createdAt));

  return rows.map(mapAccountIdentifierRow);
}

export async function findAccountIdentifierById(
  householdId: string,
  identifierId: string,
): Promise<AccountIdentifierRecord | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(accountIdentifiers)
    .where(
      and(
        eq(accountIdentifiers.householdId, householdId),
        eq(accountIdentifiers.id, identifierId),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }
  return mapAccountIdentifierRow(row);
}

export type AddAccountIdentifierInput = {
  householdId: string;
  accountId: string;
  rawIdentifier: string;
  label?: string | null | undefined;
};

export async function addAccountIdentifier(
  input: AddAccountIdentifierInput,
): Promise<AccountIdentifierRecord> {
  const validation = validateAccountIdentifier(input.rawIdentifier);
  if (!validation.valid) {
    throw new InvalidAccountIdentifierError(validation.error);
  }

  const db = getDb();

  // Verify account belongs to household
  const [account] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.householdId, input.householdId),
        eq(accounts.id, input.accountId),
      ),
    )
    .limit(1);

  if (!account) {
    throw new Error("Target account not found in household");
  }

  // Check if identifier is already registered in this household
  const [existing] = await db
    .select({ id: accountIdentifiers.id })
    .from(accountIdentifiers)
    .where(
      and(
        eq(accountIdentifiers.householdId, input.householdId),
        eq(accountIdentifiers.normalizedIdentifier, validation.normalized),
      ),
    )
    .limit(1);

  if (existing) {
    throw new DuplicateAccountIdentifierError(
      `Identifier ${maskAccountIdentifier(validation.normalized)} is already registered in this household`,
    );
  }

  const [inserted] = await db
    .insert(accountIdentifiers)
    .values({
      householdId: input.householdId,
      accountId: input.accountId,
      identifierType: validation.type,
      rawIdentifier: input.rawIdentifier.trim(),
      normalizedIdentifier: validation.normalized,
      label: input.label?.trim() || null,
    })
    .returning();

  if (!inserted) {
    throw new Error("Failed to insert account identifier");
  }

  return mapAccountIdentifierRow(inserted);
}

export async function deleteAccountIdentifier(
  householdId: string,
  identifierId: string,
): Promise<void> {
  const db = getDb();
  const [deleted] = await db
    .delete(accountIdentifiers)
    .where(
      and(
        eq(accountIdentifiers.householdId, householdId),
        eq(accountIdentifiers.id, identifierId),
      ),
    )
    .returning({ id: accountIdentifiers.id });

  if (!deleted) {
    throw new AccountIdentifierNotFoundError();
  }
}
