import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import {
  HouseholdAccessDeniedError,
  requireHouseholdAccess,
} from "./household";
import { AuthenticationRequiredError } from "../auth/session";

vi.mock("server-only", () => ({}));

vi.mock("@nodvis/finance-db", () => ({
  findHouseholdAccessForAuthUser: vi.fn(),
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
  requireCurrentSession: vi.fn(),
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {
    constructor() {
      super("Authentication is required");
      this.name = "AuthenticationRequiredError";
    }
  },
}));

import { findHouseholdAccessForAuthUser } from "@nodvis/finance-db";
import { requireCurrentSession } from "@/lib/auth/session";

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
