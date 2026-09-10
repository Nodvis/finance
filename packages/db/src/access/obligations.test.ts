import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../client";
import { accounts, households, persons, householdMemberships } from "../schema/foundation";
import { transactions } from "../schema/transactions";
import { obligations } from "../schema/obligations";
import { liabilityRepayments, liabilities } from "../schema/liabilities";
import { bnplPurchases } from "../schema/bnpl-purchases";
import { creditFacilities } from "../schema/credit-facilities";
import {
  cancelObligationInDb,
  createObligationInDb,
  getObligationById,
  getUpcomingObligationsSummary,
  listCandidateTransactionsForObligation,
  listObligationsByHousehold,
  matchObligationInDb,
  unlinkObligationInDb,
  updateObligationInDb,
  ObligationMatchConflictError,
  ObligationNotFoundError,
  ObligationVersionConflictError,
} from "./obligations";
import { updateTransactionInDb, voidTransactionInDb, TransactionVersionConflictError } from "./transactions";
import { getHouseholdPeriodCashFlow, getHouseholdPeriodCategorySpending } from "./overview";

const testDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(testDir, "../../../../.env") });

async function createTestFixture(params?: { currency?: string; amountMinor?: bigint }) {
  const db = getDb();
  const currency = params?.currency ?? "PLN";
  const amountMinor = params?.amountMinor ?? 15000n;

  const householdId = crypto.randomUUID();
  const personId = crypto.randomUUID();
  const accountId = crypto.randomUUID();
  const txId = crypto.randomUUID();

  await db.insert(households).values({
    id: householdId,
    name: `Obligation Household ${householdId.slice(0, 6)}`,
    defaultCurrency: currency,
  });
  await db.insert(persons).values({
    id: personId,
    displayName: "Obligation Person",
  });
  await db.insert(householdMemberships).values({
    householdId,
    personId,
  });
  await db.insert(accounts).values({
    id: accountId,
    householdId,
    name: "Checking Account",
    type: "checking",
    currency,
    balanceSnapshotMinor: 100000n,
    balanceSnapshotAt: new Date("2026-09-01T00:00:00Z"),
  });
  await db.insert(transactions).values({
    id: txId,
    householdId,
    kind: "expense",
    amountMinor,
    currency,
    accountId,
    paidByPersonId: personId,
    payee: "Utility Company",
    occurredOn: new Date("2026-09-10T10:00:00Z"),
  });

  return { householdId, personId, accountId, txId, currency, amountMinor };
}

