import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { ACCOUNT_TYPES } from "@nodvis/finance-domain";

import {
  accountOwners,
  accounts,
  accountTypeEnum,
  authUsers,
  householdMemberships,
  households,
  personAuthLinks,
  persons,
} from "./index";

describe("financial foundation schema", () => {
  it("uses the domain account types as a PostgreSQL enum", () => {
    expect(accountTypeEnum.enumValues).toEqual(ACCOUNT_TYPES);
  });

  it("stores optional balance snapshots as bigint minor units with format checks", () => {
    expect(accounts.balanceSnapshotMinor.getSQLType()).toBe("bigint");
    expect(accounts.balanceSnapshotMinor.notNull).toBe(false);
    expect(accounts.balanceSnapshotAt.notNull).toBe(false);

    const accountConfig = getTableConfig(accounts);
    const checks = accountConfig.checks.map((item) => item.name);
    expect(checks).toContain("accounts_balance_snapshot_complete");
    expect(checks).toContain("accounts_currency_format");
    expect(checks).toContain("accounts_name_not_blank");

    const uniqueConstraints = accountConfig.uniqueConstraints.map(
      (item) => item.name,
    );
    expect(uniqueConstraints).toContain("accounts_household_id_id_unique");
  });

  it("enforces cross-household ownership rejection via composite foreign keys", () => {
    const ownerConfig = getTableConfig(accountOwners);
    const foreignKeys = ownerConfig.foreignKeys;
    const fkNames = foreignKeys.map((item) => item.getName());

    expect(fkNames).toContain("account_owners_household_account_fk");
    expect(fkNames).toContain("account_owners_household_person_fk");

    const accountFk = foreignKeys.find(
      (fk) => fk.getName() === "account_owners_household_account_fk",
    );
    expect(accountFk?.reference().columns.map((col) => col.name)).toEqual([
      "household_id",
      "account_id",
    ]);
    expect(accountFk?.reference().foreignColumns.map((col) => col.name)).toEqual([
      "household_id",
      "id",
    ]);
    expect(accountFk?.onDelete).toBe("cascade");

    const personFk = foreignKeys.find(
      (fk) => fk.getName() === "account_owners_household_person_fk",
    );
    expect(personFk?.reference().columns.map((col) => col.name)).toEqual([
      "household_id",
      "person_id",
    ]);
    expect(personFk?.reference().foreignColumns.map((col) => col.name)).toEqual([
      "household_id",
      "person_id",
    ]);
    expect(personFk?.onDelete).toBe("cascade");
  });

  it("links auth users to persons with cascade deletion and distinct identities", () => {
    const linkConfig = getTableConfig(personAuthLinks);
    const foreignKeys = linkConfig.foreignKeys;

    expect(personAuthLinks.authUserId.primary).toBe(true);
    expect(personAuthLinks.authUserId.name).toBe("auth_user_id");
    expect(personAuthLinks.personId.name).toBe("person_id");

    const authUserFk = foreignKeys.find(
      (fk) => fk.reference().foreignTable === authUsers,
    );
    expect(authUserFk?.onDelete).toBe("cascade");

    const personFk = foreignKeys.find(
      (fk) => fk.reference().foreignTable === persons,
    );
    expect(personFk?.onDelete).toBe("cascade");

    // A person can exist without an auth account (no foreign key from persons -> auth_users)
    const personConfig = getTableConfig(persons);
    const personFkTables = personConfig.foreignKeys.map(
      (fk) => fk.reference().foreignTable,
    );
    expect(personFkTables).not.toContain(authUsers);
  });

  it("enforces non-blank names and currency format checks on households and persons", () => {
    const householdChecks = getTableConfig(households).checks.map(
      (c) => c.name,
    );
    expect(householdChecks).toContain("households_name_not_blank");
    expect(householdChecks).toContain("households_default_currency_format");

    const personChecks = getTableConfig(persons).checks.map((c) => c.name);
    expect(personChecks).toContain("persons_display_name_not_blank");
  });

  it("configures household memberships with cascade foreign keys", () => {
    const membershipConfig = getTableConfig(householdMemberships);
    const foreignKeys = membershipConfig.foreignKeys;

    const householdFk = foreignKeys.find(
      (fk) => fk.reference().foreignTable === households,
    );
    expect(householdFk?.onDelete).toBe("cascade");

    const personFk = foreignKeys.find(
      (fk) => fk.reference().foreignTable === persons,
    );
    expect(personFk?.onDelete).toBe("cascade");
  });
});
