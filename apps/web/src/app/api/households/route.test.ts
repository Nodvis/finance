import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/session", () => ({
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {
    constructor() {
      super("Authentication is required");
      this.name = "AuthenticationRequiredError";
    }
  },
  requireCurrentSession: vi.fn(),
}));

vi.mock("@nodvis/finance-db", () => ({
  InstanceAlreadyInitializedError: class InstanceAlreadyInitializedError extends Error {},
  createHouseholdOnboarding: vi.fn(),
  listHouseholdsForAuthUser: vi.fn(),
}));

import { AuthenticationRequiredError, requireCurrentSession } from "@/lib/auth/session";
import { createHouseholdOnboarding, listHouseholdsForAuthUser } from "@nodvis/finance-db";
import { GET, POST } from "./route";

const validAuthUserId = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";
const validHouseholdId = "018f47a0-7762-7b9c-8d17-27f2f79e59a2";
const validPersonId = "018f47a0-7762-7b9c-8d17-27f2f79e59a3";

describe("/api/households (Onboarding & Listing)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("returns 401 when unauthenticated", async () => {
      vi.mocked(requireCurrentSession).mockRejectedValueOnce(
        new AuthenticationRequiredError(),
      );

      const res = await GET();
      expect(res.status).toBe(401);
    });

    it("returns 200 with list of households", async () => {
      vi.mocked(requireCurrentSession).mockResolvedValueOnce({
        user: { id: validAuthUserId, email: "user@example.com", name: "User", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
        session: { id: "s-1", userId: validAuthUserId, expiresAt: new Date(), createdAt: new Date(), updatedAt: new Date(), token: "t" },
      });
      vi.mocked(listHouseholdsForAuthUser).mockResolvedValueOnce([
        {
          householdId: validHouseholdId,
          personId: validPersonId,
          householdName: "Our Household",
          defaultCurrency: "PLN",
          personDisplayName: "Jan",
        },
      ]);

      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
    });
  });

  describe("POST", () => {
    it("returns 401 when unauthenticated", async () => {
      vi.mocked(requireCurrentSession).mockRejectedValueOnce(
        new AuthenticationRequiredError(),
      );

      const req = new Request("http://localhost/api/households", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Family", defaultCurrency: "PLN" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("returns 400 when validation fails", async () => {
      vi.mocked(requireCurrentSession).mockResolvedValueOnce({
        user: { id: validAuthUserId, email: "user@example.com", name: "User", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
        session: { id: "s-1", userId: validAuthUserId, expiresAt: new Date(), createdAt: new Date(), updatedAt: new Date(), token: "t" },
      });

      const req = new Request("http://localhost/api/households", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "", defaultCurrency: "INVALID" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("creates household transactionally and returns 201 with cookie set", async () => {
      vi.mocked(requireCurrentSession).mockResolvedValueOnce({
        user: { id: validAuthUserId, email: "user@example.com", name: "User", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
        session: { id: "s-1", userId: validAuthUserId, expiresAt: new Date(), createdAt: new Date(), updatedAt: new Date(), token: "t" },
      });
      vi.mocked(createHouseholdOnboarding).mockResolvedValueOnce({
        householdId: validHouseholdId,
        householdName: "New Home",
        defaultCurrency: "PLN",
        personId: validPersonId,
        personDisplayName: "Jan",
      });

      const req = new Request("http://localhost/api/households", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Home", defaultCurrency: "PLN" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.householdId).toBe(validHouseholdId);
      expect(res.cookies.get("nodvis_active_household")?.value).toBe(validHouseholdId);
      expect(createHouseholdOnboarding).toHaveBeenCalledWith({
        authUserId: validAuthUserId,
        householdName: "New Home",
        defaultCurrency: "PLN",
        personDisplayName: undefined,
        bootstrap: undefined,
      });
    });
  });
});
