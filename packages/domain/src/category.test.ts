import { describe, expect, it } from "vitest";

import {
  DEFAULT_POLISH_CATEGORIES,
  archiveCategory,
  categoryApplicability,
  categoryId,
  createCategory,
  generateDefaultCategoryId,
  householdId,
  isCategoryApplicableToKind,
  isCategoryArchived,
  renameCategory,
  unarchiveCategory,
} from "./index";

const householdUuid = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";
const categoryUuid = "018f47a0-7762-7b9c-8d17-27f2f79e59a9";

describe("Category domain model", () => {
  it("creates an active category with trimmed name and deep freezing", () => {
    const cat = createCategory({
      id: categoryId(categoryUuid),
      householdId: householdId(householdUuid),
      name: "  Jedzenie i chemia  ",
      applicability: "expense",
    });

    expect(cat).toEqual({
      id: categoryUuid,
      householdId: householdUuid,
      name: "Jedzenie i chemia",
      applicability: "expense",
      archivedAt: null,
    });
    expect(Object.isFrozen(cat)).toBe(true);
    expect(isCategoryArchived(cat)).toBe(false);
  });

  it("rejects blank, whitespace, and oversized names", () => {
    expect(() =>
      createCategory({
        id: categoryId(categoryUuid),
        householdId: householdId(householdUuid),
        name: "",
        applicability: "expense",
      }),
    ).toThrow(/Invalid category name/);

    expect(() =>
      createCategory({
        id: categoryId(categoryUuid),
        householdId: householdId(householdUuid),
        name: "    ",
        applicability: "expense",
      }),
    ).toThrow(/Invalid category name/);

    expect(() =>
      createCategory({
        id: categoryId(categoryUuid),
        householdId: householdId(householdUuid),
        name: "A".repeat(161),
        applicability: "expense",
      }),
    ).toThrow(/Invalid category name/);
  });

  it("validates applicability values", () => {
    expect(categoryApplicability("expense")).toBe("expense");
    expect(categoryApplicability("income")).toBe("income");
    expect(categoryApplicability("both")).toBe("both");

    expect(() => categoryApplicability("transfer")).toThrow(
      /Invalid category applicability/,
    );
    expect(() => categoryApplicability("invalid")).toThrow(
      /Invalid category applicability/,
    );
  });

  it("renames a category preserving other attributes", () => {
    const cat = createCategory({
      id: categoryId(categoryUuid),
      householdId: householdId(householdUuid),
      name: "Jedzenie",
      applicability: "expense",
    });

    const renamed = renameCategory(cat, "  Zakupy spożywcze  ");
    expect(renamed.name).toBe("Zakupy spożywcze");
    expect(renamed.id).toBe(cat.id);
    expect(renamed.householdId).toBe(cat.householdId);
    expect(renamed.applicability).toBe(cat.applicability);
    expect(renamed.archivedAt).toBeNull();
  });

  it("handles archive and unarchive state transitions", () => {
    const cat = createCategory({
      id: categoryId(categoryUuid),
      householdId: householdId(householdUuid),
      name: "Stara kategoria",
      applicability: "both",
    });

    expect(isCategoryArchived(cat)).toBe(false);

    const archiveTime = new Date("2026-09-08T10:00:00Z");
    const archived = archiveCategory(cat, archiveTime);

    expect(isCategoryArchived(archived)).toBe(true);
    expect(archived.archivedAt).toEqual(archiveTime);

    // Archiving an already archived category returns same reference
    expect(archiveCategory(archived)).toBe(archived);

    const restored = unarchiveCategory(archived);
    expect(isCategoryArchived(restored)).toBe(false);
    expect(restored.archivedAt).toBeNull();

    // Restoring an active category returns same reference
    expect(unarchiveCategory(restored)).toBe(restored);
  });

  it("determines kind applicability correctly", () => {
    expect(isCategoryApplicableToKind("expense", "expense")).toBe(true);
    expect(isCategoryApplicableToKind("expense", "income")).toBe(false);
    expect(isCategoryApplicableToKind("expense", "transfer")).toBe(false);

    expect(isCategoryApplicableToKind("income", "income")).toBe(true);
    expect(isCategoryApplicableToKind("income", "expense")).toBe(false);
    expect(isCategoryApplicableToKind("income", "transfer")).toBe(false);

    expect(isCategoryApplicableToKind("both", "expense")).toBe(true);
    expect(isCategoryApplicableToKind("both", "income")).toBe(true);
    expect(isCategoryApplicableToKind("both", "transfer")).toBe(false);
  });

  it("provides modest useful Polish default categories", () => {
    expect(DEFAULT_POLISH_CATEGORIES.length).toBeGreaterThanOrEqual(8);
    const keys = DEFAULT_POLISH_CATEGORIES.map((c) => c.key);
    expect(keys).toContain("groceries");
    expect(keys).toContain("housing");
    expect(keys).toContain("transport");
    expect(keys).toContain("salary");

    for (const def of DEFAULT_POLISH_CATEGORIES) {
      expect(def.name.trim().length).toBeGreaterThan(0);
      expect(["expense", "income", "both"]).toContain(def.applicability);
    }
  });

  it("generates stable, deterministic UUIDs for default categories per household", () => {
    const id1 = generateDefaultCategoryId(householdUuid, "groceries");
    const id2 = generateDefaultCategoryId(householdUuid, "groceries");
    const idDiff = generateDefaultCategoryId(householdUuid, "housing");

    expect(id1).toBe(id2);
    expect(id1).not.toBe(idDiff);
    // Verifies it is accepted by categoryId constructor
    expect(() => categoryId(id1)).not.toThrow();
  });
});
