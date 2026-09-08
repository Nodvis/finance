import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { describe, expect, it } from "vitest";

import { getDb } from "../client";
import { accounts, households, persons } from "../schema/foundation";
import {
  AccountIdentifierNotFoundError,
  DuplicateAccountIdentifierError,
  InvalidAccountIdentifierError,
  addAccountIdentifier,
  deleteAccountIdentifier,
  findAccountIdentifierById,
  listAccountIdentifiersByHousehold,
} from "./account-identifiers";

const testDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(testDir, "../../../../.env") });

describe("account-identifiers database access integration", () => {
  const isPostgresAvailable = Boolean(process.env.DATABASE_URL);

  const VALID_PL_IBAN = "PL74109024020000000123456789";
  const VALID_PL_DOMESTIC = "74109024020000000123456789";
  const VALID_PL_IBAN_2 = "PL57114020040000300201234567";

  it("exports specific error classes", () => {
    expect(new AccountIdentifierNotFoundError()).toBeInstanceOf(Error);
    expect(new DuplicateAccountIdentifierError()).toBeInstanceOf(Error);
    expect(new InvalidAccountIdentifierError("test")).toBeInstanceOf(Error);
  });

  it.runIf(isPostgresAvailable)(
    "adds, lists, finds, and deletes account identifiers with domain normalization and masking",
    async () => {
      const db = getDb();
      const householdId = crypto.randomUUID();
      const accountId = crypto.randomUUID();

      // Setup household and account
      await db.insert(households).values({
        id: householdId,
        name: "Test Household Identifiers",
        defaultCurrency: "PLN",
      });

      await db.insert(accounts).values({
        id: accountId,
        householdId,
        name: "mBank Main",
        type: "checking",
        currency: "PLN",
      });

      // 1. Add identifier using Polish domestic NRB
      const added = await addAccountIdentifier({
        householdId,
        accountId,
        rawIdentifier: VALID_PL_DOMESTIC,
        label: "Primary Domestic IBAN",
      });

      expect(added.id).toBeDefined();
      expect(added.householdId).toBe(householdId);
      expect(added.accountId).toBe(accountId);
      expect(added.identifierType).toBe("domestic_nrb");
      expect(added.normalizedIdentifier).toBe(VALID_PL_IBAN);
      expect(added.maskedIdentifier).toContain("••••");
      expect(added.maskedIdentifier.startsWith("PL74")).toBe(true);
      expect(added.maskedIdentifier.endsWith("6789")).toBe(true);
      expect(added.label).toBe("Primary Domestic IBAN");

      // 2. Reject duplicate identifier in the same household
      await expect(
        addAccountIdentifier({
          householdId,
          accountId,
          rawIdentifier: VALID_PL_IBAN, // Same normalized identifier
          label: "Duplicate attempt",
        }),
      ).rejects.toThrow(DuplicateAccountIdentifierError);

      // 3. List identifiers for household
      const list = await listAccountIdentifiersByHousehold(
        householdId,
        accountId,
      );
      expect(list).toHaveLength(1);
      expect(list[0]!.id).toBe(added.id);

      // 4. Find by id
      const found = await findAccountIdentifierById(householdId, added.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(added.id);

      // 5. Delete identifier
      await deleteAccountIdentifier(householdId, added.id);

      const afterDelete = await listAccountIdentifiersByHousehold(
        householdId,
        accountId,
      );
      expect(afterDelete).toHaveLength(0);

      // 6. Delete again should throw not found
      await expect(
        deleteAccountIdentifier(householdId, added.id),
      ).rejects.toThrow(AccountIdentifierNotFoundError);
    },
  );

  it.runIf(isPostgresAvailable)(
    "rejects adding identifier for invalid account or invalid format",
    async () => {
      const householdId = crypto.randomUUID();
      const nonExistentAccId = crypto.randomUUID();

      // Invalid checksum / format
      await expect(
        addAccountIdentifier({
          householdId,
          accountId: nonExistentAccId,
          rawIdentifier: "invalid-number",
        }),
      ).rejects.toThrow(InvalidAccountIdentifierError);

      // Non existent account
      await expect(
        addAccountIdentifier({
          householdId,
          accountId: nonExistentAccId,
          rawIdentifier: VALID_PL_IBAN_2,
        }),
      ).rejects.toThrow("Target account not found in household");
    },
  );
});
