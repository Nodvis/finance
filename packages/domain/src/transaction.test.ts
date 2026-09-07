import { describe, expect, expectTypeOf, it } from "vitest";

import {
  createAccount,
  createHousehold,
  createPerson,
} from "./index";
import {
  accountId,
  householdId,
  personId,
  transactionId,
} from "./identity";
import type {
  AccountId,
  HouseholdId,
  PersonId,
  TransactionId,
} from "./identity";
import { isZeroMoney, money } from "./money";
import {
  TRANSACTION_KINDS,
  createExpense,
  createIncome,
  createTransfer,
  isExpense,
  isIncome,
  isTransfer,
  ledgerEntries,
  netMoneyEffect,
  transactionKind,
} from "./transaction";
import type {
  ExpenseTransaction,
  IncomeTransaction,
  Transaction,
  TransferTransaction,
} from "./transaction";

const householdUuid = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";
const personUuid1 = "018f47a0-7762-7b9c-8d17-27f2f79e59a2";
const personUuid2 = "018f47a0-7762-7b9c-8d17-27f2f79e59a3";
const accountUuid1 = "018f47a0-7762-7b9c-8d17-27f2f79e59a4";
const accountUuid2 = "018f47a0-7762-7b9c-8d17-27f2f79e59a5";
const txUuid1 = "018f47a0-7762-7b9c-8d17-27f2f79e59a6";
const txUuid2 = "018f47a0-7762-7b9c-8d17-27f2f79e59a7";
const txUuid3 = "018f47a0-7762-7b9c-8d17-27f2f79e59a8";

describe("TransactionId identity", () => {
  it("creates and normalizes valid transaction ids", () => {
    const id = transactionId(" 018F47A0-7762-7B9C-8D17-27F2F79E59A6 ");
    expect(id).toBe(txUuid1);
    expectTypeOf(id).toEqualTypeOf<TransactionId>();
  });

  it("rejects malformed transaction ids", () => {
    expect(() => transactionId("not-a-uuid")).toThrow(/Invalid transaction id/);
  });
});

describe("Transaction kinds and constants", () => {
  it("defines the expected transaction kinds", () => {
    expect(TRANSACTION_KINDS).toEqual(["expense", "income", "transfer"]);
  });
});

describe("Manual transactions happy paths and immutability", () => {
  it("creates an expense transaction with trimmed payee and deep freezing", () => {
    const occurredOn = new Date("2026-09-07T10:30:00Z");
    const expense = createExpense({
      id: transactionId(txUuid1),
      householdId: householdId(householdUuid),
      accountId: accountId(accountUuid1),
      amount: money(4500n, "PLN"),
      payee: "  Biedronka  ",
      paidByPersonId: personId(personUuid1),
      occurredOn,
    });

    expect(expense).toEqual({
      id: txUuid1,
      householdId: householdUuid,
      kind: "expense",
      accountId: accountUuid1,
      amount: { amountMinor: 4500n, currency: "PLN" },
      payee: "Biedronka",
      paidByPersonId: personUuid1,
      occurredOn,
    });

    expect(Object.isFrozen(expense)).toBe(true);
    expect(Object.isFrozen(expense.amount)).toBe(true);
    expect(Object.isFrozen(expense.occurredOn)).toBe(true);
  });

  it("creates an income transaction with trimmed source and deep freezing", () => {
    const occurredOn = new Date("2026-09-07T09:00:00Z");
    const income = createIncome({
      id: transactionId(txUuid2),
      householdId: householdId(householdUuid),
      accountId: accountId(accountUuid1),
      amount: money(1200000n, "PLN"),
      source: "  Acme Corp  ",
      receivedByPersonId: personId(personUuid2),
      occurredOn,
    });

    expect(income).toEqual({
      id: txUuid2,
      householdId: householdUuid,
      kind: "income",
      accountId: accountUuid1,
      amount: { amountMinor: 1200000n, currency: "PLN" },
      source: "Acme Corp",
      receivedByPersonId: personUuid2,
      occurredOn,
    });

    expect(Object.isFrozen(income)).toBe(true);
    expect(Object.isFrozen(income.amount)).toBe(true);
    expect(Object.isFrozen(income.occurredOn)).toBe(true);
  });

  it("creates a transfer transaction with distinct accounts and deep freezing", () => {
    const occurredOn = new Date("2026-09-07T11:00:00Z");
    const transfer = createTransfer({
      id: transactionId(txUuid3),
      householdId: householdId(householdUuid),
      fromAccountId: accountId(accountUuid1),
      toAccountId: accountId(accountUuid2),
      amount: money(50000n, "PLN"),
      occurredOn,
    });

    expect(transfer).toEqual({
      id: txUuid3,
      householdId: householdUuid,
      kind: "transfer",
      fromAccountId: accountUuid1,
      toAccountId: accountUuid2,
      amount: { amountMinor: 50000n, currency: "PLN" },
      occurredOn,
    });

    expect(Object.isFrozen(transfer)).toBe(true);
    expect(Object.isFrozen(transfer.amount)).toBe(true);
    expect(Object.isFrozen(transfer.occurredOn)).toBe(true);
  });
});

