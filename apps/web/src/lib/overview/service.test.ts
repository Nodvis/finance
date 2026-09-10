import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@nodvis/finance-db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@nodvis/finance-db")>();
  return {
    ...actual,
    isPersonInHousehold: vi.fn(),
    getHouseholdPeriodCashFlow: vi.fn(),
    getHouseholdPeriodCategorySpending: vi.fn(),
    getHouseholdEligibleAccounts: vi.fn(),
    getUpcomingObligationsSummary: vi.fn(),
  };
});

import {
  getHouseholdEligibleAccounts,
  getHouseholdPeriodCashFlow,
  getHouseholdPeriodCategorySpending,
  getUpcomingObligationsSummary,
  isPersonInHousehold,
} from "@nodvis/finance-db";
import { householdId, personId } from "@nodvis/finance-domain";

import { HouseholdAccessDeniedError, getHouseholdOverview } from "./service";

describe("Household Overview Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const context = {
    authUserId: "auth-1",
    householdId: householdId("018f47a0-7762-7b9c-8d17-27f2f79e59a1"),
    householdName: "Alice & Bob Home",
    personId: personId("018f47a0-7762-7b9c-8d17-27f2f79e59a2"),
    personDisplayName: "Alice",
    defaultCurrency: "PLN",
  };

  const asOf = new Date("2026-09-10T12:00:00Z");

  it("throws HouseholdAccessDeniedError if person is not a member of the household", async () => {
    vi.mocked(isPersonInHousehold).mockResolvedValueOnce(false);

    await expect(
      getHouseholdOverview(context, { month: "2026-09" }),
    ).rejects.toThrow(HouseholdAccessDeniedError);

    expect(isPersonInHousehold).toHaveBeenCalledWith(
      context.householdId,
      context.personId,
    );
  });

  it("aggregates overview for a specific month with exact bigints and multi-currency support", async () => {
    vi.mocked(isPersonInHousehold).mockResolvedValueOnce(true);

    vi.mocked(getHouseholdPeriodCashFlow).mockResolvedValueOnce([
      {
        kind: "income",
        currency: "PLN",
        totalMinor: 10_000_000_000_000_000n, // Large bigint > 2^53 - 1
        transactionCount: 2,
      },
      {
        kind: "expense",
        currency: "PLN",
        totalMinor: 2_500_000_000_000_000n,
        transactionCount: 5,
      },
      {
        kind: "income",
        currency: "EUR",
        totalMinor: 50000n,
        transactionCount: 1,
      },
    ]);

    vi.mocked(getHouseholdPeriodCategorySpending).mockResolvedValueOnce([
      {
        categoryId: "018f47a0-7762-7b9c-8d17-27f2f79e59d1",
        categoryName: "Food",
        currency: "PLN",
        totalMinor: 1_250_000_000_000_000n,
        transactionCount: 3,
      },
      {
        categoryId: null, // Uncategorized
        categoryName: null,
        currency: "PLN",
        totalMinor: 1_250_000_000_000_000n,
        transactionCount: 2,
      },
    ]);

    vi.mocked(getHouseholdEligibleAccounts).mockResolvedValueOnce([
      {
        id: "018f47a0-7762-7b9c-8d17-27f2f79e59a3",
        householdId: context.householdId,
        name: "Checking",
        type: "checking",
        currency: "PLN",
        balanceSnapshotMinor: 500000n,
        balanceSnapshotAt: new Date("2026-09-08T00:00:00Z"), // Fresh
      },
      {
        id: "018f47a0-7762-7b9c-8d17-27f2f79e59a4",
        householdId: context.householdId,
        name: "Old Savings",
        type: "savings",
        currency: "PLN",
        balanceSnapshotMinor: 2000000n,
        balanceSnapshotAt: new Date("2026-01-01T00:00:00Z"), // Stale (> 30 days)
      },
      {
        id: "018f47a0-7762-7b9c-8d17-27f2f79e59a5",
        householdId: context.householdId,
        name: "Emergency Cash",
        type: "cash",
        currency: "PLN",
        balanceSnapshotMinor: null, // Missing
        balanceSnapshotAt: null,
      },
    ]);

    vi.mocked(getUpcomingObligationsSummary).mockResolvedValueOnce({
      upcomingCount: 2,
      overdueCount: 1,
      paidCount: 3,
      upcomingByCurrency: [{ currency: "PLN", totalMinor: 45000n }],
      overdueByCurrency: [{ currency: "PLN", totalMinor: 12000n }],
    });

    const overview = await getHouseholdOverview(
      context,
      { month: "2026-09" },
      { asOf },
    );

    // Period checks
    expect(overview.period.monthKey).toBe("2026-09");
    expect(overview.period.startDate.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(overview.period.endDate.toISOString()).toBe("2026-09-30T23:59:59.999Z");
    expect(overview.period.prevMonthKey).toBe("2026-08");
    expect(overview.period.nextMonthKey).toBe("2026-10");

    // Cash flow checks
    expect(overview.cashFlow.byCurrency).toHaveLength(2);
    const plnCashFlow = overview.cashFlow.byCurrency.find((c) => c.currency === "PLN")!;
    expect(plnCashFlow.incomeMinor).toBe(10_000_000_000_000_000n);
    expect(plnCashFlow.spendingMinor).toBe(2_500_000_000_000_000n);
    expect(plnCashFlow.netCashFlowMinor).toBe(7_500_000_000_000_000n);
    expect(plnCashFlow.transactionCount).toBe(7);

    const eurCashFlow = overview.cashFlow.byCurrency.find((c) => c.currency === "EUR")!;
    expect(eurCashFlow.incomeMinor).toBe(50000n);
    expect(eurCashFlow.spendingMinor).toBe(0n);
    expect(eurCashFlow.netCashFlowMinor).toBe(50000n);

    // Category spending checks
    expect(overview.categorySpending).toHaveLength(2);
    expect(overview.categorySpending[0]!.categoryName).toBe("Food");
    expect(overview.categorySpending[0]!.amountMinor).toBe(1_250_000_000_000_000n);
    expect(overview.categorySpending[0]!.percentage).toBe(50); // 1250 / 2500 = 50%

    expect(overview.categorySpending[1]!.categoryId).toBeNull();
    expect(overview.categorySpending[1]!.amountMinor).toBe(1_250_000_000_000_000n);
    expect(overview.categorySpending[1]!.percentage).toBe(50);

    // Available cash checks
    expect(overview.availableCash.totalEligibleAccounts).toBe(3);
    expect(overview.availableCash.freshAccountsCount).toBe(1);
    expect(overview.availableCash.isFullyKnown).toBe(false);
    expect(overview.availableCash.missingAccounts).toHaveLength(1);
    expect(overview.availableCash.missingAccounts[0]!.name).toBe("Emergency Cash");
    expect(overview.availableCash.staleAccounts).toHaveLength(1);
    expect(overview.availableCash.staleAccounts[0]!.name).toBe("Old Savings");

    // Only fresh checking account is counted in available cash
    expect(overview.availableCash.byCurrency[0]!.amountMinor).toBe(500000n);
    expect(overview.availableCash.byCurrency[0]!.isComplete).toBe(false);
    expect(overview.upcoming?.upcomingCount).toBe(2);
    expect(overview.upcoming?.upcomingByCurrency[0]?.totalMinor).toBe(45000n);
  });
});
