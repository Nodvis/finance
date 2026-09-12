import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import {
  archiveSavingsGoal,
  completeSavingsGoal,
  contributeToSavingsGoal,
  createSavingsGoal,
  money,
  savingsGoalId as toSavingsGoalId,
  householdId as toHouseholdId,
  accountId as toAccountId,
  unarchiveSavingsGoal,
  uncompleteSavingsGoal,
  updateSavingsGoal,
  type SavingsGoal,
  type SavingsGoalStatus,
} from "@nodvis/finance-domain";

import { getDb } from "../client";
import { accounts, households } from "../schema/foundation";
import { savingsGoals } from "../schema/savings-goals";

export class SavingsGoalNotFoundError extends Error {
  constructor(message: string = "Savings goal not found in household") {
    super(message);
    this.name = "SavingsGoalNotFoundError";
  }
}

export class SavingsGoalVersionConflictError extends Error {
  constructor(message: string = "Savings goal was modified concurrently") {
    super(message);
    this.name = "SavingsGoalVersionConflictError";
  }
}

export class SavingsGoalValidationError extends Error {
  constructor(message: string = "Savings goal validation failed") {
    super(message);
    this.name = "SavingsGoalValidationError";
  }
}

export class SavingsGoalAccountInvalidError extends Error {
  constructor(message: string = "Linked account is invalid or not in household") {
    super(message);
    this.name = "SavingsGoalAccountInvalidError";
  }
}

type SavingsGoalRow = typeof savingsGoals.$inferSelect;