describe("Transaction amount validation", () => {
  it("rejects zero amounts for expense, income, and transfer", () => {
    const zero = money(0n, "PLN");
    const occurredOn = new Date("2026-09-07T10:00:00Z");

    expect(() =>
      createExpense({
        id: transactionId(txUuid1),
        householdId: householdId(householdUuid),
        accountId: accountId(accountUuid1),
        amount: zero,
        payee: "Store",
        paidByPersonId: personId(personUuid1),
        occurredOn,
      }),
    ).toThrow(/strictly positive/);

    expect(() =>
      createIncome({
        id: transactionId(txUuid2),
        householdId: householdId(householdUuid),
        accountId: accountId(accountUuid1),
        amount: zero,
        source: "Client",
        receivedByPersonId: personId(personUuid1),
        occurredOn,
      }),
    ).toThrow(/strictly positive/);

    expect(() =>
      createTransfer({
        id: transactionId(txUuid3),
        householdId: householdId(householdUuid),
        fromAccountId: accountId(accountUuid1),
        toAccountId: accountId(accountUuid2),
        amount: zero,
        occurredOn,
      }),
    ).toThrow(/strictly positive/);
  });

  it("rejects negative amounts for expense, income, and transfer", () => {
    const negative = money(-1000n, "PLN");
    const occurredOn = new Date("2026-09-07T10:00:00Z");

    expect(() =>
      createExpense({
        id: transactionId(txUuid1),
        householdId: householdId(householdUuid),
        accountId: accountId(accountUuid1),
        amount: negative,
        payee: "Store",
        paidByPersonId: personId(personUuid1),
        occurredOn,
      }),
    ).toThrow(/strictly positive/);

    expect(() =>
      createIncome({
        id: transactionId(txUuid2),
        householdId: householdId(householdUuid),
        accountId: accountId(accountUuid1),
        amount: negative,
        source: "Client",
        receivedByPersonId: personId(personUuid1),
        occurredOn,
      }),
    ).toThrow(/strictly positive/);

    expect(() =>
      createTransfer({
        id: transactionId(txUuid3),
        householdId: householdId(householdUuid),
        fromAccountId: accountId(accountUuid1),
        toAccountId: accountId(accountUuid2),
        amount: negative,
        occurredOn,
      }),
    ).toThrow(/strictly positive/);
  });
});

describe("Transaction occurredOn validation", () => {
  it("rejects invalid/NaN occurredOn for expense, income, and transfer", () => {
    const invalidDate = new Date("invalid-date");

    expect(() =>
      createExpense({
        id: transactionId(txUuid1),
        householdId: householdId(householdUuid),
        accountId: accountId(accountUuid1),
        amount: money(100n, "PLN"),
        payee: "Store",
        paidByPersonId: personId(personUuid1),
        occurredOn: invalidDate,
      }),
    ).toThrow(/Invalid transaction date/);

    expect(() =>
      createIncome({
        id: transactionId(txUuid2),
        householdId: householdId(householdUuid),
        accountId: accountId(accountUuid1),
        amount: money(100n, "PLN"),
        source: "Client",
        receivedByPersonId: personId(personUuid1),
        occurredOn: invalidDate,
      }),
    ).toThrow(/Invalid transaction date/);

    expect(() =>
      createTransfer({
        id: transactionId(txUuid3),
        householdId: householdId(householdUuid),
        fromAccountId: accountId(accountUuid1),
        toAccountId: accountId(accountUuid2),
        amount: money(100n, "PLN"),
        occurredOn: invalidDate,
      }),
    ).toThrow(/Invalid transaction date/);
  });
});

