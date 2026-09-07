import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import {
  getCurrentUserHouseholdContext,
  getCurrentUserHouseholdsStatus,
  HouseholdAccessDeniedError,
  requireCurrentUserHouseholdContext,
  requireHouseholdAccess,
} from "./household";
import { AuthenticationRequiredError } from "../auth/session";

vi.mock("server-only", () => ({}));

vi.mock("@nodvis/finance-db", () => ({
  findDefaultHouseholdForAuthUser: vi.fn(),
  findHouseholdAccessForAuthUser: vi.fn(),
  listHouseholdsForAuthUser: vi.fn(),
  getDb: vi.fn(() => ({})),
  betterAuthSchema: {},
}));

vi.mock("@/lib/auth/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: vi.fn(),
  requireCurrentSession: vi.fn(),
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {
    constructor() {
      super("Authentication is required");
      this.name = "AuthenticationRequiredError";
    }
  },
}));

import {
  findDefaultHouseholdForAuthUser,
  findHouseholdAccessForAuthUser,
  listHouseholdsForAuthUser,
} from "@nodvis/finance-db";
import { getCurrentSession, requireCurrentSession } from "@/lib/auth/session";

const validHouseholdId = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";
const validPersonId = "018f47a0-7762-7b9c-8d17-27f2f79e59a2";
const validAuthUserId = "018f47a0-7762-7b9c-8d17-27f2f79e59a3";

describe("requireHouseholdAccess", () => {
  it("rejects invalid household UUIDs without querying the database", async () => {
    await expect(requireHouseholdAccess("not-a-uuid")).rejects.toThrow(
      ZodError,
    );
    expect(requireCurrentSession).not.toHaveBeenCalled();
    expect(findHouseholdAccessForAuthUser).not.toHaveBeenCalled();
  });

  it("throws AuthenticationRequiredError if there is no authenticated session", async () => {
    vi.mocked(requireCurrentSession).mockRejectedValueOnce(
      new AuthenticationRequiredError(),
    );

    await expect(requireHouseholdAccess(validHouseholdId)).rejects.toThrow(
      AuthenticationRequiredError,
    );
  });

  it("throws HouseholdAccessDeniedError if user does not belong to the household", async () => {
    vi.mocked(requireCurrentSession).mockResolvedValueOnce({
      user: { id: validAuthUserId, email: "user@example.com", name: "User", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
      session: { id: "session-1", createdAt: new Date(), updatedAt: new Date(), userId: validAuthUserId, expiresAt: new Date(), token: "tok" },
    });

    vi.mocked(findHouseholdAccessForAuthUser).mockResolvedValueOnce(null);

    await expect(requireHouseholdAccess(validHouseholdId)).rejects.toThrow(
      HouseholdAccessDeniedError,
    );
    expect(findHouseholdAccessForAuthUser).toHaveBeenCalledWith(
      validAuthUserId,
      validHouseholdId,
    );
  });

  it("returns authorized household context when user is a valid member", async () => {
    vi.mocked(requireCurrentSession).mockResolvedValueOnce({
      user: { id: validAuthUserId, email: "user@example.com", name: "User", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
      session: { id: "session-1", createdAt: new Date(), updatedAt: new Date(), userId: validAuthUserId, expiresAt: new Date(), token: "tok" },
    });

    vi.mocked(findHouseholdAccessForAuthUser).mockResolvedValueOnce({
      householdId: validHouseholdId,
      personId: validPersonId,
    });

    const access = await requireHouseholdAccess(validHouseholdId);

    expect(access).toEqual({
      authUserId: validAuthUserId,
      householdId: validHouseholdId,
      personId: validPersonId,
    });
  });
});

describe("getCurrentUserHouseholdContext", () => {
  it("returns null when no session is present", async () => {
    vi.mocked(getCurrentSession).mockResolvedValueOnce(null);

    const context = await getCurrentUserHouseholdContext();
    expect(context).toBeNull();
  });

  it("returns null when user has no linked household", async () => {
    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: validAuthUserId, email: "user@example.com", name: "User", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
      session: { id: "session-1", createdAt: new Date(), updatedAt: new Date(), userId: validAuthUserId, expiresAt: new Date(), token: "tok" },
    });
    vi.mocked(findDefaultHouseholdForAuthUser).mockResolvedValueOnce(null);

    const context = await getCurrentUserHouseholdContext();
    expect(context).toBeNull();
    expect(findDefaultHouseholdForAuthUser).toHaveBeenCalledWith(validAuthUserId);
  });

  it("returns authorized household context when user is linked to a household", async () => {
    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: validAuthUserId, email: "user@example.com", name: "User", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
      session: { id: "session-1", createdAt: new Date(), updatedAt: new Date(), userId: validAuthUserId, expiresAt: new Date(), token: "tok" },
    });
    vi.mocked(findDefaultHouseholdForAuthUser).mockResolvedValueOnce({
      householdId: validHouseholdId,
      householdName: "Our Household",
      personId: validPersonId,
      personDisplayName: "Alice",
      defaultCurrency: "PLN",
    });

    const context = await getCurrentUserHouseholdContext();
    expect(context).toEqual({
      authUserId: validAuthUserId,
      householdId: validHouseholdId,
      householdName: "Our Household",
      personId: validPersonId,
      personDisplayName: "Alice",
      defaultCurrency: "PLN",
    });
  });
});

