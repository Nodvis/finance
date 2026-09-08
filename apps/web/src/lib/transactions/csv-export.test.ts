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
} from "@nodvis/finance-domain";

import {
  escapeCsvField,
  generateTransactionsCsv,
  sanitizeCsvFormula,
} from "./csv-export";

describe("sanitizeCsvFormula (Spreadsheet Formula Injection Protection)", () => {
  it("prepends a single quote to strings starting with formula trigger characters", () => {
    expect(sanitizeCsvFormula("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
    expect(sanitizeCsvFormula("+48123456789")).toBe("'+48123456789");
    expect(sanitizeCsvFormula("-15% discount")).toBe("'-15% discount");
    expect(sanitizeCsvFormula("@malicious")).toBe("'@malicious");
    expect(sanitizeCsvFormula("\tDDE_LINK")).toBe("'\tDDE_LINK");
    expect(sanitizeCsvFormula("\rcommand")).toBe("'\rcommand");
    expect(sanitizeCsvFormula("|cmd")).toBe("'|cmd");
  });

  it("protects strings with leading whitespace before formula trigger characters", () => {
    expect(sanitizeCsvFormula("  =1+1")).toBe("'  =1+1");
    expect(sanitizeCsvFormula("   @sum()")).toBe("'   @sum()");
  });

  it("leaves benign text unchanged without adding single quotes", () => {
    expect(sanitizeCsvFormula("Grocery Store")).toBe("Grocery Store");
    expect(sanitizeCsvFormula("Salary September 2026")).toBe("Salary September 2026");
    expect(sanitizeCsvFormula("Biedronka")).toBe("Biedronka");
    expect(sanitizeCsvFormula("")).toBe("");
    expect(sanitizeCsvFormula(null)).toBe("");
    expect(sanitizeCsvFormula(undefined)).toBe("");
  });
});

describe("escapeCsvField (RFC 4180 CSV Escaping)", () => {
  it("escapes fields containing commas, double quotes, and newlines", () => {
    expect(escapeCsvField("Apple, Inc.")).toBe('"Apple, Inc."');
    expect(escapeCsvField('Kawiarnia "Pod Baranem"')).toBe(
      '"Kawiarnia ""Pod Baranem"""',
    );
    expect(escapeCsvField("First line\nSecond line")).toBe(
      '"First line\nSecond line"',
    );
  });

  it("quotes fields starting with a single quote (formula protected)", () => {
    expect(escapeCsvField("'=SUM(1,2)")).toBe('"\'=SUM(1,2)"');
  });

  it("leaves simple alphanumeric fields unquoted", () => {
    expect(escapeCsvField("PLN")).toBe("PLN");
    expect(escapeCsvField("123.45")).toBe("123.45");
    expect(escapeCsvField(42)).toBe("42");
    expect(escapeCsvField("Expense")).toBe("Expense");
  });

  it("handles null and undefined values as empty string", () => {
    expect(escapeCsvField(null)).toBe("");
    expect(escapeCsvField(undefined)).toBe("");
  });
});

describe("generateTransactionsCsv", () => {
  const hId = householdUuid();
  const pId = personId("018f47a0-7762-7b9c-8d17-27f2f79e59a2");
  const accCheckingId = "018f47a0-7762-7b9c-8d17-27f2f79e59a3";
  const accSavingsId = "018f47a0-7762-7b9c-8d17-27f2f79e59a4";
  const catGroceriesId = "018f47a0-7762-7b9c-8d17-27f2f79e59a5";

  const accountsMap = new Map([
    [accCheckingId, { id: accCheckingId, name: "Main Checking" }],
    [accSavingsId, { id: accSavingsId, name: "Savings Wallet" }],
  ]);

  const categoriesMap = new Map([
    [catGroceriesId, { id: catGroceriesId, name: "Groceries & Food" }],
  ]);

  function householdUuid() {
    return householdId("018f47a0-7762-7b9c-8d17-27f2f79e59a1");
  }

  it("produces empty export with header and UTF-8 BOM when no transactions are present", () => {
    const csvEn = generateTransactionsCsv({
      transactions: [],
      accounts: accountsMap,
      categories: categoriesMap,
      locale: "en",
    });

    expect(csvEn.startsWith("\uFEFF")).toBe(true);
    expect(csvEn).toBe(
      "\uFEFFDate,Type,Amount,Currency,Account,Category,Description,Status,Void Reason\r\n",
    );

    const csvPl = generateTransactionsCsv({
      transactions: [],
      accounts: accountsMap,
      categories: categoriesMap,
      locale: "pl",
    });

    expect(csvPl.startsWith("\uFEFF")).toBe(true);
    expect(csvPl).toBe(
      "\uFEFFData,Typ,Kwota,Waluta,Konto,Kategoria,Opis,Status,Powód anulowania\r\n",
    );
  });

  it("formats exact decimal monetary text without IEEE-754 floating-point loss for large amounts", () => {
    // 9,999,999,999,999,999.99 PLN (far exceeding 2^53 - 1)
    const hugeAmountMinor = 999_999_999_999_999_999n;
    const tx = createExpense({
      id: transactionId("018f47a0-7762-7b9c-8d17-27f2f79e59a6"),
      householdId: hId,
      accountId: accountId(accCheckingId),
      amount: money(hugeAmountMinor, "PLN"),
      payee: "Global Treasury",
      paidByPersonId: pId,
      occurredOn: new Date("2026-09-08T12:00:00.000Z"),
    });

    const csv = generateTransactionsCsv({
      transactions: [tx],
      accounts: accountsMap,
      categories: categoriesMap,
      locale: "en",
    });

    expect(csv).toContain("9999999999999999.99");
    expect(csv).not.toContain("1e+");
    expect(csv).not.toContain("NaN");
  });

  it("exports explicit descriptions for expense, income, and transfer in EN", () => {
    const expenseTx = createExpense({
      id: transactionId("018f47a0-7762-7b9c-8d17-27f2f79e59a6"),
      householdId: hId,
      accountId: accountId(accCheckingId),
      amount: money(15420n, "PLN"),
      payee: "Biedronka Supermarket",
      paidByPersonId: pId,
      occurredOn: new Date("2026-09-08T10:00:00.000Z"),
      categoryId: categoryId(catGroceriesId),
    });

    const incomeTx = createIncome({
      id: transactionId("018f47a0-7762-7b9c-8d17-27f2f79e59a7"),
      householdId: hId,
      accountId: accountId(accCheckingId),
      amount: money(500000n, "PLN"),
      source: "Acme Corp Salary",
      receivedByPersonId: pId,
      occurredOn: new Date("2026-09-08T11:00:00.000Z"),
      categoryId: null, // uncategorized
    });

    const transferTx = createTransfer({
      id: transactionId("018f47a0-7762-7b9c-8d17-27f2f79e59a8"),
      householdId: hId,
      fromAccountId: accountId(accCheckingId),
      toAccountId: accountId(accSavingsId),
      amount: money(100000n, "PLN"),
      occurredOn: new Date("2026-09-08T12:00:00.000Z"),
    });

    const voidedExpense = createExpense({
      id: transactionId("018f47a0-7762-7b9c-8d17-27f2f79e59a9"),
      householdId: hId,
      accountId: accountId(accCheckingId),
      amount: money(2500n, "PLN"),
      payee: "Wrong Charge Store",
      paidByPersonId: pId,
      occurredOn: new Date("2026-09-08T13:00:00.000Z"),
      voidedAt: new Date("2026-09-08T14:00:00.000Z"),
      voidReason: "Accidental double tap",
    });

    const csv = generateTransactionsCsv({
      transactions: [expenseTx, incomeTx, transferTx, voidedExpense],
      accounts: accountsMap,
      categories: categoriesMap,
      locale: "en",
    });

    const lines = csv.replace("\uFEFF", "").trim().split("\r\n");
    expect(lines).toHaveLength(5); // Header + 4 transactions

    // Line 1: Expense
    expect(lines[1]).toBe(
      "2026-09-08,Expense,154.20,PLN,Main Checking,Groceries & Food,Biedronka Supermarket,Active,",
    );

    // Line 2: Income with Uncategorized
    expect(lines[2]).toBe(
      "2026-09-08,Income,5000.00,PLN,Main Checking,Uncategorized,Acme Corp Salary,Active,",
    );

    // Line 3: Transfer with From -> To description
    expect(lines[3]).toBe(
      "2026-09-08,Transfer,1000.00,PLN,Main Checking -> Savings Wallet,,,Active,",
    );

    // Line 4: Voided expense
    expect(lines[4]).toBe(
      "2026-09-08,Expense,25.00,PLN,Main Checking,Uncategorized,Wrong Charge Store,Voided,Accidental double tap",
    );
  });

  it("exports explicit descriptions in PL with Polish headers and terms", () => {
    const expenseTx = createExpense({
      id: transactionId("018f47a0-7762-7b9c-8d17-27f2f79e59a6"),
      householdId: hId,
      accountId: accountId(accCheckingId),
      amount: money(4500n, "PLN"),
      payee: "Apteka Słoneczna",
      paidByPersonId: pId,
      occurredOn: new Date("2026-09-08T10:00:00.000Z"),
      categoryId: null,
      voidedAt: new Date("2026-09-08T11:00:00.000Z"),
      voidReason: "Zwrot leku",
    });

    const csv = generateTransactionsCsv({
      transactions: [expenseTx],
      accounts: accountsMap,
      categories: categoriesMap,
      locale: "pl",
    });

    const lines = csv.replace("\uFEFF", "").trim().split("\r\n");
    expect(lines[0]).toBe(
      "Data,Typ,Kwota,Waluta,Konto,Kategoria,Opis,Status,Powód anulowania",
    );
    expect(lines[1]).toBe(
      "2026-09-08,Wydatek,45.00,PLN,Main Checking,Bez kategorii,Apteka Słoneczna,Anulowana,Zwrot leku",
    );
  });

  it("applies formula-injection protection to user-controlled counterparty names and void reasons", () => {
    const maliciousTx = createExpense({
      id: transactionId("018f47a0-7762-7b9c-8d17-27f2f79e59a6"),
      householdId: hId,
      accountId: accountId(accCheckingId),
      amount: money(9900n, "PLN"),
      payee: "=cmd|' /C calc'!A0",
      paidByPersonId: pId,
      occurredOn: new Date("2026-09-08T10:00:00.000Z"),
      voidedAt: new Date("2026-09-08T11:00:00.000Z"),
      voidReason: "@SUM(1+1)*cmd",
    });

    const csv = generateTransactionsCsv({
      transactions: [maliciousTx],
      accounts: accountsMap,
      categories: categoriesMap,
      locale: "en",
    });

    expect(csv).toContain('"\'=cmd|\' /C calc\'!A0"');
    expect(csv).toContain('"\'@SUM(1+1)*cmd"');
    // Ensure raw unquoted formula is NOT present at start of cell
    expect(csv).not.toContain(",=cmd|");
    expect(csv).not.toContain(",@SUM");
  });

  it("does not expose internal authentication details, user IDs, or submission IDs", () => {
    const tx = createExpense({
      id: transactionId("018f47a0-7762-7b9c-8d17-27f2f79e59a6"),
      householdId: hId,
      accountId: accountId(accCheckingId),
      amount: money(1200n, "PLN"),
      payee: "Coffee Shop",
      paidByPersonId: pId,
      occurredOn: new Date("2026-09-08T10:00:00.000Z"),
    });

    const csv = generateTransactionsCsv({
      transactions: [tx],
      accounts: accountsMap,
      categories: categoriesMap,
      locale: "en",
    });

    expect(csv).not.toContain(String(hId));
    expect(csv).not.toContain(String(pId));
    expect(csv).not.toContain("authUserId");
    expect(csv).not.toContain("password");
    expect(csv).not.toContain("submissionId");
  });
});
