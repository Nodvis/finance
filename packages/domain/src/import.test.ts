import { describe, expect, it } from "vitest";
import {
  computeFallbackIdentifier,
  computeFileSha256,
  computeRowDedupeHash,
  decodeCsvBuffer,
  detectCsvDelimiter,
  detectCsvEncoding,
  normalizeImportRow,
  parseCsvText,
  parseImportAmount,
  parseImportDate,
  type StatementImportMappingConfig,
} from "./import";

describe("CSV parsing and delimiter detection", () => {
  it("parses standard RFC 4180 CSV with quotes, escaped quotes, and newlines inside quotes", () => {
    const csv = `date,amount,description\r\n2026-03-01,-15.50,"Cafe, ""Central"" Bar"\r\n2026-03-02,1200.00,"Line 1\nLine 2"\r\n`;
    const rows = parseCsvText(csv, { delimiter: "," });
    expect(rows).toEqual([
      ["date", "amount", "description"],
      ["2026-03-01", "-15.50", 'Cafe, "Central" Bar'],
      ["2026-03-02", "1200.00", "Line 1\nLine 2"],
    ]);
  });

  it("parses semicolon-delimited CSV", () => {
    const csv = `Data operacji;Kwota;Tytuł\n2026-03-01;-45,20;Biedronka\n2026-03-02;3500,00;Wynagrodzenie\n`;
    const rows = parseCsvText(csv, { delimiter: ";" });
    expect(rows).toEqual([
      ["Data operacji", "Kwota", "Tytuł"],
      ["2026-03-01", "-45,20", "Biedronka"],
      ["2026-03-02", "3500,00", "Wynagrodzenie"],
    ]);
  });

  it("parses tab-delimited and pipe-delimited CSV", () => {
    const tabCsv = "Date\tAmount\tDescription\n2026-01-01\t10.00\tCoffee";
    expect(parseCsvText(tabCsv, { delimiter: "\t" })).toEqual([
      ["Date", "Amount", "Description"],
      ["2026-01-01", "10.00", "Coffee"],
    ]);

    const pipeCsv = "Date|Amount|Description\n2026-01-01|10.00|Coffee";
    expect(parseCsvText(pipeCsv, { delimiter: "|" })).toEqual([
      ["Date", "Amount", "Description"],
      ["2026-01-01", "10.00", "Coffee"],
    ]);
  });

  it("detects semicolon delimiter in European bank CSV exports", () => {
    const sample = `Data operacji;Kwota;Waluta;Opis\n2026-03-01;-50,00;PLN;Lidl\n2026-03-02;-120,50;PLN;Orlen\n2026-03-03;1500,00;PLN;Przelew`;
    expect(detectCsvDelimiter(sample)).toBe(";");
  });

  it("detects comma delimiter in standard CSV exports", () => {
    const sample = `Date,Amount,Currency,Description\n2026-03-01,-50.00,USD,Store A\n2026-03-02,-120.50,USD,Store B\n`;
    expect(detectCsvDelimiter(sample)).toBe(",");
  });

  it("detects tab delimiter in TSV files", () => {
    const sample = `Date\tAmount\tDescription\n2026-03-01\t-50.00\tStore\n2026-03-02\t100.00\tIncome\n`;
    expect(detectCsvDelimiter(sample)).toBe("\t");
  });
});