describe("requireCurrentUserHouseholdContext", () => {
  it("throws AuthenticationRequiredError when unauthenticated", async () => {
    vi.mocked(requireCurrentSession).mockRejectedValueOnce(
      new AuthenticationRequiredError(),
    );

    await expect(requireCurrentUserHouseholdContext()).rejects.toThrow(
      AuthenticationRequiredError,
    );
  });

  it("throws HouseholdAccessDeniedError when user has no linked household", async () => {
    vi.mocked(requireCurrentSession).mockResolvedValueOnce({
      user: { id: validAuthUserId, email: "user@example.com", name: "User", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
      session: { id: "session-1", createdAt: new Date(), updatedAt: new Date(), userId: validAuthUserId, expiresAt: new Date(), token: "tok" },
    });
    vi.mocked(findDefaultHouseholdForAuthUser).mockResolvedValueOnce(null);

    await expect(requireCurrentUserHouseholdContext()).rejects.toThrow(
      HouseholdAccessDeniedError,
    );
  });

  it("returns context when user has a linked household", async () => {
    vi.mocked(requireCurrentSession).mockResolvedValueOnce({
      user: { id: validAuthUserId, email: "user@example.com", name: "User", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
      session: { id: "session-1", createdAt: new Date(), updatedAt: new Date(), userId: validAuthUserId, expiresAt: new Date(), token: "tok" },
    });
    vi.mocked(findDefaultHouseholdForAuthUser).mockResolvedValueOnce({
      householdId: validHouseholdId,
      householdName: "Our Household",
      personId: validPersonId,
      personDisplayName: "Alice",
      defaultCurrency: "PLN",
    });

    const context = await requireCurrentUserHouseholdContext();
    expect(context).toEqual({
      authUserId: validAuthUserId,
      householdId: validHouseholdId,
      householdName: "Our Household",
      personId: validPersonId,
      personDisplayName: "Alice",
      defaultCurrency: "PLN",
    });
  });
});

describe("getCurrentUserHouseholdsStatus", () => {
  it("returns unauthenticated when there is no active session", async () => {
    vi.mocked(getCurrentSession).mockResolvedValueOnce(null);
    const status = await getCurrentUserHouseholdsStatus();
    expect(status).toEqual({ status: "unauthenticated" });
  });

  it("returns none when user has no households linked", async () => {
    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: validAuthUserId, email: "user@example.com", name: "User", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
      session: { id: "session-1", createdAt: new Date(), updatedAt: new Date(), userId: validAuthUserId, expiresAt: new Date(), token: "tok" },
    });
    vi.mocked(listHouseholdsForAuthUser).mockResolvedValueOnce([]);

    const status = await getCurrentUserHouseholdsStatus();
    expect(status).toEqual({ status: "none" });
  });

  it("returns single with activeContext when user has exactly one household", async () => {
    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: validAuthUserId, email: "user@example.com", name: "User", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
      session: { id: "session-1", createdAt: new Date(), updatedAt: new Date(), userId: validAuthUserId, expiresAt: new Date(), token: "tok" },
    });
    vi.mocked(listHouseholdsForAuthUser).mockResolvedValueOnce([
      {
        householdId: validHouseholdId,
        personId: validPersonId,
        householdName: "Solo Household",
        defaultCurrency: "PLN",
        personDisplayName: "Eryk",
      },
    ]);

    const status = await getCurrentUserHouseholdsStatus();
    expect(status.status).toBe("single");
    if (status.status === "single") {
      expect(status.activeContext.householdId).toBe(validHouseholdId);
      expect(status.activeContext.householdName).toBe("Solo Household");
    }
  });

  it("returns multiple_needs_selection without silently picking when multiple exist and none selected", async () => {
    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: validAuthUserId, email: "user@example.com", name: "User", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
      session: { id: "session-1", createdAt: new Date(), updatedAt: new Date(), userId: validAuthUserId, expiresAt: new Date(), token: "tok" },
    });
    const secondHouseholdId = "018f47a0-7762-7b9c-8d17-27f2f79e59a4";
    const householdsList = [
      {
        householdId: validHouseholdId,
        personId: validPersonId,
        householdName: "Household A",
        defaultCurrency: "PLN",
        personDisplayName: "Eryk",
      },
      {
        householdId: secondHouseholdId,
        personId: validPersonId,
        householdName: "Household B",
        defaultCurrency: "EUR",
        personDisplayName: "Eryk",
      },
    ];
    vi.mocked(listHouseholdsForAuthUser).mockResolvedValueOnce(householdsList);

    const status = await getCurrentUserHouseholdsStatus();
    expect(status.status).toBe("multiple_needs_selection");
    if (status.status === "multiple_needs_selection") {
      expect(status.households).toHaveLength(2);
      expect(status.households[0]!.householdName).toBe("Household A");
      expect(status.households[1]!.householdName).toBe("Household B");
    }
  });
});
