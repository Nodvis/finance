import { describe, expect, it, vi } from "vitest";

import * as dbClient from "../client";
import {
  getHouseholdEligibleAccounts,
  getHouseholdPeriodCashFlow,
  getHouseholdPeriodCategorySpending,
} from "./overview";

describe("db overview queries and aggregations", () => {
  const householdId = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";
  const startDate = new Date("2026-09-01T00:00:00.000Z");
  const endDate = new Date("2026-09-30T23:59:59.999Z");

  it("aggregates cash flow with exact bigints and maps database rows correctly", async () => {
    const mockRows = [
      {
        kind: "income",
        currency: "PLN",
        totalMinor: "15000000000000000", // Large bigint exceeding 2^53 - 1
        transactionCount: 4,
      },
      {
        kind: "expense",
        currency: "PLN",
        totalMinor: "5000000000000000",
        transactionCount: 12,
      },
    ];

    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockResolvedValue(mockRows),
    };

    vi.spyOn(dbClient, "getDb").mockReturnValue(mockDb as any);

    const result = await getHouseholdPeriodCashFlow({
      householdId,
      startDate,
      endDate,
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      kind: "income",
      currency: "PLN",
      totalMinor: 15_000_000_000_000_000n,
      transactionCount: 4,
    });
    expect(result[1]).toEqual({
      kind: "expense",
      currency: "PLN",
      totalMinor: 5_000_000_000_000_000n,
      transactionCount: 12,
    });
  });

  it("aggregates spending by category including uncategorized expenses and large bigints", async () => {
    const mockRows = [
      {
        categoryId: "018f47a0-7762-7b9c-8d17-27f2f79e59b1",
        categoryName: "Groceries",
        currency: "PLN",
        totalMinor: "12345678901234567",
        transactionCount: 8,
      },
      {
        categoryId: null, // Uncategorized
        categoryName: null,
        currency: "PLN",
        totalMinor: "45000",
        transactionCount: 2,
      },
    ];

    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue(mockRows),
    };

    vi.spyOn(dbClient, "getDb").mockReturnValue(mockDb as any);

    const result = await getHouseholdPeriodCategorySpending({
      householdId,
      startDate,
      endDate,
    });

    expect(result).toHaveLength(2);
    expect(result[0]!.categoryName).toBe("Groceries");
    expect(result[0]!.totalMinor).toBe(12_345_678_901_234_567n);
    expect(result[0]!.transactionCount).toBe(8);

    expect(result[1]!.categoryId).toBeNull();
    expect(result[1]!.categoryName).toBeNull();
    expect(result[1]!.totalMinor).toBe(45000n);
    expect(result[1]!.transactionCount).toBe(2);
  });

  it("queries eligible asset accounts preserving bigint snapshots and ensuring single entry per account", async () => {
    const mockRows = [
      {
        id: "acc-1",
        householdId,
        name: "Joint Checking",
        type: "checking",
        currency: "PLN",
        balanceSnapshotMinor: 1000000n,
        balanceSnapshotAt: new Date("2026-09-08T10:00:00Z"),
      },
      {
        id: "acc-2",
        householdId,
        name: "Personal Savings",
        type: "savings",
        currency: "PLN",
        balanceSnapshotMinor: null,
        balanceSnapshotAt: null,
      },
    ];

    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue(mockRows),
    };

    vi.spyOn(dbClient, "getDb").mockReturnValue(mockDb as any);

    const result = await getHouseholdEligibleAccounts(householdId);

    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe("acc-1");
    expect(result[0]!.balanceSnapshotMinor).toBe(1000000n);
    expect(result[1]!.id).toBe("acc-2");
    expect(result[1]!.balanceSnapshotMinor).toBeNull();
  });
});
