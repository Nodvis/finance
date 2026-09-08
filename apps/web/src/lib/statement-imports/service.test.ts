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
    findExistingAuthoritativeRecordsInDb: vi.fn(),
    findExistingFallbackRecordsInDb: vi.fn(),
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
    vi.mocked(dbModule.findExistingAuthoritativeRecordsInDb).mockResolvedValue(
      new Map(),
    );
    vi.mocked(dbModule.findExistingFallbackRecordsInDb).mockResolvedValue(
      new Map(),
    );
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

    it("correctly dedupes authoritative IDs and links canonical transactions and matched rows in preview", async () => {
      vi.mocked(dbModule.findAccountInHousehold).mockResolvedValue({
        id: "acc-1",
        householdId: "h-1",
        name: "Main Checking",
        type: "checking",
        currency: "PLN",
      } as any);

      const existingAuthMap = new Map();
      existingAuthMap.set("TX-EXISTING-1", {
        authoritativeId: "TX-EXISTING-1",
        transaction: {
          id: "tx-existing-uuid",
          voidedAt: null,
          payee: "Existing Shop",
          source: null,
          amountMinor: 5000n,
          currency: "PLN",
          version: 1,
        },
        importRow: {
          id: "row-existing-uuid",
          batchId: "batch-prev",
        },
      });

      vi.mocked(dbModule.findExistingAuthoritativeRecordsInDb).mockResolvedValue(
        existingAuthMap,
      );
      vi.mocked(dbModule.findExistingImportDedupeHashes).mockResolvedValue(new Set());
      vi.mocked(dbModule.createStatementImportBatchInDb).mockResolvedValue({
        batchId: "batch-auth-test",
      });

      const csv = new TextEncoder().encode(
        `Data,Kwota,Opis,AuthId\n` +
          `2026-03-01,-50.00,Existing Shop,TX-EXISTING-1\n` +
          `2026-03-02,-60.00,New Shop,TX-NEW-2\n` +
          `2026-03-03,-70.00,Duplicate New Shop,TX-NEW-2\n`,
      );

      const preview = await parseAndPreviewStatementImport({
        context: mockContext,
        accountId: "acc-1",
        sourceFilename: "auth-test.csv",
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
          authoritativeIdColumn: "AuthId",
          sourceNamespace: "revolut",
          sourceAccountId: "rev-123",
          delimiter: ",",
          hasHeader: true,
          headerRowIndex: 0,
          skipLeadingRows: 0,
        },
      });

      expect(preview.batchId).toBe("batch-auth-test");
      expect(preview.totalRowCount).toBe(3);

      // Row 0: matches existing authoritative record in DB
      expect(preview.rows[0]?.status).toBe("duplicate");
      expect(preview.rows[0]?.errorCode).toBe("AUTHORITATIVE_DUPLICATE");
      expect(preview.rows[0]?.canonicalTransactionId).toBe("tx-existing-uuid");
      expect(preview.rows[0]?.matchedImportRowId).toBe("row-existing-uuid");
      expect(preview.rows[0]?.selected).toBe(false);

      // Row 1: new authoritative record
      expect(preview.rows[1]?.status).toBe("pending");
      expect(preview.rows[1]?.authoritativeId).toBe("TX-NEW-2");
      expect(preview.rows[1]?.selected).toBe(true);

      // Row 2: duplicate authoritative ID within the same file
      expect(preview.rows[2]?.status).toBe("duplicate");
      expect(preview.rows[2]?.errorCode).toBe("DUPLICATE_AUTHORITATIVE_ID_IN_FILE");
      expect(preview.rows[2]?.selected).toBe(false);
    });

    it("marks fallback row as ambiguous when it matches a voided transaction in DB", async () => {
      vi.mocked(dbModule.findAccountInHousehold).mockResolvedValue({
        id: "acc-1",
        householdId: "h-1",
        name: "Main Checking",
        type: "checking",
        currency: "PLN",
      } as any);

      // Return a voided record for any fallback identifier
      vi.mocked(dbModule.findExistingFallbackRecordsInDb).mockImplementation(
        async (_params) => {
          const m = new Map();
          if (_params.fallbackIdentifiers[0]) {
            m.set(_params.fallbackIdentifiers[0], [
              {
                importRowId: "row-voided-uuid",
                batchId: "batch-prev",
                fallbackIdentifier: _params.fallbackIdentifiers[0],
                occurrenceIndex: 0,
                canonicalTransactionId: "tx-voided-uuid",
                voidedAt: new Date("2026-03-01T12:00:00.000Z"),
              },
            ]);
          }
          return m;
        },
      );

      vi.mocked(dbModule.findExistingImportDedupeHashes).mockResolvedValue(new Set());
      vi.mocked(dbModule.createStatementImportBatchInDb).mockResolvedValue({
        batchId: "batch-voided-test",
      });

      const csv = new TextEncoder().encode(
        `Data,Kwota,Opis\n` + `2026-03-01,-35.00,Voided Cafe Purchase\n`,
      );

      const preview = await parseAndPreviewStatementImport({
        context: mockContext,
        accountId: "acc-1",
        sourceFilename: "void-test.csv",
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

      expect(preview.rows[0]?.ambiguityState).toBe("ambiguous");
      expect(preview.rows[0]?.errorCode).toBe("MATCHES_VOIDED_TRANSACTION");
      expect(preview.rows[0]?.selected).toBe(false);
    });

    it("preserves multiple legitimate identical fallback purchases and dedupes only already-committed occurrences", async () => {
      vi.mocked(dbModule.findAccountInHousehold).mockResolvedValue({
        id: "acc-1",
        householdId: "h-1",
        name: "Main Checking",
        type: "checking",
        currency: "PLN",
      } as any);

      // 1 active occurrence in DB for this fallback identifier
      vi.mocked(dbModule.findExistingFallbackRecordsInDb).mockImplementation(
        async (_params) => {
          const m = new Map();
          if (_params.fallbackIdentifiers[0]) {
            m.set(_params.fallbackIdentifiers[0], [
              {
                importRowId: "row-occ0-uuid",
                batchId: "batch-prev",
                fallbackIdentifier: _params.fallbackIdentifiers[0],
                occurrenceIndex: 0,
                canonicalTransactionId: "tx-occ0-uuid",
                voidedAt: null,
              },
            ]);
          }
          return m;
        },
      );

      vi.mocked(dbModule.findExistingImportDedupeHashes).mockResolvedValue(new Set());
      vi.mocked(dbModule.createStatementImportBatchInDb).mockResolvedValue({
        batchId: "batch-multi-test",
      });

      // CSV contains TWO identical coffee purchases on same date
      const csv = new TextEncoder().encode(
        `Data,Kwota,Opis\n` +
          `2026-03-01,-15.00,Coffee\n` +
          `2026-03-01,-15.00,Coffee\n`,
      );

      const preview = await parseAndPreviewStatementImport({
        context: mockContext,
        accountId: "acc-1",
        sourceFilename: "multi-coffee.csv",
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

      expect(preview.rows.length).toBe(2);

      // Row 0 (occurrence 0): already committed in DB -> duplicate
      expect(preview.rows[0]?.status).toBe("duplicate");
      expect(preview.rows[0]?.errorCode).toBe("FALLBACK_DUPLICATE");
      expect(preview.rows[0]?.canonicalTransactionId).toBe("tx-occ0-uuid");
      expect(preview.rows[0]?.matchedImportRowId).toBe("row-occ0-uuid");
      expect(preview.rows[0]?.selected).toBe(false);

      // Row 1 (occurrence 1): new legitimate second purchase -> pending & selected!
      expect(preview.rows[1]?.status).toBe("pending");
      expect(preview.rows[1]?.occurrenceIndex).toBe(1);
      expect(preview.rows[1]?.selected).toBe(true);
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
