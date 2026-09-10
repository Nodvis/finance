import { describe, expect, it } from "vitest";

import {
  accountId,
  categoryId,
  createExpense,
  createIncome,
  createTransfer,
  householdId,
  money,
  personId,
  transactionId,
  voidTransaction,
} from "./index";
import {
  DEFAULT_STALE_SNAPSHOT_THRESHOLD_MS,
  aggregateAvailableCash,
  aggregatePeriodCashFlow,
  aggregatePeriodCategorySpending,
  createMonthPeriod,
  createPeriod,
  formatMonthKey,
  getAdjacentMonthKey,
  isDateInPeriod,
  isSnapshotStale,
  parseMonthKey,
} from "./overview";

const H_ID = householdId("018f47a0-7762-7b9c-8d17-27f2f79e59a1");
const P_ID = personId("018f47a0-7762-7b9c-8d17-27f2f79e59a2");
const ACC_CHECKING = accountId("018f47a0-7762-7b9c-8d17-27f2f79e59a3");
const ACC_SAVINGS = accountId("018f47a0-7762-7b9c-8d17-27f2f79e59a4");
const ACC_CARD = accountId("018f47a0-7762-7b9c-8d17-27f2f79e59a5");
const ACC_EUR = accountId("018f47a0-7762-7b9c-8d17-27f2f79e59a6");
const CAT_GROCERIES = categoryId("018f47a0-7762-7b9c-8d17-27f2f79e59a7");
const CAT_SALARY = categoryId("018f47a0-7762-7b9c-8d17-27f2f79e59a8");

