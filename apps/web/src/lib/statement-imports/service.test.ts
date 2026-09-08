import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
import {
  inspectCsvFile,
  parseAndPreviewStatementImport,
  commitStatementImport,
  FileTooLargeError,
  EmptyCsvError,
  ImportBatchAlreadyCommittedError,
} from "./service";
import * as dbModule from "@nodvis/finance-db";
import { TransactionAccountNotFoundError } from "@/lib/transactions/service";
import type { AuthorizedHouseholdContext } from "@/lib/transactions/service";

vi.mock("@nodvis/finance-db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@nodvis/finance-db")>();
  return {
    ...actual,
    findAccountInHousehold: vi.fn(),
    findExistingImportDedupeHashes: vi.fn(),
    findPossibleManualMatchesInDb: vi.fn(),
    createStatementImportBatchInDb: vi.fn(),
    commitStatementImportBatchInDb: vi.fn(),
    findStatementImportBatchById: vi.fn(),
    listStatementImportRowsByBatch: vi.fn(),
    listStatementImportBatchesByAccount: vi.fn(),
  };
});

describe("statement-imports service", () => {
  const mockContext: AuthorizedHouseholdContext = {
    householdId: "h-1" as any,
    authUserId: "user-1",
    personId: "p-1" as any,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("inspectCsvFile", () => {
    it("rejects empty files", async () => {
      await expect(
        inspectCsvFile({
          householdId: "h-1",
          accountId: "acc-1",
          fileBytes: new Uint8Array(),
        }),
      ).rejects.toThrow(EmptyCsvError);
    });

    it("rejects file exceeding 5MB limit", async () => {
      const hugeBytes = new Uint8Array(6 * 1024 * 1024);
      await expect(
        inspectCsvFile({
          householdId: "h-1",
          accountId: "acc-1",
          fileBytes: hugeBytes,
        }),
      ).rejects.toThrow(FileTooLargeError);
    });

    it("rejects if account not found in household", async () => {
      vi.mocked(dbModule.findAccountInHousehold).mockResolvedValue(null);
      const csv = new TextEncoder().encode("Date,Amount,Desc\n2026-03-01,-10,Coffee");

      await expect(
        inspectCsvFile({
          householdId: "h-1",
          accountId: "acc-unknown",
          fileBytes: csv,
        }),
      ).rejects.toThrow(TransactionAccountNotFoundError);
    });

    it("inspects valid CSV and detects headers, delimiter and sample rows", async () => {
      vi.mocked(dbModule.findAccountInHousehold).mockResolvedValue({
        id: "acc-1",
        householdId: "h-1",
        name: "Main Account",
        type: "checking",
        currency: "PLN",
      } as any);

      const csv = new TextEncoder().encode(
        "Data;Kwota;Tytuł\n2026-03-01;-15,50;Kawa\n2026-03-02;1200,00;Przelew",
      );

      const res = await inspectCsvFile({
        householdId: "h-1",
        accountId: "acc-1",
        fileBytes: csv,
      });

      expect(res.headers).toEqual(["Data", "Kwota", "Tytuł"]);
      expect(res.detectedDelimiter).toBe(";");
      expect(res.sampleRows.length).toBe(2);
      expect(res.totalRowCount).toBe(2);
      expect(res.fileHash).toBeDefined();
    });
  });

  describe("parseAndPreviewStatementImport", () => {
    it("generates preview with valid, invalid, duplicate, and exact large amount rows", async () => {
      vi.mocked(dbModule.findAccountInHousehold).mockResolvedValue({
        id: "acc-1",
        householdId: "h-1",
        name: "Main Checking",
        type: "checking",
        currency: "PLN",
      } as any);

      // Dedupe hash mock: pretend row 1 was already imported
      vi.mocked(dbModule.findExistingImportDedupeHashes).mockImplementation(
        async (_accId, hashes) => {
          // Return set with second hash if present
          if (hashes.length >= 2) {
            return new Set([hashes[1]!]);
          }
          return new Set();
        },
      );

      vi.mocked(dbModule.findPossibleManualMatchesInDb).mockResolvedValue(
        new Map(),
      );

      vi.mocked(dbModule.createStatementImportBatchInDb).mockResolvedValue({
        batchId: "batch-123",
      });

      // CSV contains:
      // Row 0: Valid expense with exact large amount
      // Row 1: Valid income (will be flagged as duplicate by mock)
      // Row 2: Malformed row with invalid date
      // Row 3: Malformed row with invalid amount
      const csv = new TextEncoder().encode(
        `Data,Kwota,Opis\n` +
          `2026-03-01,-987654321.50,Large Expense\n` +
          `2026-03-02,500.00,Duplicate Salary\n` +
          `2026-02-30,-20.00,Invalid Date Row\n` +
          `2026-03-04,not-a-number,Invalid Amount Row\n`,
      );

      const preview = await parseAndPreviewStatementImport({
        context: mockContext,
        accountId: "acc-1",
        sourceFilename: "test.csv",
        fileBytes: csv,
        mapping: {
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
        },
      });

      expect(preview.batchId).toBe("batch-123");
      expect(preview.totalRowCount).toBe(4);
      expect(preview.rows.length).toBe(4);

      // Row 0: Valid large amount
      expect(preview.rows[0]?.valid).toBe(true);
      expect(preview.rows[0]?.kind).toBe("expense");
      expect(preview.rows[0]?.amountMinor).toBe("98765432150");
      expect(preview.rows[0]?.selected).toBe(true);

      // Row 1: Duplicate
      expect(preview.rows[1]?.status).toBe("duplicate");
      expect(preview.rows[1]?.valid).toBe(false);
      expect(preview.rows[1]?.selected).toBe(false);

      // Row 2: Invalid date
      expect(preview.rows[2]?.valid).toBe(false);
      expect(preview.rows[2]?.status).toBe("error");
      expect(preview.rows[2]?.errorCode).toBe("INVALID_DATE");
      expect(preview.rows[2]?.selected).toBe(false);

      // Row 3: Invalid amount
      expect(preview.rows[3]?.valid).toBe(false);
      expect(preview.rows[3]?.status).toBe("error");
      expect(preview.rows[3]?.errorCode).toBe("INVALID_AMOUNT");
      expect(preview.rows[3]?.selected).toBe(false);
    });
  });

  describe("commitStatementImport", () => {
    it("calls atomic commit in DB and returns result", async () => {
      vi.mocked(dbModule.findAccountInHousehold).mockResolvedValue({
        id: "acc-1",
        householdId: "h-1",
        name: "Main",
        type: "checking",
        currency: "PLN",
      } as any);

      vi.mocked(dbModule.commitStatementImportBatchInDb).mockResolvedValue({
        batchId: "batch-123",
        importedCount: 2,
        skippedCount: 1,
        committedTransactionIds: ["tx-1", "tx-2"],
      });

      const res = await commitStatementImport({
        context: mockContext,
        accountId: "acc-1",
        batchId: "batch-123",
        selectedRowIndices: [0, 1],
      });

      expect(res.importedCount).toBe(2);
      expect(res.skippedCount).toBe(1);
      expect(res.committedTransactionIds).toEqual(["tx-1", "tx-2"]);
    });

    it("rejects repeated confirmation when batch already committed", async () => {
      vi.mocked(dbModule.findAccountInHousehold).mockResolvedValue({
        id: "acc-1",
        householdId: "h-1",
        name: "Main",
        type: "checking",
        currency: "PLN",
      } as any);

      vi.mocked(dbModule.commitStatementImportBatchInDb).mockRejectedValue(
        new ImportBatchAlreadyCommittedError(),
      );

      await expect(
        commitStatementImport({
          context: mockContext,
          accountId: "acc-1",
          batchId: "batch-123",
          selectedRowIndices: [0],
        }),
      ).rejects.toThrow(ImportBatchAlreadyCommittedError);
    });
  });
});
