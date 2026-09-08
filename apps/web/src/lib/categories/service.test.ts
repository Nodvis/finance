import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@nodvis/finance-db", () => ({
  CategoryNotFoundError: class CategoryNotFoundError extends Error {
    constructor(message: string = "Category not found in household") {
      super(message);
      this.name = "CategoryNotFoundError";
    }
  },
  archiveHouseholdCategory: vi.fn(),
  createHouseholdCategory: vi.fn(),
  findCategoryInHousehold: vi.fn(),
  listCategoriesByHousehold: vi.fn(),
  renameHouseholdCategory: vi.fn(),
  seedDefaultCategories: vi.fn(),
  unarchiveHouseholdCategory: vi.fn(),
}));

import {
  CategoryNotFoundError,
  archiveHouseholdCategory,
  createHouseholdCategory,
  findCategoryInHousehold,
  listCategoriesByHousehold,
  renameHouseholdCategory,
  seedDefaultCategories,
  unarchiveHouseholdCategory,
} from "@nodvis/finance-db";
import { householdId, personId } from "@nodvis/finance-domain";
import {
  archiveHouseholdCategoryEntry,
  createHouseholdCategoryEntry,
  getHouseholdCategory,
  listHouseholdCategories,
  renameHouseholdCategoryEntry,
  unarchiveHouseholdCategoryEntry,
} from "./service";

const validHousehold = householdId("018f47a0-7762-7b9c-8d17-27f2f79e59a1");
const validPerson = personId("018f47a0-7762-7b9c-8d17-27f2f79e59a2");
const validCategory = "018f47a0-7762-7b9c-8d17-27f2f79e59a3";

const testContext = {
  authUserId: "user-1",
  householdId: validHousehold,
  personId: validPerson,
  householdName: "Our Home",
  personDisplayName: "Eryk",
  defaultCurrency: "PLN",
};

describe("Categories Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listHouseholdCategories", () => {
    it("returns categories when found in household", async () => {
      const mockCategories = [
        {
          id: validCategory,
          householdId: validHousehold,
          name: "Groceries",
          applicability: "expense" as const,
          archivedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      vi.mocked(listCategoriesByHousehold).mockResolvedValueOnce(mockCategories);

      const result = await listHouseholdCategories(testContext, {
        includeArchived: false,
      });

      expect(result).toEqual(mockCategories);
      expect(listCategoriesByHousehold).toHaveBeenCalledWith(validHousehold, {
        includeArchived: false,
      });
      expect(seedDefaultCategories).not.toHaveBeenCalled();
    });

    it("seeds default categories when household has zero categories", async () => {
      vi.mocked(listCategoriesByHousehold)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: validCategory,
            householdId: validHousehold,
            name: "Jedzenie",
            applicability: "expense" as const,
            archivedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

      const result = await listHouseholdCategories(testContext);

      expect(seedDefaultCategories).toHaveBeenCalledWith(validHousehold);
      expect(listCategoriesByHousehold).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(1);
    });
  });

  describe("getHouseholdCategory", () => {
    it("returns category when found", async () => {
      const mockCategory = {
        id: validCategory,
        householdId: validHousehold,
        name: "Groceries",
        applicability: "expense" as const,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(findCategoryInHousehold).mockResolvedValueOnce(mockCategory);

      const result = await getHouseholdCategory(testContext, validCategory);

      expect(result).toEqual(mockCategory);
      expect(findCategoryInHousehold).toHaveBeenCalledWith(
        validHousehold,
        validCategory,
      );
    });

    it("throws CategoryNotFoundError when category not found", async () => {
      vi.mocked(findCategoryInHousehold).mockResolvedValueOnce(null);

      await expect(
        getHouseholdCategory(testContext, validCategory),
      ).rejects.toThrow(CategoryNotFoundError);
    });
  });

  describe("createHouseholdCategoryEntry", () => {
    it("creates a new category in household", async () => {
      const mockCategory = {
        id: validCategory,
        householdId: validHousehold,
        name: "Health",
        applicability: "expense" as const,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(createHouseholdCategory).mockResolvedValueOnce(mockCategory);

      const result = await createHouseholdCategoryEntry(testContext, {
        name: "Health",
        applicability: "expense",
      });

      expect(result).toEqual(mockCategory);
      expect(createHouseholdCategory).toHaveBeenCalledWith({
        householdId: validHousehold,
        name: "Health",
        applicability: "expense",
      });
    });
  });

  describe("renameHouseholdCategoryEntry", () => {
    it("renames category in household", async () => {
      const mockRenamed = {
        id: validCategory,
        householdId: validHousehold,
        name: "Groceries & Food",
        applicability: "expense" as const,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(renameHouseholdCategory).mockResolvedValueOnce(mockRenamed);

      const result = await renameHouseholdCategoryEntry(
        testContext,
        validCategory,
        { name: "Groceries & Food" },
      );

      expect(result).toEqual(mockRenamed);
      expect(renameHouseholdCategory).toHaveBeenCalledWith(
        validHousehold,
        validCategory,
        "Groceries & Food",
      );
    });
  });

  describe("archiveHouseholdCategoryEntry", () => {
    it("archives category in household", async () => {
      const mockArchived = {
        id: validCategory,
        householdId: validHousehold,
        name: "Groceries",
        applicability: "expense" as const,
        archivedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(archiveHouseholdCategory).mockResolvedValueOnce(mockArchived);

      const result = await archiveHouseholdCategoryEntry(
        testContext,
        validCategory,
      );

      expect(result).toEqual(mockArchived);
      expect(archiveHouseholdCategory).toHaveBeenCalledWith(
        validHousehold,
        validCategory,
      );
    });
  });

  describe("unarchiveHouseholdCategoryEntry", () => {
    it("unarchives category in household", async () => {
      const mockRestored = {
        id: validCategory,
        householdId: validHousehold,
        name: "Groceries",
        applicability: "expense" as const,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(unarchiveHouseholdCategory).mockResolvedValueOnce(mockRestored);

      const result = await unarchiveHouseholdCategoryEntry(
        testContext,
        validCategory,
      );

      expect(result).toEqual(mockRestored);
      expect(unarchiveHouseholdCategory).toHaveBeenCalledWith(
        validHousehold,
        validCategory,
      );
    });
  });
});
