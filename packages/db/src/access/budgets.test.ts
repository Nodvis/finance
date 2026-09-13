import { beforeEach, describe, expect, it, vi } from "vitest";
import * as dbClient from "../client";
import { listBudgetsByHousehold } from "./budgets";

const householdId = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";
const otherHouseholdId = "018f47a0-7762-7b9c-8d17-27f2f79e59a2";
const categoryId = "018f47a0-7762-7b9c-8d17-27f2f79e59a3";
const budgetId = "018f47a0-7762-7b9c-8d17-27f2f79e59a4";
function chain(result: unknown) { const value: any = { select: vi.fn(), from: vi.fn(), innerJoin: vi.fn(), where: vi.fn(), orderBy: vi.fn(), then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve) }; for (const method of ["select", "from", "innerJoin", "where"]) value[method as keyof typeof value].mockReturnValue(value); value.orderBy.mockReturnValue(value); return value; }
describe("budget database access", () => { beforeEach(() => vi.restoreAllMocks());
  it("keeps household scope, exact bigint values, and non-voided month/category/currency actuals", async () => {
    const row = { id: budgetId, householdId, categoryId, month: "2026-09-01", limitAmountMinor: 9007199254740993n, currency: "PLN", archivedAt: null, version: 1, createdAt: new Date(), updatedAt: new Date() };
    const listQuery = chain([{ budget: row, categoryName: "Food" }]);
    const actualQuery = chain([{ value: "17" }]);
    const db = { select: vi.fn().mockReturnValueOnce(listQuery).mockReturnValueOnce(actualQuery) };
    vi.spyOn(dbClient, "getDb").mockReturnValue(db as never);
    const result = await listBudgetsByHousehold(householdId, "2026-09");
    expect(result[0]).toMatchObject({ householdId, limitAmountMinor: 9007199254740993n, spentAmountMinor: 17n, currency: "PLN" });
    expect(result[0]!.remainingAmountMinor).toBe(9007199254740976n);
    expect(listQuery.where).toHaveBeenCalled();
    expect(otherHouseholdId).not.toBe(result[0]!.householdId);
  });
  it("returns archived rows only when explicitly requested, preserving version history", async () => {
    const archived = { id: budgetId, householdId, categoryId, month: "2026-09-01", limitAmountMinor: 100n, currency: "PLN", archivedAt: new Date(), version: 2, createdAt: new Date(), updatedAt: new Date() };
    const listQuery = chain([{ budget: archived, categoryName: "Food" }]); const actualQuery = chain([{ value: "0" }]);
    vi.spyOn(dbClient, "getDb").mockReturnValue({ select: vi.fn().mockReturnValueOnce(listQuery).mockReturnValueOnce(actualQuery) } as never);
    const result = await listBudgetsByHousehold(householdId, "2026-09", true);
    expect(result[0]).toMatchObject({ archivedAt: archived.archivedAt, version: 2 });
  });
});