describe("CSV encoding detection and decoding", () => {
  it("detects UTF-8 with BOM and strips BOM on decode", () => {
    const utf8Bom = new Uint8Array([
      0xef, 0xbb, 0xbf, 0x44, 0x61, 0x74, 0x61, 0x3b, 0x4b, 0x77, 0x6f, 0x74, 0x61,
    ]); // BOM + "Data;Kwota"
    expect(detectCsvEncoding(utf8Bom)).toBe("utf-8");
    const decoded = decodeCsvBuffer(utf8Bom);
    expect(decoded).toBe("Data;Kwota");
  });

  it("detects Windows-1250 encoding with Polish diacritics and decodes correctly", () => {
    // In Windows-1250:
    // "Zażółć gęślą jaźń"
    // Z = 0x5A, a = 0x61, ż = 0xBF, ó = 0xF3, ł = 0xB3, ć = 0xE6
    const win1250Bytes = new Uint8Array([
      0x5a, 0x61, 0xbf, 0xf3, 0xb3, 0xe6, 0x3b, 0x31, 0x30, 0x30, 0x2c, 0x30, 0x30,
    ]); // "Zażółć;100,00"
    expect(detectCsvEncoding(win1250Bytes)).toBe("windows-1250");
    const decoded = decodeCsvBuffer(win1250Bytes, "windows-1250");
    expect(decoded).toBe("Zażółć;100,00");
  });

  it("computes SHA-256 of file content", () => {
    const text = "test,csv,data\n";
    const hash = computeFileSha256(text);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("Exact BigInt minor unit amount parsing", () => {
  it("parses Polish decimal comma amounts with spaces or thousand dots", () => {
    const res1 = parseImportAmount("1 234,56", "PLN");
    expect(res1).toEqual({ success: true, amountMinor: 123456n, isNegative: false });

    const res2 = parseImportAmount("1.234,56", "PLN");
    expect(res2).toEqual({ success: true, amountMinor: 123456n, isNegative: false });

    const res3 = parseImportAmount("-45,20 zł", "PLN");
    expect(res3).toEqual({ success: true, amountMinor: 4520n, isNegative: true });
  });

  it("parses English decimal dot amounts with commas", () => {
    const res1 = parseImportAmount("1,234.56", "USD");
    expect(res1).toEqual({ success: true, amountMinor: 123456n, isNegative: false });

    const res2 = parseImportAmount("-78.90", "USD");
    expect(res2).toEqual({ success: true, amountMinor: 7890n, isNegative: true });
  });

  it("parses exact large amounts without precision loss", () => {
    const large = "987654321012.34";
    const res = parseImportAmount(large, "PLN");
    expect(res).toEqual({
      success: true,
      amountMinor: 98765432101234n,
      isNegative: false,
    });
  });

  it("respects currency fraction digits for 0-decimal currencies (JPY)", () => {
    const jpy = parseImportAmount("5000", "JPY");
    expect(jpy).toEqual({ success: true, amountMinor: 5000n, isNegative: false });

    const invalidJpy = parseImportAmount("5000.50", "JPY");
    expect(invalidJpy.success).toBe(false);
    expect(invalidJpy.error).toContain("does not support fractional units");
  });

  it("rejects zero amount and invalid amount formats", () => {
    expect(parseImportAmount("0,00", "PLN").success).toBe(false);
    expect(parseImportAmount("0.00", "PLN").success).toBe(false);
    expect(parseImportAmount("abc", "PLN").success).toBe(false);
    expect(parseImportAmount("12.34.56.78", "PLN").success).toBe(false);
  });
});

describe("Date parsing and timezone handling", () => {
  it("parses ISO YYYY-MM-DD format", () => {
    const res = parseImportDate("2026-03-15", "YYYY-MM-DD", "UTC");
    expect(res.success).toBe(true);
    expect(res.date?.toISOString()).toBe("2026-03-15T00:00:00.000Z");
  });

  it("parses Polish DD.MM.YYYY format", () => {
    const res = parseImportDate("15.03.2026", "DD.MM.YYYY", "UTC");
    expect(res.success).toBe(true);
    expect(res.date?.toISOString()).toBe("2026-03-15T00:00:00.000Z");
  });

  it("parses dates with timestamps", () => {
    const res = parseImportDate("2026-03-15 14:30:00", "auto", "UTC");
    expect(res.success).toBe(true);
    expect(res.date?.toISOString()).toBe("2026-03-15T14:30:00.000Z");
  });

  it("handles explicit Europe/Warsaw timezone conversion", () => {
    // 2026-03-15 00:00:00 in Warsaw (CET is UTC+1) corresponds to 2026-03-14 23:00:00 UTC
    const res = parseImportDate("2026-03-15", "YYYY-MM-DD", "Europe/Warsaw");
    expect(res.success).toBe(true);
    expect(res.date?.toISOString()).toBe("2026-03-14T23:00:00.000Z");
  });

  it("rejects invalid dates such as Feb 30 or month 13", () => {
    expect(parseImportDate("2026-02-30", "YYYY-MM-DD", "UTC").success).toBe(false);
    expect(parseImportDate("2026-13-01", "YYYY-MM-DD", "UTC").success).toBe(false);
    expect(parseImportDate("invalid-date", "auto", "UTC").success).toBe(false);
  });
});

describe("Row normalization and deduplication", () => {
  const baseMapping: StatementImportMappingConfig = {
    dateColumn: "Data",
    dateFormat: "YYYY-MM-DD",
    timezone: "UTC",
    amountMode: "signed",
    amountColumn: "Kwota",
    invertAmount: false,
    currencyMode: "account",
    descriptionColumn: "Opis",
    delimiter: ";",
    hasHeader: true,
    headerRowIndex: 0,
    skipLeadingRows: 0,
  };

  it("normalizes a valid signed expense row", () => {
    const counter = new Map<string, number>();
    const res = normalizeImportRow({
      rowIndex: 0,
      rawCells: ["2026-03-01", "-120,50", "Supermarket ABC"],
      headers: ["Data", "Kwota", "Opis"],
      mapping: baseMapping,
      targetAccountCurrency: "PLN",
      accountId: "acc-1",
      fileHash: "hash123",
      occurrenceCounter: counter,
    });

    expect(res.valid).toBe(true);
    expect(res.normalized).toBeDefined();
    expect(res.normalized?.kind).toBe("expense");
    expect(res.normalized?.amountMinor).toBe(12050n);
    expect(res.normalized?.currency).toBe("PLN");
    expect(res.normalized?.payee).toBe("Supermarket ABC");
    expect(res.normalized?.source).toBeNull();
    expect(res.normalized?.dedupeHash).toBeDefined();
  });

  it("normalizes a valid signed income row", () => {
    const counter = new Map<string, number>();
    const res = normalizeImportRow({
      rowIndex: 1,
      rawCells: ["2026-03-02", "4500,00", "Wynagrodzenie"],
      headers: ["Data", "Kwota", "Opis"],
      mapping: baseMapping,
      targetAccountCurrency: "PLN",
      accountId: "acc-1",
      fileHash: "hash123",
      occurrenceCounter: counter,
    });

    expect(res.valid).toBe(true);
    expect(res.normalized?.kind).toBe("income");
    expect(res.normalized?.amountMinor).toBe(450000n);
    expect(res.normalized?.source).toBe("Wynagrodzenie");
    expect(res.normalized?.payee).toBeNull();
  });

  it("normalizes separate debit and credit columns", () => {
    const separateMapping: StatementImportMappingConfig = {
      ...baseMapping,
      amountMode: "separate",
      debitColumn: "Wypłaty",
      creditColumn: "Wpłaty",
    };

    const counter = new Map<string, number>();
    const expenseRow = normalizeImportRow({
      rowIndex: 0,
      rawCells: ["2026-03-01", "75,00", "", "Książka"],
      headers: ["Data", "Wypłaty", "Wpłaty", "Opis"],
      mapping: separateMapping,
      targetAccountCurrency: "PLN",
      accountId: "acc-1",
      fileHash: "hash123",
      occurrenceCounter: counter,
    });
    expect(expenseRow.valid).toBe(true);
    expect(expenseRow.normalized?.kind).toBe("expense");
    expect(expenseRow.normalized?.amountMinor).toBe(7500n);

    const incomeRow = normalizeImportRow({
      rowIndex: 1,
      rawCells: ["2026-03-01", "", "200,00", "Zwrot"],
      headers: ["Data", "Wypłaty", "Wpłaty", "Opis"],
      mapping: separateMapping,
      targetAccountCurrency: "PLN",
      accountId: "acc-1",
      fileHash: "hash123",
      occurrenceCounter: counter,
    });
    expect(incomeRow.valid).toBe(true);
    expect(incomeRow.normalized?.kind).toBe("income");
    expect(incomeRow.normalized?.amountMinor).toBe(20000n);
  });

  it("generates deterministic dedupe hashes for identical rows", () => {
    const hash1 = computeRowDedupeHash({
      accountId: "acc-1",
      occurredOnDate: "2026-03-01",
      amountMinor: 5000n,
      currency: "PLN",
      kind: "expense",
      normalizedDescription: "Coffee",
      occurrenceIndex: 0,
    });

    const hash2 = computeRowDedupeHash({
      accountId: "acc-1",
      occurredOnDate: "2026-03-01",
      amountMinor: 5000n,
      currency: "PLN",
      kind: "expense",
      normalizedDescription: "Coffee",
      occurrenceIndex: 0,
    });

    expect(hash1).toBe(hash2);

    // Different occurrence index produces distinct hash
    const hashOccurrence2 = computeRowDedupeHash({
      accountId: "acc-1",
      occurredOnDate: "2026-03-01",
      amountMinor: 5000n,
      currency: "PLN",
      kind: "expense",
      normalizedDescription: "Coffee",
      occurrenceIndex: 1,
    });
    expect(hash1).not.toBe(hashOccurrence2);
  });

  it("rejects rows with currency mismatch", () => {
    const mappingWithCurCol: StatementImportMappingConfig = {
      ...baseMapping,
      currencyMode: "column",
      currencyColumn: "Waluta",
    };

    const counter = new Map<string, number>();
    const res = normalizeImportRow({
      rowIndex: 0,
      rawCells: ["2026-03-01", "-10.00", "EUR", "Foreign store"],
      headers: ["Data", "Kwota", "Waluta", "Opis"],
      mapping: mappingWithCurCol,
      targetAccountCurrency: "PLN",
      accountId: "acc-1",
      fileHash: "hash123",
      occurrenceCounter: counter,
    });

    expect(res.valid).toBe(false);
    expect(res.errorCode).toBe("CURRENCY_MISMATCH");
  });

  it("rejects malformed row missing date and amount", () => {
    const counter = new Map<string, number>();
    const resMissingDate = normalizeImportRow({
      rowIndex: 0,
      rawCells: ["", "-10.00", "Store"],
      headers: ["Data", "Kwota", "Opis"],
      mapping: baseMapping,
      targetAccountCurrency: "PLN",
      accountId: "acc-1",
      fileHash: "hash123",
      occurrenceCounter: counter,
    });
    expect(resMissingDate.valid).toBe(false);
    expect(resMissingDate.errorCode).toBe("MISSING_DATE");

    const resMissingAmount = normalizeImportRow({
      rowIndex: 1,
      rawCells: ["2026-03-01", "", "Store"],
      headers: ["Data", "Kwota", "Opis"],
      mapping: baseMapping,
      targetAccountCurrency: "PLN",
      accountId: "acc-1",
      fileHash: "hash123",
      occurrenceCounter: counter,
    });
    expect(resMissingAmount.valid).toBe(false);
    expect(resMissingAmount.errorCode).toBe("MISSING_AMOUNT");
  });
});

describe("Stable source identity and authoritative deduplication", () => {
  const baseMapping: StatementImportMappingConfig = {
    dateColumn: "Data",
    dateFormat: "YYYY-MM-DD",
    timezone: "UTC",
    amountMode: "signed",
    amountColumn: "Kwota",
    invertAmount: false,
    currencyMode: "account",
    descriptionColumn: "Opis",
    delimiter: ",",
    hasHeader: true,
    headerRowIndex: 0,
    skipLeadingRows: 0,
  };

  it("computes deterministic fallback identifier ignoring whitespace and case variations in description", () => {
    const id1 = computeFallbackIdentifier({
      occurredOnDate: "2026-03-01",
      amountMinor: 4999n,
      currency: "PLN",
      kind: "expense",
      normalizedDescription: "  Grocery   Store  ",
    });

    const id2 = computeFallbackIdentifier({
      occurredOnDate: "2026-03-01",
      amountMinor: 4999n,
      currency: "PLN",
      kind: "expense",
      normalizedDescription: "grocery store",
    });

    expect(id1).toBe(id2);

    // Different amount or date produces distinct identifier
    const idDiffAmount = computeFallbackIdentifier({
      occurredOnDate: "2026-03-01",
      amountMinor: 5000n,
      currency: "PLN",
      kind: "expense",
      normalizedDescription: "grocery store",
    });
    expect(id1).not.toBe(idDiffAmount);
  });

  it("computes authoritative dedupe hash scoped to account, namespace, sourceAccount, and authoritativeId", () => {
    const hashAcc1 = computeRowDedupeHash({
      accountId: "acc-1",
      sourceNamespace: "bank_a",
      sourceAccountId: "iban-1",
      authoritativeId: "TX-9988",
    });

    const hashAcc2 = computeRowDedupeHash({
      accountId: "acc-2",
      sourceNamespace: "bank_a",
      sourceAccountId: "iban-1",
      authoritativeId: "TX-9988",
    });

    // Same external reference in two different accounts produces distinct dedupe hashes
    expect(hashAcc1).not.toBe(hashAcc2);

    // Identical parameters produce identical hash
    const hashAcc1Repeat = computeRowDedupeHash({
      accountId: "acc-1",
      sourceNamespace: "bank_a",
      sourceAccountId: "iban-1",
      authoritativeId: "TX-9988",
    });
    expect(hashAcc1).toBe(hashAcc1Repeat);
  });

  it("extracts authoritative transaction ID and populates source namespace and source account", () => {
    const authMapping: StatementImportMappingConfig = {
      ...baseMapping,
      authoritativeIdColumn: "RefID",
      sourceNamespace: "revolut",
      sourceAccountId: "rev-acc-123",
    };

    const counter = new Map<string, number>();
    const res = normalizeImportRow({
      rowIndex: 0,
      rawCells: ["2026-03-01", "-55.00", "Cafe", "REV-TXN-001"],
      headers: ["Data", "Kwota", "Opis", "RefID"],
      mapping: authMapping,
      targetAccountCurrency: "PLN",
      accountId: "acc-1",
      fileHash: "filehash123",
      occurrenceCounter: counter,
    });

    expect(res.valid).toBe(true);
    expect(res.normalized?.identityType).toBe("authoritative");
    expect(res.normalized?.authoritativeId).toBe("REV-TXN-001");
    expect(res.normalized?.sourceNamespace).toBe("revolut");
    expect(res.normalized?.sourceAccountId).toBe("rev-acc-123");
    expect(res.normalized?.sourceRowIdentity).toBe("REV-TXN-001");
  });

  it("does not treat a source-row reference as an authoritative bank transaction ID", () => {
    const mapping: StatementImportMappingConfig = {
      ...baseMapping,
      sourceRowIdentityColumn: "RefID",
      sourceNamespace: "generic_csv",
    };

    const res = normalizeImportRow({
      rowIndex: 0,
      rawCells: ["2026-03-01", "-55.00", "Cafe", "ROW-001"],
      headers: ["Data", "Kwota", "Opis", "RefID"],
      mapping,
      targetAccountCurrency: "PLN",
      accountId: "acc-1",
      fileHash: "filehash123",
      occurrenceCounter: new Map<string, number>(),
    });

    expect(res.valid).toBe(true);
    expect(res.normalized?.identityType).toBe("fallback");
    expect(res.normalized?.authoritativeId).toBeNull();
    expect(res.normalized?.sourceRowIdentity).toBe("ROW-001");
  });

  it("preserves two identical legitimate purchases in the same file without collapsing them", () => {
    const counter = new Map<string, number>();

    // First purchase of 15.00 PLN coffee
    const row1 = normalizeImportRow({
      rowIndex: 0,
      rawCells: ["2026-03-01", "-15.00", "Corner Coffee"],
      headers: ["Data", "Kwota", "Opis"],
      mapping: baseMapping,
      targetAccountCurrency: "PLN",
      accountId: "acc-1",
      fileHash: "filehash123",
      occurrenceCounter: counter,
    });

    // Second legitimate purchase of 15.00 PLN coffee on same day
    const row2 = normalizeImportRow({
      rowIndex: 1,
      rawCells: ["2026-03-01", "-15.00", "Corner Coffee"],
      headers: ["Data", "Kwota", "Opis"],
      mapping: baseMapping,
      targetAccountCurrency: "PLN",
      accountId: "acc-1",
      fileHash: "filehash123",
      occurrenceCounter: counter,
    });

    expect(row1.valid).toBe(true);
    expect(row2.valid).toBe(true);
    expect(row1.normalized?.identityType).toBe("fallback");
    expect(row2.normalized?.identityType).toBe("fallback");

    // Same fallbackIdentifier
    expect(row1.normalized?.fallbackIdentifier).toBe(row2.normalized?.fallbackIdentifier);

    // Sequential occurrence indices: 0 and 1
    expect(row1.normalized?.occurrenceIndex).toBe(0);
    expect(row2.normalized?.occurrenceIndex).toBe(1);

    // Distinct dedupe hashes: no collapse!
    expect(row1.normalized?.dedupeHash).not.toBe(row2.normalized?.dedupeHash);
  });
});
