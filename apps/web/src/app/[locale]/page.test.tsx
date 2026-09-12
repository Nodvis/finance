import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn((namespace: string) => {
    return (key: string, params?: Record<string, unknown>) => {
      if (params) {
        return `${namespace}.${key}:${JSON.stringify(params)}`;
      }
      return `${namespace}.${key}`;
    };
  }),
}));

vi.mock("@nodvis/finance-db", () => ({
  isInstanceInitialized: vi.fn().mockResolvedValue(true),
  listAccountsByHousehold: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: vi.fn(),
}));

vi.mock("@/lib/authorization/household", () => ({
  getCurrentUserHouseholdsStatus: vi.fn(),
}));

vi.mock("@/lib/categories/service", () => ({
  listHouseholdCategories: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/transactions/service", () => ({
  listManualTransactions: vi.fn(),
}));

vi.mock("@/lib/transactions/serialization", () => ({
  serializeTransaction: vi.fn((tx) => tx),
}));

vi.mock("@/lib/overview/service", () => ({
  getHouseholdOverview: vi.fn(),
}));

vi.mock("@/lib/forecast/service", () => ({
  getHouseholdCashForecast: vi.fn(),
}));

import { isInstanceInitialized, listAccountsByHousehold } from "@nodvis/finance-db";
import { getCurrentSession } from "@/lib/auth/session";
import { getCurrentUserHouseholdsStatus } from "@/lib/authorization/household";
import { listHouseholdCategories } from "@/lib/categories/service";
import { getHouseholdOverview } from "@/lib/overview/service";
import { getHouseholdCashForecast } from "@/lib/forecast/service";
import { listManualTransactions } from "@/lib/transactions/service";
import HomePage from "./page";

