import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/session", () => ({
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {
    constructor() {
      super("Authentication is required");
      this.name = "AuthenticationRequiredError";
    }
  },
}));

vi.mock("@/lib/authorization/household", () => ({
  HouseholdAccessDeniedError: class HouseholdAccessDeniedError extends Error {
    constructor() {
      super("Household access denied");
      this.name = "HouseholdAccessDeniedError";
    }
  },
  requireHouseholdAccess: vi.fn(),
}));

vi.mock("@/lib/categories/service", () => ({
  CategoryNotFoundError: class CategoryNotFoundError extends Error {
    constructor() {
      super("Category not found in household");
      this.name = "CategoryNotFoundError";
    }
  },
  getHouseholdCategory: vi.fn(),
  renameHouseholdCategoryEntry: vi.fn(),
}));

import { AuthenticationRequiredError } from "@/lib/auth/session";
import {
  HouseholdAccessDeniedError,
  requireHouseholdAccess,
} from "@/lib/authorization/household";
import {
  CategoryNotFoundError,
  getHouseholdCategory,
  renameHouseholdCategoryEntry,
} from "@/lib/categories/service";
import { GET, PATCH } from "./route";

const validHousehold = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";
const validCategory = "018f47a0-7762-7b9c-8d17-27f2f79e59a2";
const testAccess = {
  authUserId: "user-1",
  householdId: validHousehold,
  personId: "person-1",
};

describe("/api/households/[householdId]/categories/[categoryId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("returns 404 when category not found", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(
        testAccess as any,
      );
      vi.mocked(getHouseholdCategory).mockRejectedValueOnce(
        new CategoryNotFoundError(),
      );

      const res = await GET(
        new Request(
          `http://localhost/api/households/${validHousehold}/categories/${validCategory}`,
        ),
        {
          params: Promise.resolve({
            householdId: validHousehold,
            categoryId: validCategory,
          }),
        },
      );

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("Category not found in household");
    });

    it("returns 200 with serialized category when found", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(
        testAccess as any,
      );
      vi.mocked(getHouseholdCategory).mockResolvedValueOnce({
        id: validCategory,
        householdId: validHousehold,
        name: "Groceries",
        applicability: "expense",
        archivedAt: null,
        createdAt: new Date("2026-09-08T10:00:00Z"),
        updatedAt: new Date("2026-09-08T10:00:00Z"),
      });

      const res = await GET(
        new Request(
          `http://localhost/api/households/${validHousehold}/categories/${validCategory}`,
        ),
        {
          params: Promise.resolve({
            householdId: validHousehold,
            categoryId: validCategory,
          }),
        },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.name).toBe("Groceries");
    });
  });

  describe("PATCH", () => {
    it("returns 400 for invalid body schema", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(
        testAccess as any,
      );

      const res = await PATCH(
        new Request(
          `http://localhost/api/households/${validHousehold}/categories/${validCategory}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "" }),
          },
        ),
        {
          params: Promise.resolve({
            householdId: validHousehold,
            categoryId: validCategory,
          }),
        },
      );

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Validation error");
    });

    it("returns 200 with updated category", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(
        testAccess as any,
      );
      vi.mocked(renameHouseholdCategoryEntry).mockResolvedValueOnce({
        id: validCategory,
        householdId: validHousehold,
        name: "Food & Drinks",
        applicability: "expense",
        archivedAt: null,
        createdAt: new Date("2026-09-08T10:00:00Z"),
        updatedAt: new Date("2026-09-08T10:00:00Z"),
      });

      const res = await PATCH(
        new Request(
          `http://localhost/api/households/${validHousehold}/categories/${validCategory}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "Food & Drinks" }),
          },
        ),
        {
          params: Promise.resolve({
            householdId: validHousehold,
            categoryId: validCategory,
          }),
        },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.name).toBe("Food & Drinks");
    });
  });
});
