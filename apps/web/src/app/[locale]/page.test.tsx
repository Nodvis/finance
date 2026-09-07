import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn((namespace: string) => {
    return (key: string) => `${namespace}.${key}`;
  }),
}));

vi.mock("@nodvis/finance-db", () => ({
  listAccountsByHousehold: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: vi.fn(),
}));

vi.mock("@/lib/authorization/household", () => ({
  getCurrentUserHouseholdContext: vi.fn(),
}));

vi.mock("@/lib/transactions/service", () => ({
  listManualTransactions: vi.fn(),
}));

vi.mock("@/lib/transactions/serialization", () => ({
  serializeTransaction: vi.fn((tx) => tx),
}));

import { listAccountsByHousehold } from "@nodvis/finance-db";
import { getCurrentSession } from "@/lib/auth/session";
import { getCurrentUserHouseholdContext } from "@/lib/authorization/household";
import { listManualTransactions } from "@/lib/transactions/service";
import HomePage from "./page";

describe("HomePage Server Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the sign-in section when user is unauthenticated", async () => {
    vi.mocked(getCurrentSession).mockResolvedValueOnce(null);

    const result = await HomePage({
      params: Promise.resolve({ locale: "pl" }),
    });

    expect(result).toBeDefined();
    expect(getCurrentSession).toHaveBeenCalled();
    expect(getCurrentUserHouseholdContext).not.toHaveBeenCalled();
  });

  it("renders no-household section when user is authenticated without a household", async () => {
    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "u-1", email: "alice@example.com", name: "Alice", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
      session: { id: "s-1", createdAt: new Date(), updatedAt: new Date(), userId: "u-1", expiresAt: new Date(), token: "t" },
    });
    vi.mocked(getCurrentUserHouseholdContext).mockResolvedValueOnce(null);

    const result = await HomePage({
      params: Promise.resolve({ locale: "en" }),
    });

    expect(result).toBeDefined();
    expect(getCurrentUserHouseholdContext).toHaveBeenCalled();
    expect(listAccountsByHousehold).not.toHaveBeenCalled();
  });

  it("renders transaction forms and list when user has an authorized household", async () => {
    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "u-1", email: "alice@example.com", name: "Alice", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
      session: { id: "s-1", createdAt: new Date(), updatedAt: new Date(), userId: "u-1", expiresAt: new Date(), token: "t" },
    });
    vi.mocked(getCurrentUserHouseholdContext).mockResolvedValueOnce({
      authUserId: "u-1",
      householdId: "018f47a0-7762-7b9c-8d17-27f2f79e59a1" as any,
      householdName: "Alice Household",
      personId: "018f47a0-7762-7b9c-8d17-27f2f79e59a2" as any,
      personDisplayName: "Alice",
      defaultCurrency: "PLN",
    });
    vi.mocked(listAccountsByHousehold).mockResolvedValueOnce([
      {
        id: "acc-1",
        householdId: "018f47a0-7762-7b9c-8d17-27f2f79e59a1",
        name: "Checking",
        type: "checking",
        currency: "PLN",
      },
    ]);
    vi.mocked(listManualTransactions).mockResolvedValueOnce([]);

    const result = await HomePage({
      params: Promise.resolve({ locale: "pl" }),
    });

    expect(result).toBeDefined();
    expect(listAccountsByHousehold).toHaveBeenCalledWith("018f47a0-7762-7b9c-8d17-27f2f79e59a1");
    expect(listManualTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ householdId: "018f47a0-7762-7b9c-8d17-27f2f79e59a1" }),
      { limit: 50, offset: 0 },
    );
  });
});
