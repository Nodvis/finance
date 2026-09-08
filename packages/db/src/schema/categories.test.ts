import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { CATEGORY_APPLICABILITIES } from "@nodvis/finance-domain";

import {
  categories,
  categoryApplicabilityEnum,
  households,
} from "./index";

describe("categories schema", () => {
  it("uses domain category applicabilities as PostgreSQL enum", () => {
    expect(categoryApplicabilityEnum.enumValues).toEqual(
      CATEGORY_APPLICABILITIES,
    );
  });

  it("defines required columns and audit timestamps", () => {
    expect(categories.id.notNull).toBe(true);
    expect(categories.householdId.notNull).toBe(true);
    expect(categories.name.notNull).toBe(true);
    expect(categories.applicability.notNull).toBe(true);
    expect(categories.archivedAt.notNull).toBe(false);
    expect(categories.createdAt.notNull).toBe(true);
    expect(categories.updatedAt.notNull).toBe(true);
  });

  it("configures unique and check constraints", () => {
    const config = getTableConfig(categories);
    const checks = config.checks.map((c) => c.name);
    const uniqueNames = config.uniqueConstraints.map((u) => u.name);

    expect(checks).toContain("categories_name_not_blank");
    expect(uniqueNames).toContain("categories_household_id_id_unique");
  });

  it("enforces cascade deletion with household", () => {
    const config = getTableConfig(categories);
    const householdFk = config.foreignKeys.find(
      (fk) => fk.reference().foreignTable === households,
    );
    expect(householdFk).toBeDefined();
    expect(householdFk?.onDelete).toBe("cascade");
  });

  it("indexes categories by household_id", () => {
    const config = getTableConfig(categories);
    const indexNames = config.indexes.map((idx) => idx.config.name);
    expect(indexNames).toContain("categories_household_id_idx");
  });
});