describe("Payee and source string validation", () => {
  const occurredOn = new Date("2026-09-07T10:00:00Z");

  it("rejects blank or whitespace payee for expense", () => {
    expect(() =>
      createExpense({
        id: transactionId(txUuid1),
        householdId: householdId(householdUuid),
        accountId: accountId(accountUuid1),
        amount: money(500n, "PLN"),
        payee: "",
        paidByPersonId: personId(personUuid1),
        occurredOn,
      }),
    ).toThrow(/Invalid transaction payee/);

    expect(() =>
      createExpense({
        id: transactionId(txUuid1),
        householdId: householdId(householdUuid),
        accountId: accountId(accountUuid1),
        amount: money(500n, "PLN"),
        payee: "   ",
        paidByPersonId: personId(personUuid1),
        occurredOn,
      }),
    ).toThrow(/Invalid transaction payee/);
  });

  it("rejects oversized payee for expense and allows maximum valid length", () => {
    expect(() =>
      createExpense({
        id: transactionId(txUuid1),
        householdId: householdId(householdUuid),
        accountId: accountId(accountUuid1),
        amount: money(500n, "PLN"),
        payee: "A".repeat(161),
        paidByPersonId: personId(personUuid1),
        occurredOn,
      }),
    ).toThrow(/Invalid transaction payee/);

    const validMaxExpense = createExpense({
      id: transactionId(txUuid1),
      householdId: householdId(householdUuid),
      accountId: accountId(accountUuid1),
      amount: money(500n, "PLN"),
      payee: "A".repeat(160),
      paidByPersonId: personId(personUuid1),
      occurredOn,
    });
    expect(validMaxExpense.payee).toBe("A".repeat(160));
  });

  it("rejects blank or whitespace source for income", () => {
    expect(() =>
      createIncome({
        id: transactionId(txUuid2),
        householdId: householdId(householdUuid),
        accountId: accountId(accountUuid1),
        amount: money(500n, "PLN"),
        source: "",
        receivedByPersonId: personId(personUuid1),
        occurredOn,
      }),
    ).toThrow(/Invalid transaction source/);

    expect(() =>
      createIncome({
        id: transactionId(txUuid2),
        householdId: householdId(householdUuid),
        accountId: accountId(accountUuid1),
        amount: money(500n, "PLN"),
        source: "   ",
        receivedByPersonId: personId(personUuid1),
        occurredOn,
      }),
    ).toThrow(/Invalid transaction source/);
  });

  it("rejects oversized source for income and allows maximum valid length", () => {
    expect(() =>
      createIncome({
        id: transactionId(txUuid2),
        householdId: householdId(householdUuid),
        accountId: accountId(accountUuid1),
        amount: money(500n, "PLN"),
        source: "B".repeat(161),
        receivedByPersonId: personId(personUuid1),
        occurredOn,
      }),
    ).toThrow(/Invalid transaction source/);

    const validMaxIncome = createIncome({
      id: transactionId(txUuid2),
      householdId: householdId(householdUuid),
      accountId: accountId(accountUuid1),
      amount: money(500n, "PLN"),
      source: "B".repeat(160),
      receivedByPersonId: personId(personUuid1),
      occurredOn,
    });
    expect(validMaxIncome.source).toBe("B".repeat(160));
  });
});

describe("Transfer account validation (self-transfer rejection)", () => {
  it("rejects transfer when fromAccountId and toAccountId are identical", () => {
    const acc = accountId(accountUuid1);
    expect(() =>
      createTransfer({
        id: transactionId(txUuid3),
        householdId: householdId(householdUuid),
        fromAccountId: acc,
        toAccountId: acc,
        amount: money(1000n, "PLN"),
        occurredOn: new Date("2026-09-07T12:00:00Z"),
      }),
    ).toThrow(/self-transfer rejected/);
  });
});