export type HouseholdSavingsGoalSummary = {
  id: string;
  householdId: string;
  name: string;
  targetAmountMinor: bigint;
  currentAmountMinor: bigint;
  currency: string;
  targetDate: string | null;
  accountId: string | null;
  accountName: string | null;
  status: SavingsGoalStatus;
  notes: string | null;
  completedAt: Date | null;
  archivedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export function mapRowToSavingsGoalSummary(
  row: SavingsGoalRow,
  accountName: string | null = null,
): HouseholdSavingsGoalSummary {
  return {
    id: row.id,
    householdId: row.householdId,
    name: row.name,
    targetAmountMinor: row.targetAmountMinor,
    currentAmountMinor: row.currentAmountMinor,
    currency: row.currency,
    targetDate: row.targetDate,
    accountId: row.accountId,
    accountName,
    status: row.status as SavingsGoalStatus,
    notes: row.notes,
    completedAt: row.completedAt,
    archivedAt: row.archivedAt,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapSummaryToDomain(summary: HouseholdSavingsGoalSummary): SavingsGoal {
  return {
    id: toSavingsGoalId(summary.id),
    householdId: toHouseholdId(summary.householdId),
    name: summary.name,
    targetAmount: money(summary.targetAmountMinor, summary.currency),
    currentAmount: money(summary.currentAmountMinor, summary.currency),
    targetDate: summary.targetDate,
    accountId: summary.accountId ? toAccountId(summary.accountId) : null,
    status: summary.status,
    notes: summary.notes,
    completedAt: summary.completedAt,
    archivedAt: summary.archivedAt,
    version: summary.version,
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
  };
}

export type ListSavingsGoalsOptions = {
  status?: SavingsGoalStatus | "all" | undefined;
  includeArchived?: boolean | undefined;
  accountId?: string | undefined;
  sortBy?: "createdAt" | "targetDate" | "name" | undefined;
  sortOrder?: "asc" | "desc" | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
};

export async function listSavingsGoalsByHousehold(
  householdId: string,
  options?: ListSavingsGoalsOptions,
): Promise<HouseholdSavingsGoalSummary[]> {
  const db = getDb();
  const whereConditions = [eq(savingsGoals.householdId, householdId)];

  if (options?.status && options.status !== "all") {
    whereConditions.push(eq(savingsGoals.status, options.status));
  } else if (options?.includeArchived === false) {
    whereConditions.push(isNull(savingsGoals.archivedAt));
  }

  if (options?.accountId) {
    whereConditions.push(eq(savingsGoals.accountId, options.accountId));
  }

  const effectiveSortOrder = options?.sortOrder ?? "asc";
  let orderClauses = [asc(savingsGoals.createdAt), asc(savingsGoals.id)];

  if (options?.sortBy === "targetDate") {
    orderClauses =
      effectiveSortOrder === "desc"
        ? [desc(savingsGoals.targetDate), desc(savingsGoals.id)]
        : [asc(savingsGoals.targetDate), asc(savingsGoals.id)];
  } else if (options?.sortBy === "name") {
    orderClauses =
      effectiveSortOrder === "desc"
        ? [desc(savingsGoals.name), desc(savingsGoals.id)]
        : [asc(savingsGoals.name), asc(savingsGoals.id)];
  } else if (effectiveSortOrder === "desc") {
    orderClauses = [desc(savingsGoals.createdAt), desc(savingsGoals.id)];
  }

  let query = db
    .select({
      goal: savingsGoals,
      accountName: accounts.name,
    })
    .from(savingsGoals)
    .leftJoin(
      accounts,
      and(
        eq(savingsGoals.accountId, accounts.id),
        eq(accounts.householdId, householdId),
      ),
    )
    .where(and(...whereConditions))
    .orderBy(...orderClauses);

  if (typeof options?.limit === "number" && options.limit > 0) {
    query = query.limit(options.limit) as typeof query;
  }
  if (typeof options?.offset === "number" && options.offset > 0) {
    query = query.offset(options.offset) as typeof query;
  }

  const rows = await query;
  return rows.map((r) => mapRowToSavingsGoalSummary(r.goal, r.accountName));
}

export async function getSavingsGoalById(
  householdId: string,
  id: string,
): Promise<HouseholdSavingsGoalSummary> {
  const db = getDb();
  const [row] = await db
    .select({
      goal: savingsGoals,
      accountName: accounts.name,
    })
    .from(savingsGoals)
    .leftJoin(
      accounts,
      and(
        eq(savingsGoals.accountId, accounts.id),
        eq(accounts.householdId, householdId),
      ),
    )
    .where(
      and(
        eq(savingsGoals.householdId, householdId),
        eq(savingsGoals.id, id),
      ),
    )
    .limit(1);

  if (!row) {
    throw new SavingsGoalNotFoundError(
      `Savings goal ${id} not found in household ${householdId}`,
    );
  }

  return mapRowToSavingsGoalSummary(row.goal, row.accountName);
}

export async function findSavingsGoalById(
  householdId: string,
  id: string,
): Promise<HouseholdSavingsGoalSummary | null> {
  try {
    return await getSavingsGoalById(householdId, id);
  } catch (error) {
    if (error instanceof SavingsGoalNotFoundError) {
      return null;
    }
    throw error;
  }
}

export type CreateSavingsGoalDbInput = {
  name: string;
  targetAmountMinor: bigint;
  currency: string;
  currentAmountMinor?: bigint | undefined;
  targetDate?: string | null | undefined;
  accountId?: string | null | undefined;
  notes?: string | null | undefined;
};

export async function createSavingsGoalInDb(
  householdId: string,
  input: CreateSavingsGoalDbInput,
): Promise<HouseholdSavingsGoalSummary> {
  return await getDb().transaction(async (dbTx) => {
    // Acquire household serialization lock
    await dbTx
      .select({ id: households.id })
      .from(households)
      .where(eq(households.id, householdId))
      .for("update");

    let accountName: string | null = null;
    if (input.accountId) {
      const [acc] = await dbTx
        .select({ id: accounts.id, name: accounts.name, currency: accounts.currency })
        .from(accounts)
        .where(
          and(
            eq(accounts.householdId, householdId),
            eq(accounts.id, input.accountId),
          ),
        )
        .limit(1);

      if (!acc) {
        throw new SavingsGoalAccountInvalidError(
          `Account ${input.accountId} not found in household ${householdId}`,
        );
      }
      if (acc.currency !== input.currency) {
        throw new SavingsGoalValidationError(
          `Linked account currency (${acc.currency}) must match savings goal currency (${input.currency})`,
        );
      }
      accountName = acc.name;
    }

    const domainGoal = createSavingsGoal({
      householdId: toHouseholdId(householdId),
      name: input.name,
      targetAmount: money(input.targetAmountMinor, input.currency),
      currentAmount:
        input.currentAmountMinor !== undefined
          ? money(input.currentAmountMinor, input.currency)
          : undefined,
      targetDate: input.targetDate,
      accountId: input.accountId ? toAccountId(input.accountId) : undefined,
      notes: input.notes,
    });

    const [inserted] = await dbTx
      .insert(savingsGoals)
      .values({
        id: domainGoal.id,
        householdId,
        name: domainGoal.name,
        targetAmountMinor: domainGoal.targetAmount.amountMinor,
        currentAmountMinor: domainGoal.currentAmount.amountMinor,
        currency: domainGoal.targetAmount.currency,
        targetDate: domainGoal.targetDate,
        accountId: domainGoal.accountId,
        status: domainGoal.status,
        notes: domainGoal.notes,
        completedAt: domainGoal.completedAt,
        archivedAt: domainGoal.archivedAt,
        version: domainGoal.version,
        createdAt: domainGoal.createdAt,
        updatedAt: domainGoal.updatedAt,
      })
      .returning();

    if (!inserted) {
      throw new Error("Failed to insert savings goal");
    }

    return mapRowToSavingsGoalSummary(inserted, accountName);
  });
}

export type UpdateSavingsGoalDbInput = {
  name?: string | undefined;
  targetAmountMinor?: bigint | undefined;
  currency?: string | undefined;
  currentAmountMinor?: bigint | undefined;
  targetDate?: string | null | undefined;
  accountId?: string | null | undefined;
  notes?: string | null | undefined;
};

export async function updateSavingsGoalInDb(
  householdId: string,
  id: string,
  expectedVersion: number,
  input: UpdateSavingsGoalDbInput,
): Promise<HouseholdSavingsGoalSummary> {
  return await getDb().transaction(async (dbTx) => {
    // Acquire household serialization lock
    await dbTx
      .select({ id: households.id })
      .from(households)
      .where(eq(households.id, householdId))
      .for("update");

    const [existing] = await dbTx
      .select({
        goal: savingsGoals,
        accountName: accounts.name,
      })
      .from(savingsGoals)
      .leftJoin(
        accounts,
        and(
          eq(savingsGoals.accountId, accounts.id),
          eq(accounts.householdId, householdId),
        ),
      )
      .where(
        and(
          eq(savingsGoals.householdId, householdId),
          eq(savingsGoals.id, id),
        ),
      )
      .for("update");

    if (!existing) {
      throw new SavingsGoalNotFoundError(
        `Savings goal ${id} not found in household ${householdId}`,
      );
    }

    if (existing.goal.version !== expectedVersion) {
      throw new SavingsGoalVersionConflictError(
        `Savings goal version mismatch (expected ${expectedVersion}, found ${existing.goal.version})`,
      );
    }

    if (existing.goal.status === "archived") {
      throw new SavingsGoalValidationError(
        "Cannot update an archived savings goal; restore it first",
      );
    }

    if (
      input.currency !== undefined &&
      input.currency !== existing.goal.currency
    ) {
      throw new SavingsGoalValidationError(
        "Savings goal currency cannot be changed after creation",
      );
    }

    const domainExisting = mapSummaryToDomain(
      mapRowToSavingsGoalSummary(existing.goal, existing.accountName),
    );

    let resolvedAccountId: string | null = domainExisting.accountId;
    let resolvedAccountName: string | null = existing.accountName;

    if (input.accountId !== undefined) {
      if (input.accountId === null) {
        resolvedAccountId = null;
        resolvedAccountName = null;
      } else {
        const [acc] = await dbTx
          .select({ id: accounts.id, name: accounts.name, currency: accounts.currency })
          .from(accounts)
          .where(
            and(
              eq(accounts.householdId, householdId),
              eq(accounts.id, input.accountId),
            ),
          )
          .limit(1);

        if (!acc) {
          throw new SavingsGoalAccountInvalidError(
            `Account ${input.accountId} not found in household ${householdId}`,
          );
        }
        const effectiveCurrency = input.currency ?? domainExisting.targetAmount.currency;
        if (acc.currency !== effectiveCurrency) {
          throw new SavingsGoalValidationError(
            `Linked account currency (${acc.currency}) must match savings goal currency (${effectiveCurrency})`,
          );
        }
        resolvedAccountId = acc.id;
        resolvedAccountName = acc.name;
      }
    }

    const targetAmount =
      input.targetAmountMinor !== undefined
        ? money(
            input.targetAmountMinor,
            input.currency ?? domainExisting.targetAmount.currency,
          )
        : domainExisting.targetAmount;

    const currentAmount =
      input.currentAmountMinor !== undefined
        ? money(input.currentAmountMinor, targetAmount.currency)
        : domainExisting.currentAmount;

    const domainUpdated = updateSavingsGoal(domainExisting, {
      name: input.name,
      targetAmount,
      currentAmount,
      targetDate: input.targetDate,
      accountId: resolvedAccountId ? toAccountId(resolvedAccountId) : null,
      notes: input.notes,
    });

    const [updated] = await dbTx
      .update(savingsGoals)
      .set({
        name: domainUpdated.name,
        targetAmountMinor: domainUpdated.targetAmount.amountMinor,
        currentAmountMinor: domainUpdated.currentAmount.amountMinor,
        currency: domainUpdated.targetAmount.currency,
        targetDate: domainUpdated.targetDate,
        accountId: domainUpdated.accountId,
        status: domainUpdated.status,
        notes: domainUpdated.notes,
        completedAt: domainUpdated.completedAt,
        version: domainUpdated.version,
        updatedAt: domainUpdated.updatedAt,
      })
      .where(
        and(
          eq(savingsGoals.householdId, householdId),
          eq(savingsGoals.id, id),
          eq(savingsGoals.version, expectedVersion),
        ),
      )
      .returning();

    if (!updated) {
      throw new SavingsGoalVersionConflictError();
    }

    return mapRowToSavingsGoalSummary(updated, resolvedAccountName);
  });
}

export async function contributeToSavingsGoalInDb(
  householdId: string,
  id: string,
  expectedVersion: number,
  contributionMinor: bigint,
): Promise<HouseholdSavingsGoalSummary> {
  return await getDb().transaction(async (dbTx) => {
    // Acquire household serialization lock
    await dbTx
      .select({ id: households.id })
      .from(households)
      .where(eq(households.id, householdId))
      .for("update");

    const [existing] = await dbTx
      .select({
        goal: savingsGoals,
        accountName: accounts.name,
      })
      .from(savingsGoals)
      .leftJoin(
        accounts,
        and(
          eq(savingsGoals.accountId, accounts.id),
          eq(accounts.householdId, householdId),
        ),
      )
      .where(
        and(
          eq(savingsGoals.householdId, householdId),
          eq(savingsGoals.id, id),
        ),
      )
      .for("update");

    if (!existing) {
      throw new SavingsGoalNotFoundError(
        `Savings goal ${id} not found in household ${householdId}`,
      );
    }

    if (existing.goal.version !== expectedVersion) {
      throw new SavingsGoalVersionConflictError(
        `Savings goal version mismatch (expected ${expectedVersion}, found ${existing.goal.version})`,
      );
    }

    if (existing.goal.status === "archived") {
      throw new SavingsGoalValidationError(
        "Cannot contribute to an archived savings goal",
      );
    }

    const domainExisting = mapSummaryToDomain(
      mapRowToSavingsGoalSummary(existing.goal, existing.accountName),
    );

    const contribution = money(contributionMinor, domainExisting.targetAmount.currency);
    const domainUpdated = contributeToSavingsGoal(domainExisting, contribution);

    const [updated] = await dbTx
      .update(savingsGoals)
      .set({
        currentAmountMinor: domainUpdated.currentAmount.amountMinor,
        status: domainUpdated.status,
        completedAt: domainUpdated.completedAt,
        version: domainUpdated.version,
        updatedAt: domainUpdated.updatedAt,
      })
      .where(
        and(
          eq(savingsGoals.householdId, householdId),
          eq(savingsGoals.id, id),
          eq(savingsGoals.version, expectedVersion),
        ),
      )
      .returning();

    if (!updated) {
      throw new SavingsGoalVersionConflictError();
    }

    return mapRowToSavingsGoalSummary(updated, existing.accountName);
  });
}

export async function completeSavingsGoalInDb(
  householdId: string,
  id: string,
  expectedVersion: number,
  completedAt: Date = new Date(),
): Promise<HouseholdSavingsGoalSummary> {
  return await getDb().transaction(async (dbTx) => {
    // Acquire household serialization lock
    await dbTx
      .select({ id: households.id })
      .from(households)
      .where(eq(households.id, householdId))
      .for("update");

    const [existing] = await dbTx
      .select({
        goal: savingsGoals,
        accountName: accounts.name,
      })
      .from(savingsGoals)
      .leftJoin(
        accounts,
        and(
          eq(savingsGoals.accountId, accounts.id),
          eq(accounts.householdId, householdId),
        ),
      )
      .where(
        and(
          eq(savingsGoals.householdId, householdId),
          eq(savingsGoals.id, id),
        ),
      )
      .for("update");

    if (!existing) {
      throw new SavingsGoalNotFoundError(
        `Savings goal ${id} not found in household ${householdId}`,
      );
    }

    if (existing.goal.version !== expectedVersion) {
      throw new SavingsGoalVersionConflictError(
        `Savings goal version mismatch (expected ${expectedVersion}, found ${existing.goal.version})`,
      );
    }

    const domainExisting = mapSummaryToDomain(
      mapRowToSavingsGoalSummary(existing.goal, existing.accountName),
    );

    const domainUpdated = completeSavingsGoal(domainExisting, completedAt);

    const [updated] = await dbTx
      .update(savingsGoals)
      .set({
        status: domainUpdated.status,
        completedAt: domainUpdated.completedAt,
        archivedAt: null,
        version: domainUpdated.version,
        updatedAt: domainUpdated.updatedAt,
      })
      .where(
        and(
          eq(savingsGoals.householdId, householdId),
          eq(savingsGoals.id, id),
          eq(savingsGoals.version, expectedVersion),
        ),
      )
      .returning();

    if (!updated) {
      throw new SavingsGoalVersionConflictError();
    }

    return mapRowToSavingsGoalSummary(updated, existing.accountName);
  });
}

export async function uncompleteSavingsGoalInDb(
  householdId: string,
  id: string,
  expectedVersion: number,
): Promise<HouseholdSavingsGoalSummary> {
  return await getDb().transaction(async (dbTx) => {
    // Acquire household serialization lock
    await dbTx
      .select({ id: households.id })
      .from(households)
      .where(eq(households.id, householdId))
      .for("update");

    const [existing] = await dbTx
      .select({
        goal: savingsGoals,
        accountName: accounts.name,
      })
      .from(savingsGoals)
      .leftJoin(
        accounts,
        and(
          eq(savingsGoals.accountId, accounts.id),
          eq(accounts.householdId, householdId),
        ),
      )
      .where(
        and(
          eq(savingsGoals.householdId, householdId),
          eq(savingsGoals.id, id),
        ),
      )
      .for("update");

    if (!existing) {
      throw new SavingsGoalNotFoundError(
        `Savings goal ${id} not found in household ${householdId}`,
      );
    }

    if (existing.goal.version !== expectedVersion) {
      throw new SavingsGoalVersionConflictError(
        `Savings goal version mismatch (expected ${expectedVersion}, found ${existing.goal.version})`,
      );
    }

    const domainExisting = mapSummaryToDomain(
      mapRowToSavingsGoalSummary(existing.goal, existing.accountName),
    );

    const domainUpdated = uncompleteSavingsGoal(domainExisting);

    const [updated] = await dbTx
      .update(savingsGoals)
      .set({
        status: domainUpdated.status,
        completedAt: null,
        version: domainUpdated.version,
        updatedAt: domainUpdated.updatedAt,
      })
      .where(
        and(
          eq(savingsGoals.householdId, householdId),
          eq(savingsGoals.id, id),
          eq(savingsGoals.version, expectedVersion),
        ),
      )
      .returning();

    if (!updated) {
      throw new SavingsGoalVersionConflictError();
    }

    return mapRowToSavingsGoalSummary(updated, existing.accountName);
  });
}

export async function archiveSavingsGoalInDb(
  householdId: string,
  id: string,
  expectedVersion: number,
  archivedAt: Date = new Date(),
): Promise<HouseholdSavingsGoalSummary> {
  return await getDb().transaction(async (dbTx) => {
    // Acquire household serialization lock
    await dbTx
      .select({ id: households.id })
      .from(households)
      .where(eq(households.id, householdId))
      .for("update");

    const [existing] = await dbTx
      .select({
        goal: savingsGoals,
        accountName: accounts.name,
      })
      .from(savingsGoals)
      .leftJoin(
        accounts,
        and(
          eq(savingsGoals.accountId, accounts.id),
          eq(accounts.householdId, householdId),
        ),
      )
      .where(
        and(
          eq(savingsGoals.householdId, householdId),
          eq(savingsGoals.id, id),
        ),
      )
      .for("update");

    if (!existing) {
      throw new SavingsGoalNotFoundError(
        `Savings goal ${id} not found in household ${householdId}`,
      );
    }

    if (existing.goal.version !== expectedVersion) {
      throw new SavingsGoalVersionConflictError(
        `Savings goal version mismatch (expected ${expectedVersion}, found ${existing.goal.version})`,
      );
    }

    const domainExisting = mapSummaryToDomain(
      mapRowToSavingsGoalSummary(existing.goal, existing.accountName),
    );

    const domainUpdated = archiveSavingsGoal(domainExisting, archivedAt);

    const [updated] = await dbTx
      .update(savingsGoals)
      .set({
        status: domainUpdated.status,
        archivedAt: domainUpdated.archivedAt,
        version: domainUpdated.version,
        updatedAt: domainUpdated.updatedAt,
      })
      .where(
        and(
          eq(savingsGoals.householdId, householdId),
          eq(savingsGoals.id, id),
          eq(savingsGoals.version, expectedVersion),
        ),
      )
      .returning();

    if (!updated) {
      throw new SavingsGoalVersionConflictError();
    }

    return mapRowToSavingsGoalSummary(updated, existing.accountName);
  });
}

export async function unarchiveSavingsGoalInDb(
  householdId: string,
  id: string,
  expectedVersion: number,
): Promise<HouseholdSavingsGoalSummary> {
  return await getDb().transaction(async (dbTx) => {
    // Acquire household serialization lock
    await dbTx
      .select({ id: households.id })
      .from(households)
      .where(eq(households.id, householdId))
      .for("update");

    const [existing] = await dbTx
      .select({
        goal: savingsGoals,
        accountName: accounts.name,
      })
      .from(savingsGoals)
      .leftJoin(
        accounts,
        and(
          eq(savingsGoals.accountId, accounts.id),
          eq(accounts.householdId, householdId),
        ),
      )
      .where(
        and(
          eq(savingsGoals.householdId, householdId),
          eq(savingsGoals.id, id),
        ),
      )
      .for("update");

    if (!existing) {
      throw new SavingsGoalNotFoundError(
        `Savings goal ${id} not found in household ${householdId}`,
      );
    }

    if (existing.goal.version !== expectedVersion) {
      throw new SavingsGoalVersionConflictError(
        `Savings goal version mismatch (expected ${expectedVersion}, found ${existing.goal.version})`,
      );
    }

    const domainExisting = mapSummaryToDomain(
      mapRowToSavingsGoalSummary(existing.goal, existing.accountName),
    );

    const domainUpdated = unarchiveSavingsGoal(domainExisting);

    const [updated] = await dbTx
      .update(savingsGoals)
      .set({
        status: domainUpdated.status,
        archivedAt: null,
        version: domainUpdated.version,
        updatedAt: domainUpdated.updatedAt,
      })
      .where(
        and(
          eq(savingsGoals.householdId, householdId),
          eq(savingsGoals.id, id),
          eq(savingsGoals.version, expectedVersion),
        ),
      )
      .returning();

    if (!updated) {
      throw new SavingsGoalVersionConflictError();
    }

    return mapRowToSavingsGoalSummary(updated, existing.accountName);
  });
}
