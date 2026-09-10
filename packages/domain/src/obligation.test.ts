import { describe, expect, it } from "vitest";
import {
  cancelObligation,
  createObligation,
  getObligationStatus,
  matchObligation,
  unlinkObligation,
  updateObligation,
  type Obligation,
} from "./obligation";
import {
  householdId,
  obligationId,
  transactionId,
} from "./identity";
import { money } from "./money";
import type { ExpenseTransaction, Transaction } from "./transaction";

describe("Obligation Domain", () => {
  const defaultHousehold = householdId("018f47a0-7762-7b9c-8d17-27f2f79e59a1");
  const defaultObligationId = obligationId("018f47a0-7762-7b9c-8d17-27f2f79e59a2");
  const defaultTxId = transactionId("018f47a0-7762-7b9c-8d17-27f2f79e59a3");

  const baseInput = {
    id: defaultObligationId,
    householdId: defaultHousehold,
    title: "Internet bill",
    amount: money(12999n, "PLN"),
    dueDate: "2026-09-15",
    notes: "Monthly fiber optic subscription",
  };

  const createSampleExpense = (overrides: Partial<ExpenseTransaction> = {}): ExpenseTransaction => ({
    id: defaultTxId,
    householdId: defaultHousehold,
    kind: "expense",
    amount: money(12999n, "PLN"),
    accountId: "018f47a0-7762-7b9c-8d17-27f2f79e59a4" as any,
    payee: "ISP Provider",
    paidByPersonId: "018f47a0-7762-7b9c-8d17-27f2f79e59a5" as any,
    categoryId: null,
    occurredOn: new Date("2026-09-10T12:00:00Z"),
    version: 1,
    voidedAt: null,
    voidReason: null,
    sourceNamespace: "manual",
    sourceAccountId: "",
    authoritativeId: null,
    ...overrides,
  });

  describe("createObligation", () => {
    it("creates an obligation with valid fields and defaults", () => {
      const obligation = createObligation(baseInput);

      expect(obligation.id).toBe(defaultObligationId);
      expect(obligation.householdId).toBe(defaultHousehold);
      expect(obligation.title).toBe("Internet bill");
      expect(obligation.amount.amountMinor).toBe(12999n);
      expect(obligation.amount.currency).toBe("PLN");
      expect(obligation.dueDate).toBe("2026-09-15");
      expect(obligation.notes).toBe("Monthly fiber optic subscription");
      expect(obligation.transactionId).toBeNull();
      expect(obligation.version).toBe(1);
      expect(obligation.cancelledAt).toBeNull();
      expect(obligation.createdAt).toBeInstanceOf(Date);
      expect(obligation.updatedAt).toBeInstanceOf(Date);
    });

    it("trims whitespace from title and notes", () => {
      const obligation = createObligation({
        ...baseInput,
        title: "  Electric bill  ",
        notes: "  Quarterly advance  ",
      });

      expect(obligation.title).toBe("Electric bill");
      expect(obligation.notes).toBe("Quarterly advance");
    });

    it("allows null or empty notes", () => {
      const obligation = createObligation({
        ...baseInput,
        notes: null,
      });
      expect(obligation.notes).toBeNull();

      const obligationEmpty = createObligation({
        ...baseInput,
        notes: "   ",
      });
      expect(obligationEmpty.notes).toBeNull();
    });

    it("rejects blank or empty title", () => {
      expect(() =>
        createObligation({
          ...baseInput,
          title: "",
        }),
      ).toThrowError(/Title cannot be blank/);

      expect(() =>
        createObligation({
          ...baseInput,
          title: "   ",
        }),
      ).toThrowError(/Title cannot be blank/);
    });

    it("rejects title exceeding maximum length of 160 characters", () => {
      expect(() =>
        createObligation({
          ...baseInput,
          title: "a".repeat(161),
        }),
      ).toThrowError(/Title exceeds maximum length/);
    });

    it("rejects notes exceeding maximum length of 280 characters", () => {
      expect(() =>
        createObligation({
          ...baseInput,
          notes: "a".repeat(281),
        }),
      ).toThrowError(/Notes exceed maximum length/);
    });

    it("rejects non-positive amountMinor (zero or negative)", () => {
      expect(() =>
        createObligation({
          ...baseInput,
          amount: money(0n, "PLN"),
        }),
      ).toThrowError(/Amount must be positive/);

      expect(() =>
        createObligation({
          ...baseInput,
          amount: money(-100n, "PLN"),
        }),
      ).toThrowError(/Amount must be positive/);
    });

    it("rejects invalid calendar dueDate format", () => {
      expect(() =>
        createObligation({
          ...baseInput,
          dueDate: "2026-09-15T00:00:00Z",
        }),
      ).toThrowError(/Invalid calendar date format/);

      expect(() =>
        createObligation({
          ...baseInput,
          dueDate: "15-09-2026",
        }),
      ).toThrowError(/Invalid calendar date format/);

      expect(() =>
        createObligation({
          ...baseInput,
          dueDate: "2026-02-31",
        }),
      ).toThrowError(/Invalid calendar date/);
    });
  });

  describe("getObligationStatus", () => {
    it("derives 'upcoming' when active, unmatched, and dueDate is today or in future", () => {
      const today = "2026-09-10";

      const sameDay = createObligation({ ...baseInput, dueDate: "2026-09-10" });
      expect(getObligationStatus(sameDay, today)).toBe("upcoming");

      const futureDay = createObligation({ ...baseInput, dueDate: "2026-09-11" });
      expect(getObligationStatus(futureDay, today)).toBe("upcoming");
    });

    it("derives 'overdue' when active, unmatched, and dueDate is strictly before today", () => {
      const today = "2026-09-10";

      const pastDay = createObligation({ ...baseInput, dueDate: "2026-09-09" });
      expect(getObligationStatus(pastDay, today)).toBe("overdue");
    });

    it("derives 'paid' when active and matched to a transaction", () => {
      const today = "2026-09-10";

      const obligation = createObligation(baseInput);
      const matched = matchObligation(obligation, createSampleExpense());

      expect(getObligationStatus(matched, today)).toBe("paid");
    });

    it("derives 'cancelled' when cancelledAt is set, regardless of dueDate", () => {
      const today = "2026-09-10";

      const obligation = createObligation({ ...baseInput, dueDate: "2026-09-15" });
      const cancelled = cancelObligation(obligation);

      expect(getObligationStatus(cancelled, today)).toBe("cancelled");

      const overdueObligation = createObligation({ ...baseInput, dueDate: "2026-09-01" });
      const cancelledOverdue = cancelObligation(overdueObligation);
      expect(getObligationStatus(cancelledOverdue, today)).toBe("cancelled");
    });
  });

  describe("matchObligation", () => {
    it("successfully matches active obligation with active expense of exact currency and amount", () => {
      const obligation = createObligation(baseInput);
      const expense = createSampleExpense();

      const matched = matchObligation(obligation, expense);

      expect(matched.transactionId).toBe(expense.id);
      expect(matched.version).toBe(obligation.version + 1);
      expect(matched.updatedAt.getTime()).toBeGreaterThanOrEqual(obligation.updatedAt.getTime());
    });

    it("rejects match if households do not match", () => {
      const obligation = createObligation(baseInput);
      const crossHouseholdExpense = createSampleExpense({
        householdId: householdId("018f47a0-7762-7b9c-8d17-27f2f79e5999"),
      });

      expect(() => matchObligation(obligation, crossHouseholdExpense)).toThrowError(
        /same household/i,
      );
    });

    it("rejects match if transaction is voided", () => {
      const obligation = createObligation(baseInput);
      const voidedExpense = createSampleExpense({
        voidedAt: new Date("2026-09-10T12:00:00Z"),
      });

      expect(() => matchObligation(obligation, voidedExpense)).toThrowError(
        /active transaction/i,
      );
    });

    it("rejects match if transaction kind is not expense", () => {
      const obligation = createObligation(baseInput);
      const incomeTx = {
        id: defaultTxId,
        householdId: defaultHousehold,
        kind: "income" as const,
        amount: money(12999n, "PLN"),
        accountId: "018f47a0-7762-7b9c-8d17-27f2f79e59a4" as any,
        source: "Salary",
        receivedByPersonId: "018f47a0-7762-7b9c-8d17-27f2f79e59a5" as any,
        categoryId: null,
        occurredOn: new Date("2026-09-10T12:00:00Z"),
        version: 1,
        voidedAt: null,
        voidReason: null,
      } as unknown as Transaction;

      expect(() => matchObligation(obligation, incomeTx)).toThrowError(
        /kind expense only/i,
      );
    });

    it("rejects match if currency does not match exactly", () => {
      const obligation = createObligation(baseInput);
      const eurExpense = createSampleExpense({
        amount: money(12999n, "EUR"),
      });

      expect(() => matchObligation(obligation, eurExpense)).toThrowError(
        /exact currency/i,
      );
    });

    it("rejects match if amountMinor does not match exactly", () => {
      const obligation = createObligation(baseInput);
      const differentAmount = createSampleExpense({
        amount: money(13000n, "PLN"),
      });

      expect(() => matchObligation(obligation, differentAmount)).toThrowError(
        /exact amount/i,
      );
    });

    it("rejects match if obligation is cancelled", () => {
      const obligation = cancelObligation(createObligation(baseInput));
      const expense = createSampleExpense();

      expect(() => matchObligation(obligation, expense)).toThrowError(
        /cannot match cancelled/i,
      );
    });

    it("rejects match if obligation is already matched", () => {
      const obligation = createObligation(baseInput);
      const expense = createSampleExpense();
      const matched = matchObligation(obligation, expense);

      expect(() => matchObligation(matched, expense)).toThrowError(
        /already matched/i,
      );
    });
  });

  describe("unlinkObligation", () => {
    it("successfully unlinks an active matched obligation", () => {
      const obligation = createObligation(baseInput);
      const expense = createSampleExpense();
      const matched = matchObligation(obligation, expense);

      const unlinked = unlinkObligation(matched, expense);

      expect(unlinked.transactionId).toBeNull();
      expect(unlinked.version).toBe(matched.version + 1);
    });

    it("rejects unlink if obligation is not matched", () => {
      const obligation = createObligation(baseInput);
      const expense = createSampleExpense();

      expect(() => unlinkObligation(obligation, expense)).toThrowError(
        /not matched/i,
      );
    });

    it("rejects unlink if obligation is cancelled", () => {
      const obligation: Obligation = {
        ...createObligation(baseInput),
        transactionId: defaultTxId,
        cancelledAt: new Date(),
      };
      const expense = createSampleExpense();

      expect(() => unlinkObligation(obligation, expense)).toThrowError(
        /cannot unlink cancelled/i,
      );
    });

    it("rejects unlink if linked transaction id does not match", () => {
      const obligation = createObligation(baseInput);
      const expense = createSampleExpense();
      const matched = matchObligation(obligation, expense);

      const differentExpense = createSampleExpense({
        id: transactionId("018f47a0-7762-7b9c-8d17-27f2f79e5988"),
      });

      expect(() => unlinkObligation(matched, differentExpense)).toThrowError(
        /transaction id mismatch/i,
      );
    });
  });

  describe("cancelObligation", () => {
    it("cancels an active unmatched obligation", () => {
      const obligation = createObligation(baseInput);
      const cancelled = cancelObligation(obligation);

      expect(cancelled.cancelledAt).toBeInstanceOf(Date);
      expect(cancelled.version).toBe(obligation.version + 1);
    });

    it("rejects cancellation if already cancelled", () => {
      const obligation = cancelObligation(createObligation(baseInput));

      expect(() => cancelObligation(obligation)).toThrowError(
        /already cancelled/i,
      );
    });

    it("rejects cancellation if matched to a transaction (must unlink first)", () => {
      const obligation = createObligation(baseInput);
      const matched = matchObligation(obligation, createSampleExpense());

      expect(() => cancelObligation(matched)).toThrowError(
        /must unlink/i,
      );
    });
  });

  describe("updateObligation", () => {
    it("updates title, dueDate, and notes of an active obligation", () => {
      const obligation = createObligation(baseInput);
      const updated = updateObligation(obligation, {
        title: "Home Internet",
        dueDate: "2026-09-20",
        notes: "Updated terms",
      });

      expect(updated.title).toBe("Home Internet");
      expect(updated.dueDate).toBe("2026-09-20");
      expect(updated.notes).toBe("Updated terms");
      expect(updated.version).toBe(obligation.version + 1);
    });

    it("updates amount and currency when obligation is unmatched", () => {
      const obligation = createObligation(baseInput);
      const updated = updateObligation(obligation, {
        amount: money(15000n, "EUR"),
      });

      expect(updated.amount.amountMinor).toBe(15000n);
      expect(updated.amount.currency).toBe("EUR");
      expect(updated.version).toBe(obligation.version + 1);
    });

    it("rejects modifying amount or currency when matched to a transaction", () => {
      const obligation = createObligation(baseInput);
      const matched = matchObligation(obligation, createSampleExpense());

      expect(() =>
        updateObligation(matched, {
          amount: money(15000n, "PLN"),
        }),
      ).toThrowError(/Cannot modify amount or currency of matched obligation/);

      expect(() =>
        updateObligation(matched, {
          amount: money(12999n, "EUR"),
        }),
      ).toThrowError(/Cannot modify amount or currency of matched obligation/);
    });

    it("rejects updating a cancelled obligation", () => {
      const obligation = cancelObligation(createObligation(baseInput));

      expect(() =>
        updateObligation(obligation, {
          title: "New Title",
        }),
      ).toThrowError(/Cannot update cancelled obligation/);
    });
  });
});