describe("Type guards and transactionKind", () => {
  const occurredOn = new Date("2026-09-07T12:00:00Z");

  const expense: Transaction = createExpense({
    id: transactionId(txUuid1),
    householdId: householdId(householdUuid),
    accountId: accountId(accountUuid1),
    amount: money(2500n, "PLN"),
    payee: "Bakery",
    paidByPersonId: personId(personUuid1),
    occurredOn,
  });

  const income: Transaction = createIncome({
    id: transactionId(txUuid2),
    householdId: householdId(householdUuid),
    accountId: accountId(accountUuid1),
    amount: money(100000n, "PLN"),
    source: "Bonus",
    receivedByPersonId: personId(personUuid1),
    occurredOn,
  });

  const transfer: Transaction = createTransfer({
    id: transactionId(txUuid3),
    householdId: householdId(householdUuid),
    fromAccountId: accountId(accountUuid1),
    toAccountId: accountId(accountUuid2),
    amount: money(5000n, "PLN"),
    occurredOn,
  });

  it("correctly identifies transactionKind", () => {
    expect(transactionKind(expense)).toBe("expense");
    expect(transactionKind(income)).toBe("income");
    expect(transactionKind(transfer)).toBe("transfer");
  });

  it("classifies expense with isExpense", () => {
    expect(isExpense(expense)).toBe(true);
    expect(isIncome(expense)).toBe(false);
    expect(isTransfer(expense)).toBe(false);
  });

  it("classifies income with isIncome", () => {
    expect(isExpense(income)).toBe(false);
    expect(isIncome(income)).toBe(true);
    expect(isTransfer(income)).toBe(false);
  });

  it("classifies transfer with isTransfer and never as expense or income (INV-001)", () => {
    expect(isTransfer(transfer)).toBe(true);
    expect(isExpense(transfer)).toBe(false);
    expect(isIncome(transfer)).toBe(false);
  });
});

describe("ledgerEntries and netMoneyEffect", () => {
  const occurredOn = new Date("2026-09-07T12:00:00Z");

  it("produces a single negative effect (outflow) for expense", () => {
    const expense = createExpense({
      id: transactionId(txUuid1),
      householdId: householdId(householdUuid),
      accountId: accountId(accountUuid1),
      amount: money(4500n, "PLN"),
      payee: "Pharmacy",
      paidByPersonId: personId(personUuid1),
      occurredOn,
    });

    const entries = ledgerEntries(expense);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      accountId: accountUuid1,
      effect: { amountMinor: -4500n, currency: "PLN" },
    });
    expect(Object.isFrozen(entries)).toBe(true);
    expect(Object.isFrozen(entries[0])).toBe(true);

    const net = netMoneyEffect(expense);
    expect(net).toEqual({ amountMinor: -4500n, currency: "PLN" });
    expect(net.amountMinor).toBeLessThan(0n);
  });

  it("produces a single positive effect (inflow) for income", () => {
    const income = createIncome({
      id: transactionId(txUuid2),
      householdId: householdId(householdUuid),
      accountId: accountId(accountUuid1),
      amount: money(800000n, "PLN"),
      source: "Salary",
      receivedByPersonId: personId(personUuid1),
      occurredOn,
    });

    const entries = ledgerEntries(income);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      accountId: accountUuid1,
      effect: { amountMinor: 800000n, currency: "PLN" },
    });
    expect(Object.isFrozen(entries)).toBe(true);
    expect(Object.isFrozen(entries[0])).toBe(true);

    const net = netMoneyEffect(income);
    expect(net).toEqual({ amountMinor: 800000n, currency: "PLN" });
    expect(net.amountMinor).toBeGreaterThan(0n);
  });

  it("produces balanced entries for transfer with netMoneyEffect exactly zero (INV-001 / no fictitious money)", () => {
    const transfer = createTransfer({
      id: transactionId(txUuid3),
      householdId: householdId(householdUuid),
      fromAccountId: accountId(accountUuid1),
      toAccountId: accountId(accountUuid2),
      amount: money(15000n, "PLN"),
      occurredOn,
    });

    const entries = ledgerEntries(transfer);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      accountId: accountUuid1,
      effect: { amountMinor: -15000n, currency: "PLN" },
    });
    expect(entries[1]).toEqual({
      accountId: accountUuid2,
      effect: { amountMinor: 15000n, currency: "PLN" },
    });
    expect(Object.isFrozen(entries)).toBe(true);
    expect(Object.isFrozen(entries[0])).toBe(true);
    expect(Object.isFrozen(entries[1])).toBe(true);

    const net = netMoneyEffect(transfer);
    expect(net).toEqual({ amountMinor: 0n, currency: "PLN" });
    expect(isZeroMoney(net)).toBe(true);
  });
});