describe.runIf(Boolean(process.env.DATABASE_URL))("Obligations DB Access & Invariants", () => {
  it("enforces household isolation on create, get, list, and mutations", async () => {
    const fixtureA = await createTestFixture();
    const fixtureB = await createTestFixture();

    // Create in household A
    const createdA = await createObligationInDb(fixtureA.householdId, {
      title: "Rent for Household A",
      amountMinor: 250000n,
      currency: "PLN",
      dueDate: "2026-09-15",
      notes: "Apartment lease",
    });

    expect(createdA.householdId).toBe(fixtureA.householdId);

    // Cannot read across household boundary
    await expect(getObligationById(fixtureB.householdId, createdA.id)).rejects.toThrow(
      ObligationNotFoundError,
    );

    // Listing household B does not include household A obligations
    const listB = await listObligationsByHousehold(fixtureB.householdId);
    expect(listB.some((o) => o.id === createdA.id)).toBe(false);

    // Cannot update across household boundary
    await expect(
      updateObligationInDb(fixtureB.householdId, createdA.id, createdA.version, {
        title: "Hacked Title",
      }),
    ).rejects.toThrow(ObligationNotFoundError);

    // Cannot match across household boundary
    await expect(
      matchObligationInDb(fixtureA.householdId, createdA.id, createdA.version, fixtureB.txId),
    ).rejects.toThrow(/same household/i);

    await expect(
      matchObligationInDb(fixtureB.householdId, createdA.id, createdA.version, fixtureA.txId),
    ).rejects.toThrow(ObligationNotFoundError);

    // Cannot cancel across household boundary
    await expect(
      cancelObligationInDb(fixtureB.householdId, createdA.id, createdA.version),
    ).rejects.toThrow(ObligationNotFoundError);
  });

  it("preserves exact bigints exceeding Number.MAX_SAFE_INTEGER", async () => {
    const hugeAmount = 9007199254740993n; // MAX_SAFE_INTEGER + 2n
    const fixture = await createTestFixture({ amountMinor: hugeAmount });

    const obligation = await createObligationInDb(fixture.householdId, {
      title: "National Infrastructure Commitment",
      amountMinor: hugeAmount,
      currency: "PLN",
      dueDate: "2026-10-01",
    });

    expect(obligation.amountMinor).toBe(hugeAmount);

    const fetched = await getObligationById(fixture.householdId, obligation.id);
    expect(fetched.amountMinor).toBe(hugeAmount);

    // Matching exact huge amount succeeds
    const matched = await matchObligationInDb(
      fixture.householdId,
      obligation.id,
      obligation.version,
      fixture.txId,
    );
    expect(matched.amountMinor).toBe(hugeAmount);
    expect(matched.status).toBe("paid");
  });

  it("correctly derives status according to date boundary and today reference", async () => {
    const fixture = await createTestFixture();
    const today = "2026-09-10";

    const upcoming = await createObligationInDb(fixture.householdId, {
      title: "Tomorrow Bill",
      amountMinor: 1000n,
      currency: "PLN",
      dueDate: "2026-09-11",
    });
    const dueToday = await createObligationInDb(fixture.householdId, {
      title: "Today Bill",
      amountMinor: 1000n,
      currency: "PLN",
      dueDate: "2026-09-10",
    });
    const overdue = await createObligationInDb(fixture.householdId, {
      title: "Yesterday Bill",
      amountMinor: 1000n,
      currency: "PLN",
      dueDate: "2026-09-09",
    });

    const list = await listObligationsByHousehold(fixture.householdId, { today });
    const itemUpcoming = list.find((o) => o.id === upcoming.id);
    const itemToday = list.find((o) => o.id === dueToday.id);
    const itemOverdue = list.find((o) => o.id === overdue.id);

    expect(itemUpcoming?.status).toBe("upcoming");
    expect(itemToday?.status).toBe("upcoming"); // dueDate >= today is upcoming
    expect(itemOverdue?.status).toBe("overdue"); // dueDate < today is overdue

    // Filter by status works
    const upcomingOnly = await listObligationsByHousehold(fixture.householdId, {
      status: "upcoming",
      today,
    });
    expect(upcomingOnly.some((o) => o.id === upcoming.id)).toBe(true);
    expect(upcomingOnly.some((o) => o.id === dueToday.id)).toBe(true);
    expect(upcomingOnly.some((o) => o.id === overdue.id)).toBe(false);

    const overdueOnly = await listObligationsByHousehold(fixture.householdId, {
      status: "overdue",
      today,
    });
    expect(overdueOnly.some((o) => o.id === overdue.id)).toBe(true);
    expect(overdueOnly.some((o) => o.id === upcoming.id)).toBe(false);
  });

  it("rejects matching when transaction kind is not expense", async () => {
    const fixture = await createTestFixture();
    const db = getDb();
    const incomeTxId = crypto.randomUUID();

    await db.insert(transactions).values({
      id: incomeTxId,
      householdId: fixture.householdId,
      kind: "income",
      amountMinor: fixture.amountMinor,
      currency: fixture.currency,
      accountId: fixture.accountId,
      source: "Client payment",
      receivedByPersonId: fixture.personId,
      occurredOn: new Date("2026-09-10T10:00:00Z"),
    });

    const obligation = await createObligationInDb(fixture.householdId, {
      title: "Invoice",
      amountMinor: fixture.amountMinor,
      currency: fixture.currency,
      dueDate: "2026-09-15",
    });

    await expect(
      matchObligationInDb(fixture.householdId, obligation.id, obligation.version, incomeTxId),
    ).rejects.toThrow(ObligationMatchConflictError);
  });

  it("rejects matching when currency or amount mismatches", async () => {
    const fixture = await createTestFixture();

    const obligationDiffCurrency = await createObligationInDb(fixture.householdId, {
      title: "EUR Bill",
      amountMinor: fixture.amountMinor,
      currency: "EUR",
      dueDate: "2026-09-15",
    });

    await expect(
      matchObligationInDb(
        fixture.householdId,
        obligationDiffCurrency.id,
        obligationDiffCurrency.version,
        fixture.txId,
      ),
    ).rejects.toThrow(/currency/i);

    const obligationDiffAmount = await createObligationInDb(fixture.householdId, {
      title: "PLN Bill diff amount",
      amountMinor: fixture.amountMinor + 1n,
      currency: "PLN",
      dueDate: "2026-09-15",
    });

    await expect(
      matchObligationInDb(
        fixture.householdId,
        obligationDiffAmount.id,
        obligationDiffAmount.version,
        fixture.txId,
      ),
    ).rejects.toThrow(/amount/i);
  });

  it("rejects matching voided transaction or cancelled obligation", async () => {
    const fixture = await createTestFixture();
    const db = getDb();

    // 1. Voided transaction
    await db.update(transactions).set({ voidedAt: new Date() }).where(eq(transactions.id, fixture.txId));

    const obligation = await createObligationInDb(fixture.householdId, {
      title: "Utility",
      amountMinor: fixture.amountMinor,
      currency: fixture.currency,
      dueDate: "2026-09-15",
    });

    await expect(
      matchObligationInDb(fixture.householdId, obligation.id, obligation.version, fixture.txId),
    ).rejects.toThrow(/active transaction/i);

    // 2. Cancelled obligation with active transaction
    const activeTxId = crypto.randomUUID();
    await db.insert(transactions).values({
      id: activeTxId,
      householdId: fixture.householdId,
      kind: "expense",
      amountMinor: fixture.amountMinor,
      currency: fixture.currency,
      accountId: fixture.accountId,
      paidByPersonId: fixture.personId,
      payee: "Active Payee",
      occurredOn: new Date("2026-09-10T10:00:00Z"),
    });

    const cancelledObligation = await cancelObligationInDb(
      fixture.householdId,
      obligation.id,
      obligation.version,
    );

    await expect(
      matchObligationInDb(
        fixture.householdId,
        cancelledObligation.id,
        cancelledObligation.version,
        activeTxId,
      ),
    ).rejects.toThrow(/cancelled/i);
  });

  it("enforces 1:1 transaction exclusivity across obligations, repayments, and BNPL", async () => {
    const fixture = await createTestFixture();
    const db = getDb();

    const obligationA = await createObligationInDb(fixture.householdId, {
      title: "Obligation A",
      amountMinor: fixture.amountMinor,
      currency: fixture.currency,
      dueDate: "2026-09-15",
    });

    const obligationB = await createObligationInDb(fixture.householdId, {
      title: "Obligation B",
      amountMinor: fixture.amountMinor,
      currency: fixture.currency,
      dueDate: "2026-09-15",
    });

    // Match obligation A to txId
    await matchObligationInDb(
      fixture.householdId,
      obligationA.id,
      obligationA.version,
      fixture.txId,
    );

    // Matching obligation B to same txId must fail
    await expect(
      matchObligationInDb(
        fixture.householdId,
        obligationB.id,
        obligationB.version,
        fixture.txId,
      ),
    ).rejects.toThrow(/already matched/i);

    // Test conflict with liability repayment
    const liabilityId = crypto.randomUUID();
    await db.insert(liabilities).values({
      id: liabilityId,
      householdId: fixture.householdId,
      name: "Loan 1",
      kind: "loan",
      currency: fixture.currency,
    });
    const repaymentTxId = crypto.randomUUID();
    await db.insert(transactions).values({
      id: repaymentTxId,
      householdId: fixture.householdId,
      kind: "expense",
      amountMinor: fixture.amountMinor,
      currency: fixture.currency,
      accountId: fixture.accountId,
      paidByPersonId: fixture.personId,
      payee: "Bank Repayment",
      occurredOn: new Date("2026-09-10T10:00:00Z"),
    });
    await db.insert(liabilityRepayments).values({
      id: crypto.randomUUID(),
      householdId: fixture.householdId,
      liabilityId,
      transactionId: repaymentTxId,
      amountMinor: fixture.amountMinor,
      currency: fixture.currency,
      paidAt: new Date("2026-09-10T10:00:00Z"),
      version: 1,
    });

    const obligationC = await createObligationInDb(fixture.householdId, {
      title: "Obligation C",
      amountMinor: fixture.amountMinor,
      currency: fixture.currency,
      dueDate: "2026-09-15",
    });

    await expect(
      matchObligationInDb(
        fixture.householdId,
        obligationC.id,
        obligationC.version,
        repaymentTxId,
      ),
    ).rejects.toThrow(/liability repayment/i);

    // Test conflict with BNPL purchase
    const facilityId = crypto.randomUUID();
    await db.insert(creditFacilities).values({
      id: facilityId,
      householdId: fixture.householdId,
      kind: "bnpl",
      name: "BNPL Facility",
      currency: fixture.currency,
    });
    const bnplTxId = crypto.randomUUID();
    await db.insert(transactions).values({
      id: bnplTxId,
      householdId: fixture.householdId,
      kind: "expense",
      amountMinor: fixture.amountMinor,
      currency: fixture.currency,
      accountId: fixture.accountId,
      paidByPersonId: fixture.personId,
      payee: "BNPL Shop",
      occurredOn: new Date("2026-09-10T10:00:00Z"),
    });
    await db.insert(bnplPurchases).values({
      id: crypto.randomUUID(),
      householdId: fixture.householdId,
      creditFacilityId: facilityId,
      provider: "BNPL",
      product: "Pay in 30",
      merchant: "Shop",
      purchaseDate: new Date("2026-09-10T10:00:00Z"),
      financingDate: new Date("2026-09-10T10:00:00Z"),
      originalAmountMinor: fixture.amountMinor,
      financedAmountMinor: fixture.amountMinor,
      currency: fixture.currency,
      transactionId: bnplTxId,
      version: 1,
    });

    await expect(
      matchObligationInDb(
        fixture.householdId,
        obligationC.id,
        obligationC.version,
        bnplTxId,
      ),
    ).rejects.toThrow(/BNPL/i);
  });

  it("unlinks an active matched obligation and allows re-matching", async () => {
    const fixture = await createTestFixture();

    const obligation = await createObligationInDb(fixture.householdId, {
      title: "Phone bill",
      amountMinor: fixture.amountMinor,
      currency: fixture.currency,
      dueDate: "2026-09-15",
    });

    const matched = await matchObligationInDb(
      fixture.householdId,
      obligation.id,
      obligation.version,
      fixture.txId,
    );
    expect(matched.status).toBe("paid");
    expect(matched.transactionId).toBe(fixture.txId);

    const unlinked = await unlinkObligationInDb(
      fixture.householdId,
      matched.id,
      matched.version,
    );
    expect(unlinked.status).toBe("upcoming");
    expect(unlinked.transactionId).toBeNull();

    // Now re-matching is allowed
    const rematched = await matchObligationInDb(
      fixture.householdId,
      unlinked.id,
      unlinked.version,
      fixture.txId,
    );
    expect(rematched.status).toBe("paid");
    expect(rematched.transactionId).toBe(fixture.txId);
  });

  it("prevents transaction voiding or mutating amount/currency/kind while actively linked to an obligation", async () => {
    const fixture = await createTestFixture();

    const obligation = await createObligationInDb(fixture.householdId, {
      title: "Gym Membership",
      amountMinor: fixture.amountMinor,
      currency: fixture.currency,
      dueDate: "2026-09-15",
    });

    await matchObligationInDb(
      fixture.householdId,
      obligation.id,
      obligation.version,
      fixture.txId,
    );

    // Attempting to void the transaction while actively linked must be rejected
    await expect(
      voidTransactionInDb({
        householdId: fixture.householdId,
        id: fixture.txId,
        expectedVersion: 1,
      }),
    ).rejects.toThrow(TransactionVersionConflictError);

    // Attempting to mutate amount while actively linked must be rejected
    await expect(
      updateTransactionInDb({
        householdId: fixture.householdId,
        id: fixture.txId,
        expectedVersion: 1,
        transaction: {
          id: fixture.txId as any,
          householdId: fixture.householdId as any,
          kind: "expense",
          amount: { amountMinor: fixture.amountMinor + 100n, currency: fixture.currency as any },
          accountId: fixture.accountId as any,
          payee: "Gym",
          paidByPersonId: fixture.personId as any,
          categoryId: null,
          occurredOn: new Date("2026-09-10T10:00:00Z"),
          version: 1,
          voidedAt: null,
          voidReason: null,
          sourceNamespace: "manual",
          sourceAccountId: "",
          authoritativeId: null,
        },
      }),
    ).rejects.toThrow(TransactionVersionConflictError);
  });

  it("guarantees obligations have zero balance and reporting effects", async () => {
    const fixture = await createTestFixture();
    const periodStart = new Date("2026-09-01T00:00:00Z");
    const periodEnd = new Date("2026-09-30T23:59:59Z");

    // Baseline reporting
    const cashFlowBefore = await getHouseholdPeriodCashFlow({
      householdId: fixture.householdId,
      startDate: periodStart,
      endDate: periodEnd,
    });
    const categorySpendingBefore = await getHouseholdPeriodCategorySpending({
      householdId: fixture.householdId,
      startDate: periodStart,
      endDate: periodEnd,
    });

    // Create an obligation with matching amount to match fixture.txId
    const obligation = await createObligationInDb(fixture.householdId, {
      title: "Future Insurance",
      amountMinor: fixture.amountMinor,
      currency: fixture.currency,
      dueDate: "2026-09-20",
    });

    const cashFlowAfterCreate = await getHouseholdPeriodCashFlow({
      householdId: fixture.householdId,
      startDate: periodStart,
      endDate: periodEnd,
    });
    expect(cashFlowAfterCreate).toEqual(cashFlowBefore);

    // Match obligation to transaction
    await matchObligationInDb(
      fixture.householdId,
      obligation.id,
      obligation.version,
      fixture.txId,
    );

    const cashFlowAfterMatch = await getHouseholdPeriodCashFlow({
      householdId: fixture.householdId,
      startDate: periodStart,
      endDate: periodEnd,
    });
    const categorySpendingAfterMatch = await getHouseholdPeriodCategorySpending({
      householdId: fixture.householdId,
      startDate: periodStart,
      endDate: periodEnd,
    });

    expect(cashFlowAfterMatch).toEqual(cashFlowBefore);
    expect(categorySpendingAfterMatch).toEqual(categorySpendingBefore);
  });

  it("lists candidate transactions matching exact currency and amount for matching UI", async () => {
    const fixture = await createTestFixture();

    const obligation = await createObligationInDb(fixture.householdId, {
      title: "Exact match candidate test",
      amountMinor: fixture.amountMinor,
      currency: fixture.currency,
      dueDate: "2026-09-15",
    });

    const candidates = await listCandidateTransactionsForObligation(
      fixture.householdId,
      obligation.id,
    );

    expect(candidates.length).toBe(1);
    expect(candidates[0]?.id).toBe(fixture.txId);
    expect(candidates[0]?.amountMinor).toBe(fixture.amountMinor);
    expect(candidates[0]?.currency).toBe(fixture.currency);
  });

  describe("Obligations History and Filtering query capabilities", () => {
    it("separates active obligations from historical (paid and cancelled) obligations", async () => {
      const fixture = await createTestFixture();
      const today = "2026-09-10";

      // 1. Upcoming (active)
      const upcoming = await createObligationInDb(fixture.householdId, {
        title: "Upcoming internet",
        amountMinor: 10000n,
        currency: "PLN",
        dueDate: "2026-09-20",
      });

      // 2. Overdue (active)
      const overdue = await createObligationInDb(fixture.householdId, {
        title: "Overdue power",
        amountMinor: 20000n,
        currency: "PLN",
        dueDate: "2026-09-01",
      });

      // 3. Paid (history)
      const toPay = await createObligationInDb(fixture.householdId, {
        title: "Paid water",
        amountMinor: fixture.amountMinor,
        currency: fixture.currency,
        dueDate: "2026-09-08",
      });
      const paid = await matchObligationInDb(
        fixture.householdId,
        toPay.id,
        toPay.version,
        fixture.txId,
      );

      // 4. Cancelled (history)
      const toCancel = await createObligationInDb(fixture.householdId, {
        title: "Cancelled subscription",
        amountMinor: 5000n,
        currency: "PLN",
        dueDate: "2026-09-25",
      });
      const cancelled = await cancelObligationInDb(
        fixture.householdId,
        toCancel.id,
        toCancel.version,
      );

      // Query active: upcoming + overdue only
      const activeList = await listObligationsByHousehold(fixture.householdId, {
        status: "active",
        today,
      });
      const activeIds = activeList.map((o) => o.id);
      expect(activeIds).toContain(upcoming.id);
      expect(activeIds).toContain(overdue.id);
      expect(activeIds).not.toContain(paid.id);
      expect(activeIds).not.toContain(cancelled.id);

      // Query history: paid + cancelled only
      const historyList = await listObligationsByHousehold(fixture.householdId, {
        status: "history",
        today,
      });
      const historyIds = historyList.map((o) => o.id);
      expect(historyIds).toContain(paid.id);
      expect(historyIds).toContain(cancelled.id);
      expect(historyIds).not.toContain(upcoming.id);
      expect(historyIds).not.toContain(overdue.id);

      // Query all: contains all 4
      const allList = await listObligationsByHousehold(fixture.householdId, {
        status: "all",
        today,
      });
      const allIds = allList.map((o) => o.id);
      expect(allIds).toContain(upcoming.id);
      expect(allIds).toContain(overdue.id);
      expect(allIds).toContain(paid.id);
      expect(allIds).toContain(cancelled.id);
    });

    it("filters obligations by currency", async () => {
      const fixture = await createTestFixture();

      const pln = await createObligationInDb(fixture.householdId, {
        title: "PLN Bill",
        amountMinor: 1000n,
        currency: "PLN",
        dueDate: "2026-09-15",
      });
      const eur = await createObligationInDb(fixture.householdId, {
        title: "EUR Subscription",
        amountMinor: 1000n,
        currency: "EUR",
        dueDate: "2026-09-16",
      });

      const plnOnly = await listObligationsByHousehold(fixture.householdId, {
        currency: "PLN",
      });
      expect(plnOnly.some((o) => o.id === pln.id)).toBe(true);
      expect(plnOnly.some((o) => o.id === eur.id)).toBe(false);

      const eurOnly = await listObligationsByHousehold(fixture.householdId, {
        currency: "eur", // case-insensitive query parameter
      });
      expect(eurOnly.some((o) => o.id === eur.id)).toBe(true);
      expect(eurOnly.some((o) => o.id === pln.id)).toBe(false);
    });

    it("sorts by due-date in ascending and descending order", async () => {
      const fixture = await createTestFixture();

      const early = await createObligationInDb(fixture.householdId, {
        title: "Early Bill",
        amountMinor: 1000n,
        currency: "PLN",
        dueDate: "2026-09-02",
      });
      const late = await createObligationInDb(fixture.householdId, {
        title: "Late Bill",
        amountMinor: 1000n,
        currency: "PLN",
        dueDate: "2026-09-28",
      });

      const ascList = await listObligationsByHousehold(fixture.householdId, {
        sortOrder: "asc",
      });
      const earlyIdxAsc = ascList.findIndex((o) => o.id === early.id);
      const lateIdxAsc = ascList.findIndex((o) => o.id === late.id);
      expect(earlyIdxAsc).toBeLessThan(lateIdxAsc);

      const descList = await listObligationsByHousehold(fixture.householdId, {
        sortOrder: "desc",
      });
      const earlyIdxDesc = descList.findIndex((o) => o.id === early.id);
      const lateIdxDesc = descList.findIndex((o) => o.id === late.id);
      expect(lateIdxDesc).toBeLessThan(earlyIdxDesc);
    });

    it("applies useful default ordering (desc for history/paid, asc for active/upcoming)", async () => {
      const fixture = await createTestFixture();

      const earlyPaid = await createObligationInDb(fixture.householdId, {
        title: "Early Paid",
        amountMinor: fixture.amountMinor,
        currency: fixture.currency,
        dueDate: "2026-09-01",
      });
      await matchObligationInDb(
        fixture.householdId,
        earlyPaid.id,
        earlyPaid.version,
        fixture.txId,
      );

      // Second expense transaction for late paid
      const db = getDb();
      const lateTxId = crypto.randomUUID();
      await db.insert(transactions).values({
        id: lateTxId,
        householdId: fixture.householdId,
        kind: "expense",
        amountMinor: fixture.amountMinor,
        currency: fixture.currency,
        accountId: fixture.accountId,
        paidByPersonId: fixture.personId,
        payee: "Late Payee",
        occurredOn: new Date("2026-09-10T10:00:00Z"),
      });

      const latePaid = await createObligationInDb(fixture.householdId, {
        title: "Late Paid",
        amountMinor: fixture.amountMinor,
        currency: fixture.currency,
        dueDate: "2026-09-29",
      });
      await matchObligationInDb(
        fixture.householdId,
        latePaid.id,
        latePaid.version,
        lateTxId,
      );

      // Default for history is desc: latePaid comes before earlyPaid
      const historyList = await listObligationsByHousehold(fixture.householdId, {
        status: "history",
      });
      const earlyIdx = historyList.findIndex((o) => o.id === earlyPaid.id);
      const lateIdx = historyList.findIndex((o) => o.id === latePaid.id);
      expect(lateIdx).toBeLessThan(earlyIdx);
    });

    it("supports bounded queries with limit and offset", async () => {
      const fixture = await createTestFixture();

      for (let i = 1; i <= 5; i++) {
        await createObligationInDb(fixture.householdId, {
          title: `Bounded Bill ${i}`,
          amountMinor: 1000n * BigInt(i),
          currency: "PLN",
          dueDate: `2026-10-0${i}`,
        });
      }

      const bounded = await listObligationsByHousehold(fixture.householdId, {
        limit: 2,
        offset: 1,
        sortOrder: "asc",
      });

      expect(bounded).toHaveLength(2);
    });
  });
});