describe("HomePage Server Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getHouseholdCashForecast).mockResolvedValue({
      asOf: "2026-09-10",
      horizonDays: 7,
      endDate: "2026-09-17",
      byCurrency: [],
    });
  });

  it("renders the sign-in section when user is unauthenticated", async () => {
    vi.mocked(getCurrentSession).mockResolvedValueOnce(null);

    const result = await HomePage({
      params: Promise.resolve({ locale: "pl" }),
    });

    expect(result).toBeDefined();
    expect(getCurrentSession).toHaveBeenCalled();
    expect(getCurrentUserHouseholdsStatus).not.toHaveBeenCalled();
  });

  it("renders setup wizard for an unauthenticated fresh instance", async () => {
    vi.mocked(getCurrentSession).mockResolvedValueOnce(null);
    vi.mocked(isInstanceInitialized).mockResolvedValueOnce(false);

    const result = await HomePage({
      params: Promise.resolve({ locale: "en" }),
    });

    expect(result).toBeDefined();
    expect(isInstanceInitialized).toHaveBeenCalled();
    expect(getCurrentUserHouseholdsStatus).not.toHaveBeenCalled();
  });

  it("renders no-household onboarding section when user is authenticated without a household", async () => {
    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "u-1", email: "alice@example.com", name: "Alice", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
      session: { id: "s-1", createdAt: new Date(), updatedAt: new Date(), userId: "u-1", expiresAt: new Date(), token: "t" },
    });
    vi.mocked(getCurrentUserHouseholdsStatus).mockResolvedValueOnce({
      status: "none",
    });

    const result = await HomePage({
      params: Promise.resolve({ locale: "en" }),
    });

    expect(result).toBeDefined();
    expect(getCurrentUserHouseholdsStatus).toHaveBeenCalled();
    expect(listAccountsByHousehold).not.toHaveBeenCalled();
    expect(getHouseholdOverview).not.toHaveBeenCalled();
  });

  it("renders household selection when user belongs to multiple households without active selection", async () => {
    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "u-1", email: "alice@example.com", name: "Alice", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
      session: { id: "s-1", createdAt: new Date(), updatedAt: new Date(), userId: "u-1", expiresAt: new Date(), token: "t" },
    });
    vi.mocked(getCurrentUserHouseholdsStatus).mockResolvedValueOnce({
      status: "multiple_needs_selection",
      households: [
        {
          householdId: "h-1",
          householdName: "Household 1",
          personId: "p-1",
          personDisplayName: "Alice",
          defaultCurrency: "PLN",
        },
        {
          householdId: "h-2",
          householdName: "Household 2",
          personId: "p-2",
          personDisplayName: "Alice",
          defaultCurrency: "EUR",
        },
      ],
    });

    const result = await HomePage({
      params: Promise.resolve({ locale: "pl" }),
    });

    expect(result).toBeDefined();
    expect(getCurrentUserHouseholdsStatus).toHaveBeenCalled();
    expect(listAccountsByHousehold).not.toHaveBeenCalled();
    expect(getHouseholdOverview).not.toHaveBeenCalled();
  });

  it("renders truthful overview, period metrics, and transaction forms when user has an active household", async () => {
    const householdId = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";
    const personId = "018f47a0-7762-7b9c-8d17-27f2f79e59a2";

    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "u-1", email: "alice@example.com", name: "Alice", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
      session: { id: "s-1", createdAt: new Date(), updatedAt: new Date(), userId: "u-1", expiresAt: new Date(), token: "t" },
    });
    vi.mocked(getCurrentUserHouseholdsStatus).mockResolvedValueOnce({
      status: "single",
      activeContext: {
        authUserId: "u-1",
        householdId: householdId as any,
        householdName: "Alice Household",
        personId: personId as any,
        personDisplayName: "Alice",
        defaultCurrency: "PLN",
      },
    });
    vi.mocked(listAccountsByHousehold).mockResolvedValueOnce([
      {
        id: "acc-1",
        householdId,
        name: "Checking",
        type: "checking",
        currency: "PLN",
        balanceSnapshotMinor: 1000000n,
        balanceSnapshotAt: new Date("2026-09-08T00:00:00Z"),
        archivedAt: null,
        ownerPersonIds: [],
      },
    ]);
    vi.mocked(listHouseholdCategories).mockResolvedValueOnce([]);
    vi.mocked(listManualTransactions).mockResolvedValueOnce([]);

    vi.mocked(getHouseholdOverview).mockResolvedValueOnce({
      householdId,
      period: {
        startDate: new Date("2026-09-01T00:00:00.000Z"),
        endDate: new Date("2026-09-30T23:59:59.999Z"),
        monthKey: "2026-09",
        prevMonthKey: "2026-08",
        nextMonthKey: "2026-10",
      },
      availableCash: {
        byCurrency: [
          {
            currency: "PLN" as any,
            amountMinor: 1000000n,
            freshAccountCount: 1,
            missingAccountCount: 0,
            staleAccountCount: 0,
            isComplete: true,
          },
        ],
        missingAccounts: [],
        staleAccounts: [],
        totalEligibleAccounts: 1,
        freshAccountsCount: 1,
        isFullyKnown: true,
      },
      cashFlow: {
        byCurrency: [
          {
            currency: "PLN" as any,
            incomeMinor: 500000n,
            spendingMinor: 200000n,
            netCashFlowMinor: 300000n,
            transactionCount: 4,
          },
        ],
        totalTransactionsCount: 4,
      },
      categorySpending: [
        {
          categoryId: "018f47a0-7762-7b9c-8d17-27f2f79e59a7" as any,
          categoryName: "Food",
          currency: "PLN",
          amountMinor: 200000n,
          transactionCount: 4,
          percentage: 100,
        },
      ],
    });

    const result = await HomePage({
      params: Promise.resolve({ locale: "pl" }),
      searchParams: Promise.resolve({ month: "2026-09" }),
    });

    expect(result).toBeDefined();
    expect(listAccountsByHousehold).toHaveBeenCalledWith(householdId, {
      includeArchived: false,
    });
    expect(getHouseholdOverview).toHaveBeenCalledWith(
      expect.objectContaining({ householdId }),
      {
        month: "2026-09",
        from: undefined,
        to: undefined,
      },
    );
    expect(listManualTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ householdId }),
      { limit: 50, offset: 0, includeVoided: true },
    );
  });
});