describe("Financial invariants", () => {
  it("INV-001 & INV-002: ATM withdrawal / moving money between owned accounts is a transfer with zero net effect", () => {
    const bankAccount = createAccount({
      id: accountId(accountUuid1),
      householdId: householdId(householdUuid),
      name: "mBank checking",
      type: "checking",
      currency: "PLN",
      ownerPersonIds: [personId(personUuid1)],
    });

    const cashWallet = createAccount({
      id: accountId(accountUuid2),
      householdId: householdId(householdUuid),
      name: "Cash wallet",
      type: "cash",
      currency: "PLN",
      ownerPersonIds: [personId(personUuid1)],
    });

    const atmWithdrawal = createTransfer({
      id: transactionId(txUuid3),
      householdId: householdId(householdUuid),
      fromAccountId: bankAccount.id,
      toAccountId: cashWallet.id,
      amount: money(50000n, "PLN"), // 500.00 PLN
      occurredOn: new Date("2026-09-07T14:00:00Z"),
    });

    expect(isTransfer(atmWithdrawal)).toBe(true);
    expect(isExpense(atmWithdrawal)).toBe(false);
    expect(isIncome(atmWithdrawal)).toBe(false);
    expect(isZeroMoney(netMoneyEffect(atmWithdrawal))).toBe(true);
  });

  it("INV-011: Household and Person are distinct concepts; transaction carries independent household context", () => {
    const hId = householdId(householdUuid);
    const pId = personId(personUuid1);

    expectTypeOf(hId).not.toEqualTypeOf(pId);

    const expense = createExpense({
      id: transactionId(txUuid1),
      householdId: hId,
      accountId: accountId(accountUuid1),
      amount: money(3000n, "PLN"),
      payee: "Hardware Store",
      paidByPersonId: pId,
      occurredOn: new Date("2026-09-07T12:00:00Z"),
    });

    expect(expense.householdId).toBe(hId);
    expect(expense.paidByPersonId).toBe(pId);
  });

  it("INV-012: Account ownership is distinct from transaction payer/beneficiary context", () => {
    const accountOwner = personId(personUuid1);
    const transactionPayer = personId(personUuid2);
    const hId = householdId(householdUuid);

    const jointAccount = createAccount({
      id: accountId(accountUuid1),
      householdId: hId,
      name: "Main joint account",
      type: "checking",
      currency: "PLN",
      ownerPersonIds: [accountOwner],
    });

    const expense = createExpense({
      id: transactionId(txUuid1),
      householdId: hId,
      accountId: jointAccount.id,
      amount: money(7200n, "PLN"),
      payee: "Supermarket",
      paidByPersonId: transactionPayer,
      occurredOn: new Date("2026-09-07T12:00:00Z"),
    });

    // Payer is personUuid2, whereas account owner is personUuid1
    expect(expense.paidByPersonId).toBe(transactionPayer);
    expect(jointAccount.ownerPersonIds).toContain(accountOwner);
    expect(jointAccount.ownerPersonIds).not.toContain(transactionPayer);
    expect(expense.accountId).toBe(jointAccount.id);

    const income = createIncome({
      id: transactionId(txUuid2),
      householdId: hId,
      accountId: jointAccount.id,
      amount: money(15000n, "PLN"),
      source: "Gift from family",
      receivedByPersonId: transactionPayer,
      occurredOn: new Date("2026-09-07T12:00:00Z"),
    });

    // Beneficiary is personUuid2, distinct from account owner personUuid1
    expect(income.receivedByPersonId).toBe(transactionPayer);
    expect(income.accountId).toBe(jointAccount.id);
  });
});
