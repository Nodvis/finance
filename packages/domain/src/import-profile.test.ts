import { describe, expect, it } from "vitest";
import { statementImportProfileId } from "./identity";
import {
  isSafeToAutoCommitRow,
  validateStatementImportProfileInput,
} from "./import-profile";
import type { StatementImportMappingConfig } from "./import";

describe("Statement import profile domain validation", () => {
  const validMapping: StatementImportMappingConfig = {
    dateColumn: "Data operacji",
    dateFormat: "YYYY-MM-DD",
    timezone: "UTC",
    amountMode: "signed",
    amountColumn: "Kwota",
    invertAmount: false,
    currencyMode: "account",
    descriptionColumn: "Tytuł przelewu",
    delimiter: ";",
    hasHeader: true,
    headerRowIndex: 0,
    skipLeadingRows: 0,
  };

  it("validates a valid signed-amount profile", () => {
    const result = validateStatementImportProfileInput({
      name: "mBank CSV Profile",
      mappingConfig: validMapping,
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("validates a valid separate-debit-credit profile", () => {
    const separateMapping: StatementImportMappingConfig = {
      ...validMapping,
      amountMode: "separate",
      debitColumn: "Obciążenia",
      creditColumn: "Uznania",
    };
    const result = validateStatementImportProfileInput({
      name: "PKO BP Separate",
      mappingConfig: separateMapping,
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects empty or whitespace-only profile name", () => {
    const result = validateStatementImportProfileInput({
      name: "   ",
      mappingConfig: validMapping,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Profile name is required");
  });

  it("rejects profile name exceeding 160 characters", () => {
    const result = validateStatementImportProfileInput({
      name: "A".repeat(161),
      mappingConfig: validMapping,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Profile name cannot exceed 160 characters");
  });

  it("rejects mapping missing dateColumn or descriptionColumn", () => {
    const result = validateStatementImportProfileInput({
      name: "Bad Config",
      mappingConfig: {
        ...validMapping,
        dateColumn: "",
        descriptionColumn: "   ",
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Date column is required in mapping config");
    expect(result.errors).toContain(
      "Description column is required in mapping config",
    );
  });

  it("rejects signed mode without amountColumn", () => {
    const result = validateStatementImportProfileInput({
      name: "Missing Amount",
      mappingConfig: {
        ...validMapping,
        amountColumn: "",
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Amount column is required for signed amount mode");
  });

  it("rejects separate mode without both debit and credit columns", () => {
    const result = validateStatementImportProfileInput({
      name: "Missing Debit Credit",
      mappingConfig: {
        ...validMapping,
        amountMode: "separate",
        debitColumn: "",
        creditColumn: "",
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "At least one of debitColumn or creditColumn is required for separate amount mode",
    );
  });
});

describe("isSafeToAutoCommitRow policy", () => {
  const safeBaseRow = {
    valid: true,
    status: "pending",
    ambiguityState: "unambiguous",
    possibleMatch: null,
    errorCode: null,
    normalizedOccurredOn: new Date("2026-03-01T00:00:00Z"),
    normalizedAmountMinor: 15000n,
    normalizedCurrency: "PLN",
    normalizedKind: "expense",
  };

  it("permits strictly safe, unambiguous pending row with positive amount", () => {
    expect(isSafeToAutoCommitRow(safeBaseRow)).toBe(true);

    const safeIncome = {
      ...safeBaseRow,
      normalizedKind: "income",
      normalizedAmountMinor: 350000n,
    };
    expect(isSafeToAutoCommitRow(safeIncome)).toBe(true);
  });

  it("rejects invalid rows", () => {
    expect(isSafeToAutoCommitRow({ ...safeBaseRow, valid: false })).toBe(false);
  });

  it("rejects duplicate or already imported rows", () => {
    expect(isSafeToAutoCommitRow({ ...safeBaseRow, status: "duplicate" })).toBe(
      false,
    );
    expect(isSafeToAutoCommitRow({ ...safeBaseRow, status: "imported" })).toBe(
      false,
    );
    expect(isSafeToAutoCommitRow({ ...safeBaseRow, status: "skipped" })).toBe(
      false,
    );
    expect(isSafeToAutoCommitRow({ ...safeBaseRow, status: "error" })).toBe(
      false,
    );
  });

  it("rejects ambiguous rows", () => {
    expect(
      isSafeToAutoCommitRow({ ...safeBaseRow, ambiguityState: "ambiguous" }),
    ).toBe(false);
  });

  it("rejects rows matching voided transactions", () => {
    expect(
      isSafeToAutoCommitRow({
        ...safeBaseRow,
        ambiguityState: "ambiguous",
        errorCode: "MATCHES_VOIDED_TRANSACTION",
      }),
    ).toBe(false);
  });

  it("rejects rows with possible manual matches", () => {
    expect(
      isSafeToAutoCommitRow({
        ...safeBaseRow,
        possibleMatch: {
          transactionId: "tx-123",
          description: "Existing manual entry",
          occurredOn: "2026-03-01",
          amountMinor: "15000",
          currency: "PLN",
          kind: "expense",
        },
      }),
    ).toBe(false);
  });

  it("rejects zero or negative amounts", () => {
    expect(
      isSafeToAutoCommitRow({ ...safeBaseRow, normalizedAmountMinor: 0n }),
    ).toBe(false);
    expect(
      isSafeToAutoCommitRow({ ...safeBaseRow, normalizedAmountMinor: -500n }),
    ).toBe(false);
  });

  it("rejects rows missing required fields", () => {
    expect(
      isSafeToAutoCommitRow({ ...safeBaseRow, normalizedOccurredOn: null }),
    ).toBe(false);
    expect(
      isSafeToAutoCommitRow({ ...safeBaseRow, normalizedCurrency: "" }),
    ).toBe(false);
    expect(
      isSafeToAutoCommitRow({ ...safeBaseRow, normalizedKind: "transfer" }),
    ).toBe(false);
  });
});

describe("statementImportProfileId branding", () => {
  it("brands valid UUID", () => {
    const id = statementImportProfileId("019572c8-8257-7a2e-9d2a-c6ff0f64c677");
    expect(id).toBe("019572c8-8257-7a2e-9d2a-c6ff0f64c677");
  });

  it("rejects invalid UUID", () => {
    expect(() => statementImportProfileId("not-a-uuid")).toThrow(
      "Invalid statement import profile id: not-a-uuid",
    );
  });
});
