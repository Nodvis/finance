import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import type { StatementImportMappingConfig } from "@nodvis/finance-domain";

import { getDb } from "../client";
import {
  accounts,
  households,
  statementImportProfiles,
} from "../schema/index";
import {
  DuplicateStatementImportProfileNameError,
  StatementImportProfileScopeConflictError,
  StatementImportProfileNotFoundError,
  createStatementImportProfileInDb,
  deleteStatementImportProfileInDb,
  findStatementImportProfileById,
  listStatementImportProfilesByHousehold,
  updateStatementImportProfileInDb,
} from "./statement-import-profiles";

const testDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(testDir, "../../../../.env") });

describe("statementImportProfiles schema configuration", () => {
  it("defines correct column types, defaults, and non-null constraints", () => {
    expect(statementImportProfiles.id.notNull).toBe(true);
    expect(statementImportProfiles.householdId.notNull).toBe(true);
    expect(statementImportProfiles.accountId.notNull).toBe(false);
    expect(statementImportProfiles.name.notNull).toBe(true);
    expect(statementImportProfiles.mappingConfig.notNull).toBe(true);
    expect(statementImportProfiles.autoProcessSafe.notNull).toBe(true);
    expect(statementImportProfiles.isDefault.notNull).toBe(true);
    expect(statementImportProfiles.createdAt.notNull).toBe(true);
    expect(statementImportProfiles.updatedAt.notNull).toBe(true);
  });

  it("configures foreign keys and indexes", () => {
    const config = getTableConfig(statementImportProfiles);
    const fkNames = config.foreignKeys.map((fk) => fk.getName());

    expect(fkNames).toContain(
      "statement_import_profiles_household_account_fk",
    );

    const indexNames = config.indexes.map((idx) => idx.config.name);
    expect(indexNames).toContain("statement_import_profiles_household_id_idx");
    expect(indexNames).toContain("statement_import_profiles_account_id_idx");
    expect(indexNames).toContain(
      "statement_import_profiles_household_account_name_idx",
    );
  });
});

describe("statement import profiles DB integration", () => {
  const isPostgresAvailable = Boolean(process.env.DATABASE_URL);

  const sampleMapping: StatementImportMappingConfig = {
    dateColumn: "Data",
    dateFormat: "YYYY-MM-DD",
    timezone: "UTC",
    amountMode: "signed",
    amountColumn: "Kwota",
    invertAmount: false,
    currencyMode: "account",
    descriptionColumn: "Tytuł",
    delimiter: ";",
    hasHeader: true,
    headerRowIndex: 0,
    skipLeadingRows: 0,
  };

  it.runIf(isPostgresAvailable)(
    "creates, lists, updates and deletes statement import profiles",
    async () => {
      const db = getDb();
      const householdId = crypto.randomUUID();
      const accountId = crypto.randomUUID();

      await db.insert(households).values({
        id: householdId,
        name: "Profiles Test Household",
        defaultCurrency: "PLN",
      });

      await db.insert(accounts).values({
        id: accountId,
        householdId,
        name: "Checking",
        type: "checking",
        currency: "PLN",
      });

      // 1. Create account-scoped profile
      const profile1 = await createStatementImportProfileInDb({
        profile: {
          householdId,
          accountId,
          name: "mBank Account Profile",
          mappingConfig: sampleMapping,
          autoProcessSafe: true,
          isDefault: true,
        },
      });

      expect(profile1.id).toBeDefined();
      expect(profile1.name).toBe("mBank Account Profile");
      expect(profile1.autoProcessSafe).toBe(true);
      expect(profile1.isDefault).toBe(true);

      // 2. Create household-wide profile (accountId: null)
      const profile2 = await createStatementImportProfileInDb({
        profile: {
          householdId,
          accountId: null,
          name: "Generic Household CSV",
          mappingConfig: sampleMapping,
          autoProcessSafe: false,
          isDefault: false,
        },
      });

      expect(profile2.accountId).toBeNull();

      // 3. List profiles for account: should include both account-specific and household-wide
      const forAccount = await listStatementImportProfilesByHousehold(
        householdId,
        accountId,
      );
      expect(forAccount).toHaveLength(2);
      expect(forAccount.map((p) => p.name)).toContain("mBank Account Profile");
      expect(forAccount.map((p) => p.name)).toContain("Generic Household CSV");

      // Legacy household-wide profiles remain addressable through an account route.
      const legacyFound = await findStatementImportProfileById(
        householdId,
        profile2.id,
        accountId,
      );
      expect(legacyFound?.id).toBe(profile2.id);

      await expect(updateStatementImportProfileInDb({
        householdId,
        profileId: profile2.id,
        routeAccountId: accountId,
        name: "Generic Household CSV Updated",
      })).rejects.toThrow(StatementImportProfileScopeConflictError);
      await expect(findStatementImportProfileById(householdId, profile2.id, accountId))
        .resolves.toMatchObject({ name: "Generic Household CSV" });

      await expect(deleteStatementImportProfileInDb(
        householdId,
        profile2.id,
        accountId,
      )).rejects.toThrow(StatementImportProfileScopeConflictError);

      // 4. Find by ID
      const found = await findStatementImportProfileById(
        householdId,
        profile1.id,
      );
      expect(found).not.toBeNull();
      expect(found?.name).toBe("mBank Account Profile");

      // 5. Update profile
      const updated = await updateStatementImportProfileInDb({
        householdId,
        profileId: profile1.id,
        name: "mBank Updated Name",
        autoProcessSafe: false,
      });
      expect(updated.name).toBe("mBank Updated Name");
      expect(updated.autoProcessSafe).toBe(false);

      // 6. Reject duplicate name
      await expect(
        createStatementImportProfileInDb({
          profile: {
            householdId,
            accountId,
            name: "mBank Updated Name",
            mappingConfig: sampleMapping,
            autoProcessSafe: false,
            isDefault: false,
          },
        }),
      ).rejects.toThrow(DuplicateStatementImportProfileNameError);

      // 7. Delete profile
      const deleted = await deleteStatementImportProfileInDb(
        householdId,
        profile1.id,
      );
      expect(deleted).toBe(true);

      const afterDelete = await findStatementImportProfileById(
        householdId,
        profile1.id,
      );
      expect(afterDelete).toBeNull();
    },
  );
});
