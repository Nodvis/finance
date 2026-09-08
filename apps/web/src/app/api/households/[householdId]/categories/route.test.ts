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
  createHouseholdCategoryEntry: vi.fn(),
  listHouseholdCategories: vi.fn(),
}));

import { AuthenticationRequiredError } from "@/lib/auth/session";
import {
  HouseholdAccessDeniedError,
  requireHouseholdAccess,
} from "@/lib/authorization/household";
import {
  createHouseholdCategoryEntry,
  listHouseholdCategories,
} from "@/lib/categories/service";
import { GET, POST } from "./route";

const validHousehold = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";
const validCategory = "018f47a0-7762-7b9c-8d17-27f2f79e59a2";
const testAccess = {
  authUserId: "user-1",
  householdId: validHousehold,
  personId: "person-1",
};

describe("/api/households/[householdId]/categories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("returns 401 when authentication is missing", async () => {
      vi.mocked(requireHouseholdAccess).mockRejectedValueOnce(
        new AuthenticationRequiredError(),
      );

      const res = await GET(
        new Request("http://localhost/api/households/h-1/categories"),
        { params: Promise.resolve({ householdId: "h-1" }) },
      );

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("Authentication is required");
    });

    it("returns 403 when household access is denied", async () => {
      vi.mocked(requireHouseholdAccess).mockRejectedValueOnce(
        new HouseholdAccessDeniedError(),
      );

      const res = await GET(
        new Request("http://localhost/api/households/h-1/categories"),
        { params: Promise.resolve({ householdId: "h-1" }) },
      );

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe("Household access denied");
    });

    it("returns 200 with serialized categories on success", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(
        testAccess as any,
      );
      vi.mocked(listHouseholdCategories).mockResolvedValueOnce([
        {
          id: validCategory,
          householdId: validHousehold,
          name: "Groceries",
          applicability: "expense",
          archivedAt: null,
          createdAt: new Date("2026-09-08T10:00:00Z"),
          updatedAt: new Date("2026-09-08T10:00:00Z"),
        },
      ]);

      const res = await GET(
        new Request(
          `http://localhost/api/households/${validHousehold}/categories?includeArchived=true`,
        ),
        { params: Promise.resolve({ householdId: validHousehold }) },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toEqual([
        {
          id: validCategory,
          householdId: validHousehold,
          name: "Groceries",
          applicability: "expense",
          archivedAt: null,
          createdAt: "2026-09-08T10:00:00.000Z",
          updatedAt: "2026-09-08T10:00:00.000Z",
        },
      ]);
    });
  });

  describe("POST", () => {
    it("returns 400 for invalid body schema", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(
        testAccess as any,
      );

      const res = await POST(
        new Request(
          `http://localhost/api/households/${validHousehold}/categories`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "" }),
          },
        ),
        { params: Promise.resolve({ householdId: validHousehold }) },
      );

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Validation error");
    });

    it("returns 201 with serialized category on success", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(
        testAccess as any,
      );
      vi.mocked(createHouseholdCategoryEntry).mockResolvedValueOnce({
        id: validCategory,
        householdId: validHousehold,
        name: "Health",
        applicability: "expense",
        archivedAt: null,
        createdAt: new Date("2026-09-08T10:00:00Z"),
        updatedAt: new Date("2026-09-08T10:00:00Z"),
      });

      const res = await POST(
        new Request(
          `http://localhost/api/households/${validHousehold}/categories`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: "Health",
              applicability: "expense",
            }),
          },
        ),
        { params: Promise.resolve({ householdId: validHousehold }) },
      );

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.name).toBe("Health");
      expect(json.data.applicability).toBe("expense");
    });
  });
});
