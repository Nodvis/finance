import { and, asc, eq, inArray } from "drizzle-orm";
import type { ACCOUNT_TYPES, AccountType } from "@nodvis/finance-domain";
import {
  accountId as toAccountId,
  createAccount,
  householdId as toHouseholdId,
  money,
  personId as toPersonId,
} from "@nodvis/finance-domain";

import { getDb } from "../client";
import {
  accountOwners,
  accounts,
  householdMemberships,
  persons,
} from "../schema/foundation";
import { creditFacilities } from "../schema/credit-facilities";

export class AccountNotFoundError extends Error {
  constructor(message: string = "Account not found in household") {
    super(message);
    this.name = "AccountNotFoundError";
  }
}

export class AccountInvalidOwnerError extends Error {
  constructor(
    message: string = "Account owner must be a member of the household",
  ) {
    super(message);
    this.name = "AccountInvalidOwnerError";
  }
}

export type HouseholdAccountSummary = {
  id: string;
  householdId: string;
  name: string;
  type: (typeof ACCOUNT_TYPES)[number];
  currency: string;
  balanceSnapshotMinor: bigint | null;
  balanceSnapshotAt: Date | null;
  archivedAt: Date | null;
  ownerPersonIds: string[];
  owners?: Array<{ personId: string; displayName: string }>;
};

export async function findAccountInHousehold(
  householdId: string,
  accountId: string,
): Promise<HouseholdAccountSummary | null> {
  const db = getDb();
  const [account] = await db
    .select({
      id: accounts.id,
      householdId: accounts.householdId,
      name: accounts.name,
      type: accounts.type,
      currency: accounts.currency,
      balanceSnapshotMinor: accounts.balanceSnapshotMinor,
      balanceSnapshotAt: accounts.balanceSnapshotAt,
      archivedAt: accounts.archivedAt,
    })
    .from(accounts)
    .where(
      and(
        eq(accounts.householdId, householdId),
        eq(accounts.id, accountId),
      ),
    )
    .limit(1);

  if (!account) {
    return null;
  }

  const owners = await db
    .select({
      personId: accountOwners.personId,
      displayName: persons.displayName,
    })
    .from(accountOwners)
    .innerJoin(persons, eq(accountOwners.personId, persons.id))
    .where(
      and(
        eq(accountOwners.householdId, householdId),
        eq(accountOwners.accountId, accountId),
      ),
    )
    .orderBy(asc(persons.displayName));

  return {
    ...account,
    ownerPersonIds: owners.map((o) => o.personId),
    owners,
  };
}

export async function listAccountsByHousehold(
  householdId: string,
  options: { includeArchived?: boolean } = { includeArchived: true },
): Promise<HouseholdAccountSummary[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: accounts.id,
      householdId: accounts.householdId,
      name: accounts.name,
      type: accounts.type,
      currency: accounts.currency,
      balanceSnapshotMinor: accounts.balanceSnapshotMinor,
      balanceSnapshotAt: accounts.balanceSnapshotAt,
      archivedAt: accounts.archivedAt,
    })
    .from(accounts)
    .where(eq(accounts.householdId, householdId))
    .orderBy(asc(accounts.name));

  if (rows.length === 0) {
    return [];
  }

  const owners = await db
    .select({
      accountId: accountOwners.accountId,
      personId: accountOwners.personId,
      displayName: persons.displayName,
    })
    .from(accountOwners)
    .innerJoin(persons, eq(accountOwners.personId, persons.id))
    .where(eq(accountOwners.householdId, householdId))
    .orderBy(asc(persons.displayName));

  const ownersByAccount = new Map<
    string,
    Array<{ personId: string; displayName: string }>
  >();
  for (const owner of owners) {
    const list = ownersByAccount.get(owner.accountId) ?? [];
    list.push({ personId: owner.personId, displayName: owner.displayName });
    ownersByAccount.set(owner.accountId, list);
  }

  const result: HouseholdAccountSummary[] = rows.map((acc) => {
    const accOwners = ownersByAccount.get(acc.id) ?? [];
    return {
      ...acc,
      ownerPersonIds: accOwners.map((o) => o.personId),
      owners: accOwners,
    };
  });

  if (options.includeArchived === false) {
    return result.filter((acc) => acc.archivedAt === null);
  }

  return result;
}

