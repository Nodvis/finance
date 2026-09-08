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
  unarchiveHouseholdCategoryEntry: vi.fn(),
}));

import { AuthenticationRequiredError } from "@/lib/auth/session";
import {
  HouseholdAccessDeniedError,
  requireHouseholdAccess,
} from "@/lib/authorization/household";
import {
  CategoryNotFoundError,
  unarchiveHouseholdCategoryEntry,
} from "@/lib/categories/service";
import { POST } from "./route";

const validHousehold = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";
const validCategory = "018f47a0-7762-7b9c-8d17-27f2f79e59a2";
const testAccess = {
  authUserId: "user-1",
  householdId: validHousehold,
  personId: "person-1",
};

describe("/api/households/[householdId]/categories/[categoryId]/unarchive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requireHouseholdAccess).mockRejectedValueOnce(
      new AuthenticationRequiredError(),
    );

    const res = await POST(new Request("http://localhost/unarchive"), {
      params: Promise.resolve({
        householdId: validHousehold,
        categoryId: validCategory,
      }),
    });

    expect(res.status).toBe(401);
  });

  it("returns 404 when category not found", async () => {
    vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(testAccess as any);
    vi.mocked(unarchiveHouseholdCategoryEntry).mockRejectedValueOnce(
      new CategoryNotFoundError(),
    );

    const res = await POST(new Request("http://localhost/unarchive"), {
      params: Promise.resolve({
        householdId: validHousehold,
        categoryId: validCategory,
      }),
    });

    expect(res.status).toBe(404);
  });

  it("returns 200 with unarchived category on success", async () => {
    vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(testAccess as any);
    vi.mocked(unarchiveHouseholdCategoryEntry).mockResolvedValueOnce({
      id: validCategory,
      householdId: validHousehold,
      name: "Groceries",
      applicability: "expense",
      archivedAt: null,
      createdAt: new Date("2026-09-08T10:00:00Z"),
      updatedAt: new Date("2026-09-08T12:00:00Z"),
    });

    const res = await POST(new Request("http://localhost/unarchive"), {
      params: Promise.resolve({
        householdId: validHousehold,
        categoryId: validCategory,
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.archivedAt).toBeNull();
  });
});
