import { and, asc, eq, isNull } from "drizzle-orm";
import type { CreditFacilityKind } from "@nodvis/finance-domain";
import { currencyCode, validateCreditSnapshot } from "@nodvis/finance-domain";

import { getDb } from "../client";
import { accounts } from "../schema/foundation";
import { creditFacilities } from "../schema/credit-facilities";

export class CreditFacilityNotFoundError extends Error {
  constructor(message = "Credit facility not found in household") {
    super(message);
    this.name = "CreditFacilityNotFoundError";
  }
}

export class CreditFacilityAccountError extends Error {
  constructor(message = "Credit facility account is invalid") {
    super(message);
    this.name = "CreditFacilityAccountError";
  }
}

export type HouseholdCreditFacilitySummary = {
  id: string;
  householdId: string;
  accountId: string | null;
  kind: CreditFacilityKind;
  name: string;
  currency: string;
  approvedLimitMinor: bigint | null;
  observedUsedMinor: bigint | null;
  observedAvailableMinor: bigint | null;
  observedAt: Date | null;
  effectiveFrom: Date | null;
  expiresAt: Date | null;
  version: number;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateCreditFacilityInput = {
  householdId: string;
  accountId?: string | null;
  kind: CreditFacilityKind;
  name: string;
  currency: string;
  approvedLimitMinor?: bigint | null;
  observedUsedMinor?: bigint | null;
  observedAvailableMinor?: bigint | null;
  observedAt?: Date | null;
  effectiveFrom?: Date | null;
  expiresAt?: Date | null;
};

export type UpdateCreditFacilityInput = Omit<CreateCreditFacilityInput, "householdId" | "accountId" | "kind"> & {
  accountId?: string | null;
  kind?: CreditFacilityKind;
  version: number;
};

export function serializeCreditFacility(row: HouseholdCreditFacilitySummary) {
  return {
    ...row,
    approvedLimitMinor: row.approvedLimitMinor?.toString() ?? null,
    observedUsedMinor: row.observedUsedMinor?.toString() ?? null,
    observedAvailableMinor: row.observedAvailableMinor?.toString() ?? null,
    observedAt: row.observedAt?.toISOString() ?? null,
    effectiveFrom: row.effectiveFrom?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapRow(row: typeof creditFacilities.$inferSelect): HouseholdCreditFacilitySummary {
  return { ...row, kind: row.kind as CreditFacilityKind };
}

function validateInput(input: CreateCreditFacilityInput) {
  const name = input.name.trim();
  if (!name || name.length > 160) throw new Error("Invalid credit facility name");
  validateCreditSnapshot({
    currency: input.currency,
    approvedLimit: input.approvedLimitMinor === null || input.approvedLimitMinor === undefined ? null : { currency: currencyCode(input.currency), amountMinor: input.approvedLimitMinor },
    observedUsed: input.observedUsedMinor === null || input.observedUsedMinor === undefined ? null : { currency: currencyCode(input.currency), amountMinor: input.observedUsedMinor },
    observedAvailable: input.observedAvailableMinor === null || input.observedAvailableMinor === undefined ? null : { currency: currencyCode(input.currency), amountMinor: input.observedAvailableMinor },
    observedAt: input.observedAt ?? null,
  });
  return name;
}

export async function listCreditFacilitiesByHousehold(householdId: string, includeArchived = false) {
  const db = getDb();
  const rows = await db.select().from(creditFacilities).where(
    includeArchived ? eq(creditFacilities.householdId, householdId) : and(eq(creditFacilities.householdId, householdId), isNull(creditFacilities.archivedAt)),
  ).orderBy(asc(creditFacilities.name));
  return rows.map(mapRow);
}

export async function findCreditFacilityForAccount(householdId: string, accountId: string) {
  const db = getDb();
  const [row] = await db.select().from(creditFacilities).where(and(eq(creditFacilities.householdId, householdId), eq(creditFacilities.accountId, accountId), isNull(creditFacilities.archivedAt))).limit(1);
  return row ? mapRow(row) : null;
}

export async function createCreditFacility(input: CreateCreditFacilityInput) {
  const name = validateInput(input);
  const db = getDb();
  return await db.transaction(async (tx) => {
    if (input.kind === "overdraft") {
      if (!input.accountId) throw new CreditFacilityAccountError("An overdraft must be linked to an account");
      const [account] = await tx.select({ id: accounts.id, householdId: accounts.householdId, currency: accounts.currency, type: accounts.type }).from(accounts).where(and(eq(accounts.id, input.accountId), eq(accounts.householdId, input.householdId))).limit(1);
      if (!account || account.type !== "checking" || account.currency !== input.currency) throw new CreditFacilityAccountError("An overdraft must belong to a checking account in the same currency");
    }
    const [row] = await tx.insert(creditFacilities).values({
      householdId: input.householdId,
      accountId: input.accountId ?? null,
      kind: input.kind,
      name,
      currency: input.currency,
      approvedLimitMinor: input.approvedLimitMinor ?? null,
      observedUsedMinor: input.observedUsedMinor ?? null,
      observedAvailableMinor: input.observedAvailableMinor ?? null,
      observedAt: input.observedAt ?? null,
      effectiveFrom: input.effectiveFrom ?? null,
      expiresAt: input.expiresAt ?? null,
    }).returning();
    if (!row) throw new Error("Credit facility was not created");
    return mapRow(row);
  });
}

export async function updateCreditFacility(householdId: string, facilityId: string, input: UpdateCreditFacilityInput) {
  const name = validateInput({
    householdId,
    accountId: input.accountId ?? null,
    kind: input.kind ?? "overdraft",
    name: input.name,
    currency: input.currency,
    approvedLimitMinor: input.approvedLimitMinor ?? null,
    observedUsedMinor: input.observedUsedMinor ?? null,
    observedAvailableMinor: input.observedAvailableMinor ?? null,
    observedAt: input.observedAt ?? null,
    effectiveFrom: input.effectiveFrom ?? null,
    expiresAt: input.expiresAt ?? null,
  });
  const db = getDb();
  return await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(creditFacilities).where(and(eq(creditFacilities.id, facilityId), eq(creditFacilities.householdId, householdId))).limit(1);
    if (!existing) throw new CreditFacilityNotFoundError();
    if (existing.version !== input.version) throw new Error("Credit facility was modified concurrently");
    if (existing.kind !== (input.kind ?? existing.kind)) throw new CreditFacilityAccountError("Credit facility kind cannot be changed");
    if (existing.currency !== input.currency) throw new CreditFacilityAccountError("Credit facility currency cannot be changed");
    if (existing.accountId !== (input.accountId ?? existing.accountId)) throw new CreditFacilityAccountError("Credit facility account cannot be changed");
    if (existing.kind === "overdraft") {
      const [account] = await tx.select({ id: accounts.id, householdId: accounts.householdId, currency: accounts.currency, type: accounts.type }).from(accounts).where(and(eq(accounts.id, existing.accountId!), eq(accounts.householdId, householdId))).limit(1);
      if (!account || account.type !== "checking" || account.currency !== existing.currency) throw new CreditFacilityAccountError("An overdraft must belong to a checking account in the same currency");
    }
    const [row] = await tx.update(creditFacilities).set({ name, currency: input.currency, approvedLimitMinor: input.approvedLimitMinor ?? null, observedUsedMinor: input.observedUsedMinor ?? null, observedAvailableMinor: input.observedAvailableMinor ?? null, observedAt: input.observedAt ?? null, effectiveFrom: input.effectiveFrom ?? null, expiresAt: input.expiresAt ?? null, version: existing.version + 1, updatedAt: new Date() }).where(and(eq(creditFacilities.id, facilityId), eq(creditFacilities.householdId, householdId), eq(creditFacilities.version, input.version))).returning();
    if (!row) throw new Error("Credit facility was modified concurrently");
    return mapRow(row);
  });
}

export async function archiveCreditFacility(householdId: string, facilityId: string, version: number) {
  const db = getDb();
  const [row] = await db.update(creditFacilities).set({
    archivedAt: new Date(),
    version: version + 1,
    updatedAt: new Date(),
  }).where(and(
    eq(creditFacilities.id, facilityId),
    eq(creditFacilities.householdId, householdId),
    eq(creditFacilities.version, version),
    isNull(creditFacilities.archivedAt),
  )).returning();
  if (!row) throw new CreditFacilityNotFoundError();
  return mapRow(row);
}