export type CreateHouseholdAccountInput = {
  householdId: string;
  name: string;
  type: AccountType | string;
  currency: string;
  ownerPersonIds: string[];
  balanceSnapshotMinor?: bigint | null | undefined;
  balanceSnapshotAt?: Date | null | undefined;
  overdraft?: { name: string; approvedLimitMinor: bigint };
  creditFacility?: { kind: "credit_card"; name: string; approvedLimitMinor: bigint };
};

export async function createHouseholdAccount(
  input: CreateHouseholdAccountInput,
): Promise<HouseholdAccountSummary> {
  const db = getDb();
  const newAccountId = crypto.randomUUID();

  const uniqueOwnerIds = [...new Set(input.ownerPersonIds)];
  if (uniqueOwnerIds.length === 0) {
    throw new Error("An account must have at least one owner");
  }

  const domainAccount = createAccount({
    id: toAccountId(newAccountId),
    householdId: toHouseholdId(input.householdId),
    name: input.name,
    type: input.type,
    currency: input.currency,
    ownerPersonIds: uniqueOwnerIds.map(toPersonId),
    balanceSnapshot:
      input.balanceSnapshotMinor !== undefined &&
      input.balanceSnapshotMinor !== null
        ? {
            balance: money(input.balanceSnapshotMinor, input.currency),
            capturedAt: input.balanceSnapshotAt ?? new Date(),
          }
        : null,
  });

  return await db.transaction(async (tx) => {
    const memberships = await tx
      .select({ personId: householdMemberships.personId })
      .from(householdMemberships)
      .where(
        and(
          eq(householdMemberships.householdId, input.householdId),
          inArray(householdMemberships.personId, uniqueOwnerIds),
        ),
      );

    const validMemberIds = new Set(memberships.map((m) => m.personId));
    for (const ownerId of uniqueOwnerIds) {
      if (!validMemberIds.has(ownerId)) {
        throw new AccountInvalidOwnerError(
          `Person ${ownerId} is not a member of household ${input.householdId}`,
        );
      }
    }

    const snapshotMinor = domainAccount.balanceSnapshot
      ? domainAccount.balanceSnapshot.balance.amountMinor
      : null;
    const snapshotAt = domainAccount.balanceSnapshot
      ? domainAccount.balanceSnapshot.capturedAt
      : null;

    await tx.insert(accounts).values({
      id: domainAccount.id,
      householdId: domainAccount.householdId,
      name: domainAccount.name,
      type: domainAccount.type,
      currency: domainAccount.currency,
      balanceSnapshotMinor: snapshotMinor,
      balanceSnapshotAt: snapshotAt,
      archivedAt: null,
    });

    for (const ownerId of uniqueOwnerIds) {
      await tx.insert(accountOwners).values({
        householdId: input.householdId,
        accountId: domainAccount.id,
        personId: ownerId,
      });
    }

    if (input.overdraft) {
      if (domainAccount.type !== "checking") {
        throw new Error("An overdraft can only be created for a checking account");
      }
      if (input.overdraft.approvedLimitMinor < 0n) {
        throw new Error("Overdraft limit cannot be negative");
      }
      await tx.insert(creditFacilities).values({
        householdId: input.householdId,
        accountId: domainAccount.id,
        kind: "overdraft",
        name: input.overdraft.name,
        currency: domainAccount.currency,
        approvedLimitMinor: input.overdraft.approvedLimitMinor,
      });
    }

    if (input.creditFacility) {
      if (domainAccount.type !== "credit_card") throw new Error("A credit card facility can only be created for a credit card account");
      if (input.creditFacility.approvedLimitMinor < 0n) throw new Error("Credit card limit cannot be negative");
      await tx.insert(creditFacilities).values({
        householdId: input.householdId,
        accountId: domainAccount.id,
        kind: input.creditFacility.kind,
        name: input.creditFacility.name,
        currency: domainAccount.currency,
        approvedLimitMinor: input.creditFacility.approvedLimitMinor,
      });
    }

    return {
      id: domainAccount.id,
      householdId: domainAccount.householdId,
      name: domainAccount.name,
      type: domainAccount.type,
      currency: domainAccount.currency,
      balanceSnapshotMinor: snapshotMinor,
      balanceSnapshotAt: snapshotAt,
      archivedAt: null,
      ownerPersonIds: uniqueOwnerIds,
    };
  });
}

