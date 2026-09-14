import { and, asc, desc, eq, isNull, or } from "drizzle-orm";
import type { StatementImportMappingConfig } from "@nodvis/finance-domain";

import { getDb } from "../client";
import { statementImportProfiles } from "../schema/statement-import-profiles";

export type StatementImportProfileRow =
  typeof statementImportProfiles.$inferSelect;
export type NewStatementImportProfileRow =
  typeof statementImportProfiles.$inferInsert;

export class StatementImportProfileNotFoundError extends Error {
  constructor(message: string = "Statement import profile not found") {
    super(message);
    this.name = "StatementImportProfileNotFoundError";
  }
}

export class DuplicateStatementImportProfileNameError extends Error {
  constructor(
    message: string = "An import profile with this name already exists for this account/household",
  ) {
    super(message);
    this.name = "DuplicateStatementImportProfileNameError";
  }
}

export class StatementImportProfileScopeConflictError extends Error {
  constructor(message: string = "Household-global import profiles require the global route") {
    super(message);
    this.name = "StatementImportProfileScopeConflictError";
  }
}

export async function createStatementImportProfileInDb(params: {
  profile: NewStatementImportProfileRow;
}): Promise<StatementImportProfileRow> {
  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      if (params.profile.isDefault && params.profile.accountId) {
        // Unset any existing default profile for this account
        await tx
          .update(statementImportProfiles)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(
            and(
              eq(statementImportProfiles.householdId, params.profile.householdId),
              eq(statementImportProfiles.accountId, params.profile.accountId),
              eq(statementImportProfiles.isDefault, true),
            ),
          );
      }

      const [inserted] = await tx
        .insert(statementImportProfiles)
        .values(params.profile)
        .returning();

      if (!inserted) {
        throw new Error("Failed to insert statement import profile");
      }

      return inserted;
    });
  } catch (error) {
    const pgError = (
      error && typeof error === "object" && "cause" in error && error.cause
        ? error.cause
        : error
    ) as { code?: string } | undefined;

    if (pgError && typeof pgError === "object" && pgError.code === "23505") {
      throw new DuplicateStatementImportProfileNameError();
    }

    throw error;
  }
}

export async function findStatementImportProfileById(
  householdId: string,
  profileId: string,
  accountId?: string,
): Promise<StatementImportProfileRow | null> {
  const [found] = await getDb()
    .select()
    .from(statementImportProfiles)
    .where(
      and(
        eq(statementImportProfiles.householdId, householdId),
        eq(statementImportProfiles.id, profileId),
        ...(accountId
          ? [or(eq(statementImportProfiles.accountId, accountId), isNull(statementImportProfiles.accountId))]
          : []),
      ),
    )
    .limit(1);

  return found ?? null;
}

export async function listStatementImportProfilesByHousehold(
  householdId: string,
  accountId?: string | null,
): Promise<StatementImportProfileRow[]> {
  const db = getDb();

  const condition = accountId
    ? and(
        eq(statementImportProfiles.householdId, householdId),
        or(
          eq(statementImportProfiles.accountId, accountId),
          isNull(statementImportProfiles.accountId),
        ),
      )
    : eq(statementImportProfiles.householdId, householdId);

  return await db
    .select()
    .from(statementImportProfiles)
    .where(condition)
    .orderBy(
      desc(statementImportProfiles.isDefault),
      asc(statementImportProfiles.name),
    );
}

export async function updateStatementImportProfileInDb(params: {
  householdId: string;
  profileId: string;
  routeAccountId?: string;
  name?: string | undefined;
  mappingConfig?: StatementImportMappingConfig | undefined;
  autoProcessSafe?: boolean | undefined;
  isDefault?: boolean | undefined;
  accountId?: string | null | undefined;
}): Promise<StatementImportProfileRow> {
  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      const existing = await findStatementImportProfileById(
        params.householdId,
        params.profileId,
        params.routeAccountId,
      );
      if (!existing) {
        throw new StatementImportProfileNotFoundError();
      }

      if (params.routeAccountId && existing.accountId === null) {
        throw new StatementImportProfileScopeConflictError();
      }

      const targetAccountId =
        params.accountId !== undefined ? params.accountId : existing.accountId;

      if (params.isDefault && targetAccountId) {
        // Unset any existing default profile for this account
        await tx
          .update(statementImportProfiles)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(
            and(
              eq(statementImportProfiles.householdId, params.householdId),
              eq(statementImportProfiles.accountId, targetAccountId),
              eq(statementImportProfiles.isDefault, true),
            ),
          );
      }

      const updateValues: Partial<NewStatementImportProfileRow> = {
        updatedAt: new Date(),
      };
      if (params.name !== undefined) updateValues.name = params.name.trim();
      if (params.mappingConfig !== undefined)
        updateValues.mappingConfig = params.mappingConfig;
      if (params.autoProcessSafe !== undefined)
        updateValues.autoProcessSafe = params.autoProcessSafe;
      if (params.isDefault !== undefined) updateValues.isDefault = params.isDefault;
      if (params.accountId !== undefined) updateValues.accountId = params.accountId;

      const [updated] = await tx
        .update(statementImportProfiles)
        .set(updateValues)
        .where(
          and(
            eq(statementImportProfiles.householdId, params.householdId),
            eq(statementImportProfiles.id, params.profileId),
            ...(params.routeAccountId
              ? [eq(statementImportProfiles.accountId, params.routeAccountId)]
              : []),
          ),
        )
        .returning();

      if (!updated) {
        throw new StatementImportProfileNotFoundError();
      }

      return updated;
    });
  } catch (error) {
    const pgError = (
      error && typeof error === "object" && "cause" in error && error.cause
        ? error.cause
        : error
    ) as { code?: string } | undefined;

    if (pgError && typeof pgError === "object" && pgError.code === "23505") {
      throw new DuplicateStatementImportProfileNameError();
    }

    throw error;
  }
}

export async function deleteStatementImportProfileInDb(
  householdId: string,
  profileId: string,
  accountId?: string,
): Promise<boolean> {
  if (accountId) {
    const existing = await findStatementImportProfileById(
      householdId,
      profileId,
      accountId,
    );
    if (existing?.accountId === null) {
      throw new StatementImportProfileScopeConflictError();
    }
  }

  const result = await getDb()
    .delete(statementImportProfiles)
    .where(
      and(
        eq(statementImportProfiles.householdId, householdId),
        eq(statementImportProfiles.id, profileId),
        ...(accountId ? [eq(statementImportProfiles.accountId, accountId)] : []),
      ),
    )
    .returning({ id: statementImportProfiles.id });

  return result.length > 0;
}
