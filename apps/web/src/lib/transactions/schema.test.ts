import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import {
  createTransactionSchema,
  listTransactionsQuerySchema,
} from "./schema";

const validAccount1 = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";
const validAccount2 = "018f47a0-7762-7b9c-8d17-27f2f79e59a2";
const validPerson = "018f47a0-7762-7b9c-8d17-27f2f79e59a3";

describe("createTransactionSchema", () => {
  describe("expense schema", () => {
    it("parses valid expense with nested amount", () => {
      const input = {
        kind: "expense",
        accountId: validAccount1,
        amount: { amountMinor: "4500", currency: "pln" },
        payee: "Grocery Store",
        paidByPersonId: validPerson,
        occurredOn: "2026-09-07T12:00:00Z",
      };

      const result = createTransactionSchema.parse(input);
      expect(result).toEqual({
        kind: "expense",
        accountId: validAccount1,
        amount: { amountMinor: 4500n, currency: "PLN" },
        payee: "Grocery Store",
        paidByPersonId: validPerson,
        occurredOn: new Date("2026-09-07T12:00:00Z"),
      });
    });

    it("parses valid expense with flattened amountMinor and currency", () => {
      const input = {
        kind: "expense",
        accountId: validAccount1,
        amountMinor: "2500",
        currency: "EUR",
        payee: "Bakery",
        occurredOn: "2026-09-07T12:00:00Z",
      };

      const result = createTransactionSchema.parse(input);
      expect(result.amount).toEqual({ amountMinor: 2500n, currency: "EUR" });
    });

    it("parses valid expense with bigint amountMinor", () => {
      const input = {
        kind: "expense",
        accountId: validAccount1,
        amount: { amountMinor: 2500n, currency: "EUR" },
        payee: "Bakery",
        occurredOn: "2026-09-07T12:00:00Z",
      };

      const result = createTransactionSchema.parse(input);
      expect(result.amount).toEqual({ amountMinor: 2500n, currency: "EUR" });
    });

    it("rejects unsafe numeric and non-integer input for amountMinor", () => {
      // Rejects JavaScript numbers to prevent silent precision loss
      expect(() =>
        createTransactionSchema.parse({
          kind: "expense",
          accountId: validAccount1,
          amount: { amountMinor: 2500, currency: "PLN" },
          payee: "Store",
          occurredOn: "2026-09-07T12:00:00Z",
        }),
      ).toThrow(ZodError);

      expect(() =>
        createTransactionSchema.parse({
          kind: "expense",
          accountId: validAccount1,
          amount: { amountMinor: 9007199254740993, currency: "PLN" },
          payee: "Store",
          occurredOn: "2026-09-07T12:00:00Z",
        }),
      ).toThrow(ZodError);

      expect(() =>
        createTransactionSchema.parse({
          kind: "expense",
          accountId: validAccount1,
          amount: { amountMinor: 25.5, currency: "PLN" },
          payee: "Store",
          occurredOn: "2026-09-07T12:00:00Z",
        }),
      ).toThrow(ZodError);

      // Rejects flattened numeric amountMinor
      expect(() =>
        createTransactionSchema.parse({
          kind: "expense",
          accountId: validAccount1,
          amountMinor: 2500,
          currency: "PLN",
          payee: "Store",
          occurredOn: "2026-09-07T12:00:00Z",
        }),
      ).toThrow(ZodError);

      // Rejects decimal / floating-point strings
      expect(() =>
        createTransactionSchema.parse({
          kind: "expense",
          accountId: validAccount1,
          amount: { amountMinor: "25.50", currency: "PLN" },
          payee: "Store",
          occurredOn: "2026-09-07T12:00:00Z",
        }),
      ).toThrow(ZodError);

      // Rejects non-integer strings with exponents or non-digit chars
      expect(() =>
        createTransactionSchema.parse({
          kind: "expense",
          accountId: validAccount1,
          amount: { amountMinor: "1e5", currency: "PLN" },
          payee: "Store",
          occurredOn: "2026-09-07T12:00:00Z",
        }),
      ).toThrow(ZodError);
    });

    it("rejects non-positive amounts", () => {
      expect(() =>
        createTransactionSchema.parse({
          kind: "expense",
          accountId: validAccount1,
          amount: { amountMinor: "0", currency: "PLN" },
          payee: "Store",
          occurredOn: "2026-09-07T12:00:00Z",
        }),
      ).toThrow(ZodError);

      expect(() =>
        createTransactionSchema.parse({
          kind: "expense",
          accountId: validAccount1,
          amount: { amountMinor: "-100", currency: "PLN" },
          payee: "Store",
          occurredOn: "2026-09-07T12:00:00Z",
        }),
      ).toThrow(ZodError);
    });

    it("rejects blank or oversized payee", () => {
      expect(() =>
        createTransactionSchema.parse({
          kind: "expense",
          accountId: validAccount1,
          amount: { amountMinor: "100", currency: "PLN" },
          payee: "   ",
          occurredOn: "2026-09-07T12:00:00Z",
        }),
      ).toThrow(ZodError);

      expect(() =>
        createTransactionSchema.parse({
          kind: "expense",
          accountId: validAccount1,
          amount: { amountMinor: "100", currency: "PLN" },
          payee: "X".repeat(161),
          occurredOn: "2026-09-07T12:00:00Z",
        }),
      ).toThrow(ZodError);
    });
  });

  describe("income schema", () => {
    it("parses valid income transaction", () => {
      const input = {
        kind: "income",
        accountId: validAccount1,
        amount: { amountMinor: "1000000", currency: "PLN" },
        source: "Employer Payroll",
        receivedByPersonId: validPerson,
        occurredOn: "2026-09-07T08:00:00Z",
      };

      const result = createTransactionSchema.parse(input);
      expect(result).toEqual({
        kind: "income",
        accountId: validAccount1,
        amount: { amountMinor: 1000000n, currency: "PLN" },
        source: "Employer Payroll",
        receivedByPersonId: validPerson,
        occurredOn: new Date("2026-09-07T08:00:00Z"),
      });
    });

    it("rejects blank or invalid source", () => {
      expect(() =>
        createTransactionSchema.parse({
          kind: "income",
          accountId: validAccount1,
          amount: { amountMinor: "500", currency: "PLN" },
          source: "",
          occurredOn: "2026-09-07T08:00:00Z",
        }),
      ).toThrow(ZodError);
    });
  });

  describe("transfer schema", () => {
    it("parses valid transfer transaction", () => {
      const input = {
        kind: "transfer",
        fromAccountId: validAccount1,
        toAccountId: validAccount2,
        amount: { amountMinor: "50000", currency: "PLN" },
        occurredOn: "2026-09-07T14:00:00Z",
      };

      const result = createTransactionSchema.parse(input);
      expect(result).toEqual({
        kind: "transfer",
        fromAccountId: validAccount1,
        toAccountId: validAccount2,
        amount: { amountMinor: 50000n, currency: "PLN" },
        occurredOn: new Date("2026-09-07T14:00:00Z"),
      });
    });

    it("rejects self-transfers where fromAccountId equals toAccountId", () => {
      expect(() =>
        createTransactionSchema.parse({
          kind: "transfer",
          fromAccountId: validAccount1,
          toAccountId: validAccount1,
          amount: { amountMinor: "50000", currency: "PLN" },
          occurredOn: "2026-09-07T14:00:00Z",
        }),
      ).toThrow(ZodError);
    });
  });

  describe("currency validation", () => {
    it("rejects invalid currency codes", () => {
      expect(() =>
        createTransactionSchema.parse({
          kind: "expense",
          accountId: validAccount1,
          amount: { amountMinor: "100", currency: "PLNX" },
          payee: "Store",
          occurredOn: "2026-09-07T12:00:00Z",
        }),
      ).toThrow(ZodError);

      expect(() =>
        createTransactionSchema.parse({
          kind: "expense",
          accountId: validAccount1,
          amount: { amountMinor: "100", currency: "12" },
          payee: "Store",
          occurredOn: "2026-09-07T12:00:00Z",
        }),
      ).toThrow(ZodError);
    });
  });
});

describe("listTransactionsQuerySchema", () => {
  it("applies default limit and offset", () => {
    const result = listTransactionsQuerySchema.parse({});
    expect(result).toEqual({
      limit: 50,
      offset: 0,
    });
  });

  it("coerces string numbers and validates accountId uuid", () => {
    const result = listTransactionsQuerySchema.parse({
      accountId: validAccount1,
      limit: "25",
      offset: "10",
    });
    expect(result).toEqual({
      accountId: validAccount1,
      limit: 25,
      offset: 10,
    });
  });

  it("rejects invalid query parameters", () => {
    expect(() =>
      listTransactionsQuerySchema.parse({ limit: "0" }),
    ).toThrow(ZodError);

    expect(() =>
      listTransactionsQuerySchema.parse({ limit: "150" }),
    ).toThrow(ZodError);

    expect(() =>
      listTransactionsQuerySchema.parse({ offset: "-5" }),
    ).toThrow(ZodError);

    expect(() =>
      listTransactionsQuerySchema.parse({ accountId: "not-a-uuid" }),
    ).toThrow(ZodError);
  });
});