export type UpdateHouseholdAccountMetadataInput = {
  householdId: string;
  accountId: string;
  name?: string | undefined;
  ownerPersonIds?: string[] | undefined;
};

export async function updateHouseholdAccountMetadata(
  input: UpdateHouseholdAccountMetadataInput,
): Promise<HouseholdAccountSummary> {
  const db = getDb();

  return await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.householdId, input.householdId),
          eq(accounts.id, input.accountId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new AccountNotFoundError();
    }

    const updates: Partial<{ name: string; updatedAt: Date }> = {};
    if (input.name !== undefined) {
      const trimmed = input.name.trim();
      if (trimmed.length === 0 || trimmed.length > 160) {
        throw new Error("Invalid account name");
      }
      updates.name = trimmed;
      updates.updatedAt = new Date();
    }

    if (Object.keys(updates).length > 0) {
      await tx
        .update(accounts)
        .set(updates)
        .where(
          and(
            eq(accounts.householdId, input.householdId),
            eq(accounts.id, input.accountId),
          ),
        );
    }

    if (input.ownerPersonIds !== undefined) {
      const uniqueOwners = [...new Set(input.ownerPersonIds)];
      if (uniqueOwners.length === 0) {
        throw new Error("An account must have at least one owner");
      }

      const memberships = await tx
        .select({ personId: householdMemberships.personId })
        .from(householdMemberships)
        .where(
          and(
            eq(householdMemberships.householdId, input.householdId),
            inArray(householdMemberships.personId, uniqueOwners),
          ),
        );

      const validMembers = new Set(memberships.map((m) => m.personId));
      for (const ownerId of uniqueOwners) {
        if (!validMembers.has(ownerId)) {
          throw new AccountInvalidOwnerError(
            `Person ${ownerId} is not a member of household ${input.householdId}`,
          );
        }
      }

      await tx
        .delete(accountOwners)
        .where(
          and(
            eq(accountOwners.householdId, input.householdId),
            eq(accountOwners.accountId, input.accountId),
          ),
        );

      for (const ownerId of uniqueOwners) {
        await tx.insert(accountOwners).values({
          householdId: input.householdId,
          accountId: input.accountId,
          personId: ownerId,
        });
      }
    }

    const updatedAccount = await findAccountInHousehold(
      input.householdId,
      input.accountId,
    );
    if (!updatedAccount) {
      throw new AccountNotFoundError();
    }

    return updatedAccount;
  });
}

export async function archiveHouseholdAccount(
  householdId: string,
  accountId: string,
  archivedAt: Date = new Date(),
): Promise<HouseholdAccountSummary> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.householdId, householdId),
        eq(accounts.id, accountId),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new AccountNotFoundError();
  }

  await db
    .update(accounts)
    .set({
      archivedAt,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(accounts.householdId, householdId),
        eq(accounts.id, accountId),
      ),
    );

  const updated = await findAccountInHousehold(householdId, accountId);
  return updated!;
}

export async function unarchiveHouseholdAccount(
  householdId: string,
  accountId: string,
): Promise<HouseholdAccountSummary> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.householdId, householdId),
        eq(accounts.id, accountId),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new AccountNotFoundError();
  }

  await db
    .update(accounts)
    .set({
      archivedAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(accounts.householdId, householdId),
        eq(accounts.id, accountId),
      ),
    );

  const updated = await findAccountInHousehold(householdId, accountId);
  return updated!;
}