describe("Overview domain model and period calculations", () => {
  describe("Explicit period boundaries (UTC / timezone-independent)", () => {
    it("creates an explicit date period from YYYY-MM-DD strings with exact UTC bounds", () => {
      const period = createPeriod("2026-09-01", "2026-09-30");

      expect(period.startDate.toISOString()).toBe("2026-09-01T00:00:00.000Z");
      expect(period.endDate.toISOString()).toBe("2026-09-30T23:59:59.999Z");
    });

    it("creates calendar month periods with exact first-to-last day UTC bounds", () => {
      const sep = createMonthPeriod(2026, 9);
      expect(sep.startDate.toISOString()).toBe("2026-09-01T00:00:00.000Z");
      expect(sep.endDate.toISOString()).toBe("2026-09-30T23:59:59.999Z");

      // February in non-leap year (2026: 28 days)
      const feb2026 = createMonthPeriod(2026, 2);
      expect(feb2026.startDate.toISOString()).toBe("2026-02-01T00:00:00.000Z");
      expect(feb2026.endDate.toISOString()).toBe("2026-02-28T23:59:59.999Z");

      // February in leap year (2024: 29 days)
      const feb2024 = createMonthPeriod(2024, 2);
      expect(feb2024.startDate.toISOString()).toBe("2024-02-01T00:00:00.000Z");
      expect(feb2024.endDate.toISOString()).toBe("2024-02-29T23:59:59.999Z");
    });

    it("rejects invalid periods where startDate is after endDate", () => {
      expect(() => createPeriod("2026-09-30", "2026-09-01")).toThrow(
        "Invalid period",
      );
    });

    it("tests inclusion of dates at exact boundary edges", () => {
      const period = createPeriod("2026-09-01", "2026-09-30");

      // Exact start (inclusive)
      expect(isDateInPeriod(new Date("2026-09-01T00:00:00.000Z"), period)).toBe(
        true,
      );
      // Exact end (inclusive)
      expect(isDateInPeriod(new Date("2026-09-30T23:59:59.999Z"), period)).toBe(
        true,
      );
      // 1 ms before start -> false
      expect(isDateInPeriod(new Date("2026-08-31T23:59:59.999Z"), period)).toBe(
        false,
      );
      // 1 ms after end -> false
      expect(isDateInPeriod(new Date("2026-10-01T00:00:00.000Z"), period)).toBe(
        false,
      );
    });

    it("formats and parses month keys and computes adjacent months", () => {
      expect(formatMonthKey(2026, 9)).toBe("2026-09");
      expect(parseMonthKey("2026-09")).toEqual({ year: 2026, month: 9 });

      expect(getAdjacentMonthKey("2026-09", -1)).toBe("2026-08");
      expect(getAdjacentMonthKey("2026-09", 1)).toBe("2026-10");
      expect(getAdjacentMonthKey("2026-01", -1)).toBe("2025-12");
      expect(getAdjacentMonthKey("2026-12", 1)).toBe("2027-01");
    });
  });

  describe("Snapshot staleness and available cash aggregation", () => {
    const asOf = new Date("2026-09-10T12:00:00Z");

    it("correctly flags snapshots older than the staleness threshold", () => {
      const freshDate = new Date("2026-09-01T10:00:00Z"); // 9 days old
      const staleDate = new Date("2026-07-01T10:00:00Z"); // >70 days old

      expect(isSnapshotStale(freshDate, asOf)).toBe(false);
      expect(isSnapshotStale(staleDate, asOf)).toBe(true);
    });

    it("rejects observations captured after the requested as-of instant", () => {
      expect(isSnapshotStale(new Date("2026-09-11T00:00:00Z"), asOf)).toBe(true);
    });

    it("aggregates only eligible asset accounts with non-stale snapshots", () => {
      const accounts = [
        {
          id: ACC_CHECKING,
          name: "Main Checking",
          type: "checking" as const,
          currency: "PLN",
          balanceSnapshot: {
            balance: money(500000n, "PLN"), // 5000.00 PLN
            capturedAt: new Date("2026-09-05T00:00:00Z"), // Fresh
          },
          archivedAt: null,
        },
        {
          id: ACC_SAVINGS,
          name: "Savings",
          type: "savings" as const,
          currency: "PLN",
          balanceSnapshot: {
            balance: money(1500000n, "PLN"), // 15000.00 PLN
            capturedAt: new Date("2026-09-08T00:00:00Z"), // Fresh
          },
          archivedAt: null,
        },
        {
          id: ACC_CARD,
          name: "Credit Card",
          type: "credit_card" as const, // Excluded from available cash (INV-013)
          currency: "PLN",
          balanceSnapshot: {
            balance: money(-200000n, "PLN"),
            capturedAt: new Date("2026-09-05T00:00:00Z"),
          },
          archivedAt: null,
        },
      ];

      const result = aggregateAvailableCash(accounts, { asOf });

      expect(result.totalEligibleAccounts).toBe(2);
      expect(result.freshAccountsCount).toBe(2);
      expect(result.isFullyKnown).toBe(true);
      expect(result.missingAccounts).toHaveLength(0);
      expect(result.staleAccounts).toHaveLength(0);
      expect(result.byCurrency).toHaveLength(1);
      expect(result.byCurrency[0]!.currency).toBe("PLN");
      expect(result.byCurrency[0]!.amountMinor).toBe(2000000n);
      expect(result.byCurrency[0]!.isComplete).toBe(true);
    });

    it("honestly handles missing snapshots and stale snapshots without fabricating funds", () => {
      const accounts = [
        {
          id: ACC_CHECKING,
          name: "Active Checking",
          type: "checking" as const,
          currency: "PLN",
          balanceSnapshot: {
            balance: money(100000n, "PLN"), // 1000.00 PLN
            capturedAt: new Date("2026-09-05T00:00:00Z"), // Fresh
          },
          archivedAt: null,
        },
        {
          id: ACC_SAVINGS,
          name: "Old Savings",
          type: "savings" as const,
          currency: "PLN",
          balanceSnapshot: {
            balance: money(5000000n, "PLN"),
            capturedAt: new Date("2026-01-01T00:00:00Z"), // Stale (> 200 days old)
          },
          archivedAt: null,
        },
        {
          id: accountId("018f47a0-7762-7b9c-8d17-27f2f79e59b1"),
          name: "Emergency Cash",
          type: "cash" as const,
          currency: "PLN",
          balanceSnapshot: null, // Missing snapshot
          archivedAt: null,
        },
      ];

      const result = aggregateAvailableCash(accounts, { asOf });

      // Stale and missing are excluded from the aggregated sum
      expect(result.totalEligibleAccounts).toBe(3);
      expect(result.freshAccountsCount).toBe(1);
      expect(result.isFullyKnown).toBe(false);

      expect(result.missingAccounts).toHaveLength(1);
      expect(result.missingAccounts[0]!.name).toBe("Emergency Cash");

      expect(result.staleAccounts).toHaveLength(1);
      expect(result.staleAccounts[0]!.name).toBe("Old Savings");

      // Only the active checking account is in the available cash sum
      expect(result.byCurrency[0]!.amountMinor).toBe(100000n);
      expect(result.byCurrency[0]!.isComplete).toBe(false);
      expect(result.byCurrency[0]!.missingAccountCount).toBe(1);
      expect(result.byCurrency[0]!.staleAccountCount).toBe(1);
    });

    it("supports multiple currencies without mixing or using exchange rates", () => {
      const accounts = [
        {
          id: ACC_CHECKING,
          name: "PLN Checking",
          type: "checking" as const,
          currency: "PLN",
          balanceSnapshot: {
            balance: money(123456n, "PLN"),
            capturedAt: new Date("2026-09-08T00:00:00Z"),
          },
          archivedAt: null,
        },
        {
          id: ACC_EUR,
          name: "EUR Savings",
          type: "savings" as const,
          currency: "EUR",
          balanceSnapshot: {
            balance: money(98765n, "EUR"),
            capturedAt: new Date("2026-09-08T00:00:00Z"),
          },
          archivedAt: null,
        },
      ];

      const result = aggregateAvailableCash(accounts, { asOf });

      expect(result.byCurrency).toHaveLength(2);
      expect(result.byCurrency[0]!.currency).toBe("EUR");
      expect(result.byCurrency[0]!.amountMinor).toBe(98765n);
      expect(result.byCurrency[1]!.currency).toBe("PLN");
      expect(result.byCurrency[1]!.amountMinor).toBe(123456n);
    });

    it("handles large bigint amounts exceeding 2^53 - 1 accurately without floating-point loss", () => {
      const large1 = 10_000_000_000_000_000n; // 10 quadrillion minor units
      const large2 = 5_000_000_000_000_005n;

      const accounts = [
        {
          id: ACC_CHECKING,
          name: "Large Checking 1",
          type: "checking" as const,
          currency: "PLN",
          balanceSnapshot: {
            balance: money(large1, "PLN"),
            capturedAt: new Date("2026-09-08T00:00:00Z"),
          },
          archivedAt: null,
        },
        {
          id: ACC_SAVINGS,
          name: "Large Checking 2",
          type: "checking" as const,
          currency: "PLN",
          balanceSnapshot: {
            balance: money(large2, "PLN"),
            capturedAt: new Date("2026-09-08T00:00:00Z"),
          },
          archivedAt: null,
        },
      ];

      const result = aggregateAvailableCash(accounts, { asOf });
      expect(result.byCurrency[0]!.amountMinor).toBe(15_000_000_000_000_005n);
    });
  });

  describe("Period cash flow and category aggregation", () => {
    const period = createMonthPeriod(2026, 9); // 2026-09-01T00:00:00.000Z to 2026-09-30T23:59:59.999Z

    it("aggregates actual income and spending while excluding internal transfers and voided records", () => {
      const txIncome = createIncome({
        id: transactionId("018f47a0-7762-7b9c-8d17-27f2f79e59c1"),
        householdId: H_ID,
        accountId: ACC_CHECKING,
        amount: money(1000000n, "PLN"), // +10,000.00 PLN income
        source: "Employer",
        receivedByPersonId: P_ID,
        occurredOn: new Date("2026-09-05T10:00:00Z"),
        categoryId: CAT_SALARY,
      });

      const txExpense = createExpense({
        id: transactionId("018f47a0-7762-7b9c-8d17-27f2f79e59c2"),
        householdId: H_ID,
        accountId: ACC_CHECKING,
        amount: money(250000n, "PLN"), // 2,500.00 PLN expense
        payee: "Supermarket",
        paidByPersonId: P_ID,
        occurredOn: new Date("2026-09-08T12:00:00Z"),
        categoryId: CAT_GROCERIES,
      });

      // Internal transfer: between checking and savings -> must be excluded from income & spending
      const txTransfer = createTransfer({
        id: transactionId("018f47a0-7762-7b9c-8d17-27f2f79e59c3"),
        householdId: H_ID,
        fromAccountId: ACC_CHECKING,
        toAccountId: ACC_SAVINGS,
        amount: money(300000n, "PLN"),
        occurredOn: new Date("2026-09-09T14:00:00Z"),
      });

      // Credit card purchase: counted as expense
      const txCardExpense = createExpense({
        id: transactionId("018f47a0-7762-7b9c-8d17-27f2f79e59c4"),
        householdId: H_ID,
        accountId: ACC_CARD,
        amount: money(50000n, "PLN"), // 500.00 PLN on card
        payee: "Electronics",
        paidByPersonId: P_ID,
        occurredOn: new Date("2026-09-12T16:00:00Z"),
      });

      // Credit card repayment: modeled as a transfer (checking -> card) -> excluded from spending
      const txCardRepayment = createTransfer({
        id: transactionId("018f47a0-7762-7b9c-8d17-27f2f79e59c5"),
        householdId: H_ID,
        fromAccountId: ACC_CHECKING,
        toAccountId: ACC_CARD,
        amount: money(50000n, "PLN"),
        occurredOn: new Date("2026-09-20T10:00:00Z"),
      });

      // Voided expense: must be excluded
      const txVoidedExpense = voidTransaction(
        createExpense({
          id: transactionId("018f47a0-7762-7b9c-8d17-27f2f79e59c6"),
          householdId: H_ID,
          accountId: ACC_CHECKING,
          amount: money(999999n, "PLN"),
          payee: "Accidental Charge",
          paidByPersonId: P_ID,
          occurredOn: new Date("2026-09-15T08:00:00Z"),
        }),
        "Entered by mistake",
      );

      // Out of period transaction: August 2026 -> excluded
      const txOldIncome = createIncome({
        id: transactionId("018f47a0-7762-7b9c-8d17-27f2f79e59c7"),
        householdId: H_ID,
        accountId: ACC_CHECKING,
        amount: money(800000n, "PLN"),
        source: "Bonus",
        receivedByPersonId: P_ID,
        occurredOn: new Date("2026-08-25T10:00:00Z"),
      });

      const transactions = [
        txIncome,
        txExpense,
        txTransfer,
        txCardExpense,
        txCardRepayment,
        txVoidedExpense,
        txOldIncome,
      ];

      const flow = aggregatePeriodCashFlow(transactions, period);

      expect(flow.byCurrency).toHaveLength(1);
      const pln = flow.byCurrency[0]!;
      expect(pln.currency).toBe("PLN");
      expect(pln.incomeMinor).toBe(1000000n);
      // Spending = Supermarket (250000n) + Card Expense (50000n) = 300000n
      // Transfers and voided are excluded!
      expect(pln.spendingMinor).toBe(300000n);
      expect(pln.netCashFlowMinor).toBe(700000n); // 1000000n - 300000n
      expect(pln.transactionCount).toBe(3);
    });

    it("aggregates spending by category including uncategorized expenses and large bigints", () => {
      const largeExpense = 12_000_000_000_000_000n;

      const txCat = createExpense({
        id: transactionId("018f47a0-7762-7b9c-8d17-27f2f79e59d1"),
        householdId: H_ID,
        accountId: ACC_CHECKING,
        amount: money(largeExpense, "PLN"),
        payee: "Big Investment",
        paidByPersonId: P_ID,
        occurredOn: new Date("2026-09-02T10:00:00Z"),
        categoryId: CAT_GROCERIES,
      });

      const txUncat = createExpense({
        id: transactionId("018f47a0-7762-7b9c-8d17-27f2f79e59d2"),
        householdId: H_ID,
        accountId: ACC_CHECKING,
        amount: money(15000n, "PLN"),
        payee: "Corner Store",
        paidByPersonId: P_ID,
        occurredOn: new Date("2026-09-03T10:00:00Z"),
        categoryId: null, // Uncategorized
      });

      const categorySpending = aggregatePeriodCategorySpending(
        [txCat, txUncat],
        period,
      );

      expect(categorySpending).toHaveLength(2);
      expect(categorySpending[0]!.categoryId).toBe(CAT_GROCERIES);
      expect(categorySpending[0]!.amountMinor).toBe(largeExpense);

      expect(categorySpending[1]!.categoryId).toBeNull();
      expect(categorySpending[1]!.amountMinor).toBe(15000n);
    });
  });
});
