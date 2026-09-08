import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { TRANSACTION_KINDS } from "@nodvis/finance-domain";

import {
  accounts,
  categories,
  householdMemberships,
  households,
  transactionKindEnum,
  transactions,
} from "./index";

describe("transactions schema", () => {
  it("uses the domain transaction kinds as a PostgreSQL enum", () => {
    expect(transactionKindEnum.enumValues).toEqual(TRANSACTION_KINDS);
  });

  it("defines exact bigint minor unit column and required audit timestamps", () => {
    expect(transactions.amountMinor.getSQLType()).toBe("bigint");
    expect(transactions.amountMinor.notNull).toBe(true);
    expect(transactions.currency.notNull).toBe(true);
    expect(transactions.occurredOn.notNull).toBe(true);
    expect(transactions.kind.notNull).toBe(true);
    expect(transactions.householdId.notNull).toBe(true);
  });

  it("configures domain integrity check constraints", () => {
    const config = getTableConfig(transactions);
    const checks = config.checks.map((c) => c.name);

    expect(checks).toContain("transactions_amount_positive");
    expect(checks).toContain("transactions_currency_format");
    expect(checks).toContain("transactions_transfer_distinct_accounts");
    expect(checks).toContain("transactions_kind_structure");
  });

  it("enforces cross-household isolation on accounts, categories and members via composite foreign keys", () => {
    const config = getTableConfig(transactions);
    const foreignKeys = config.foreignKeys;
    const fkNames = foreignKeys.map((fk) => fk.getName());

    expect(fkNames).toContain("transactions_household_account_fk");
    expect(fkNames).toContain("transactions_household_category_fk");
    expect(fkNames).toContain("transactions_household_from_account_fk");
    expect(fkNames).toContain("transactions_household_to_account_fk");
    expect(fkNames).toContain("transactions_household_paid_by_person_fk");
    expect(fkNames).toContain("transactions_household_received_by_person_fk");

    const categoryFk = foreignKeys.find(
      (fk) => fk.getName() === "transactions_household_category_fk",
    );
    expect(categoryFk?.reference().foreignTable).toBe(categories);
    expect(categoryFk?.reference().columns.map((c) => c.name)).toEqual([
      "household_id",
      "category_id",
    ]);
    expect(categoryFk?.reference().foreignColumns.map((c) => c.name)).toEqual([
      "household_id",
      "id",
    ]);
    expect(categoryFk?.onDelete).toBe("set null");

    const accountFk = foreignKeys.find(
      (fk) => fk.getName() === "transactions_household_account_fk",
    );
    expect(accountFk?.reference().foreignTable).toBe(accounts);
    expect(accountFk?.reference().columns.map((c) => c.name)).toEqual([
      "household_id",
      "account_id",
    ]);
    expect(accountFk?.reference().foreignColumns.map((c) => c.name)).toEqual([
      "household_id",
      "id",
    ]);

    const fromAccountFk = foreignKeys.find(
      (fk) => fk.getName() === "transactions_household_from_account_fk",
    );
    expect(fromAccountFk?.reference().foreignTable).toBe(accounts);
    expect(fromAccountFk?.reference().columns.map((c) => c.name)).toEqual([
      "household_id",
      "from_account_id",
    ]);

    const toAccountFk = foreignKeys.find(
      (fk) => fk.getName() === "transactions_household_to_account_fk",
    );
    expect(toAccountFk?.reference().foreignTable).toBe(accounts);
    expect(toAccountFk?.reference().columns.map((c) => c.name)).toEqual([
      "household_id",
      "to_account_id",
    ]);

    const paidByFk = foreignKeys.find(
      (fk) => fk.getName() === "transactions_household_paid_by_person_fk",
    );
    expect(paidByFk?.reference().foreignTable).toBe(householdMemberships);
    expect(paidByFk?.reference().columns.map((c) => c.name)).toEqual([
      "household_id",
      "paid_by_person_id",
    ]);

    const receivedByFk = foreignKeys.find(
      (fk) => fk.getName() === "transactions_household_received_by_person_fk",
    );
    expect(receivedByFk?.reference().foreignTable).toBe(householdMemberships);
    expect(receivedByFk?.reference().columns.map((c) => c.name)).toEqual([
      "household_id",
      "received_by_person_id",
    ]);

    // Also references households directly
    const householdFk = foreignKeys.find(
      (fk) => fk.reference().foreignTable === households,
    );
    expect(householdFk).toBeDefined();
    expect(householdFk?.onDelete).toBe("cascade");
  });

  it("configures indexes for efficient querying by household and date", () => {
    const config = getTableConfig(transactions);
    const indexNames = config.indexes.map((idx) => idx.config.name);

    expect(indexNames).toContain("transactions_household_id_idx");
    expect(indexNames).toContain("transactions_account_id_idx");
    expect(indexNames).toContain("transactions_category_id_idx");
    expect(indexNames).toContain("transactions_from_account_id_idx");
    expect(indexNames).toContain("transactions_to_account_id_idx");
    expect(indexNames).toContain("transactions_occurred_on_idx");
    expect(indexNames).toContain("transactions_household_occurred_on_idx");
  });
});
