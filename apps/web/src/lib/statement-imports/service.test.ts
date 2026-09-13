import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
import {
  inspectCsvFile,
  parseAndPreviewStatementImport,
  commitStatementImport,
  createImportProfile,
  listImportProfiles,
  getImportProfile,
  updateImportProfile,
  deleteImportProfile,
  FileTooLargeError,
  EmptyCsvError,
  ImportBatchAlreadyCommittedError,
  ImportMappingValidationError,
  formatImportAmount,
} from "./service";
import * as dbModule from "@nodvis/finance-db";
import { TransactionAccountNotFoundError } from "@/lib/transactions/service";
import type { AuthorizedHouseholdContext } from "@/lib/transactions/service";
import { encodeImportIdentityParts } from "@nodvis/finance-domain";

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
    createStatementImportProfileInDb: vi.fn(),
    findStatementImportProfileById: vi.fn(),
    listStatementImportProfilesByHousehold: vi.fn(),
    updateStatementImportProfileInDb: vi.fn(),
    deleteStatementImportProfileInDb: vi.fn(),
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
    vi.mocked(dbModule.findPossibleManualMatchesInDb).mockResolvedValue(
      new Map(),
    );
  });

  it.each([
    ["en-US", "-PLN 0.12"],
    ["pl-PL", "-0,12 zł"],
  ])("formats negative sub-unit amounts structurally for %s", (locale, expected) => {
    expect(formatImportAmount(-12n, "PLN", locale)).toBe(expected);
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
      existingAuthMap.set(encodeImportIdentityParts(["revolut", "rev-123", "TX-EXISTING-1"]), {
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

    it("falls back to a legacy unscoped authoritative record for a newly mapped source account", async () => {
      vi.mocked(dbModule.findAccountInHousehold).mockResolvedValue({ id: "acc-1", householdId: "h-1", name: "Main Checking", type: "checking", currency: "PLN" } as any);
      const existingAuthMap = new Map();
      existingAuthMap.set(encodeImportIdentityParts(["", "", "TX-LEGACY"]), {
        authoritativeId: "TX-LEGACY",
        transaction: { id: "tx-legacy", voidedAt: null, payee: "Legacy Shop", source: null, amountMinor: 5000n, currency: "PLN", version: 1 },
      });
      vi.mocked(dbModule.findExistingAuthoritativeRecordsInDb).mockResolvedValue(existingAuthMap);
      vi.mocked(dbModule.findExistingImportDedupeHashes).mockResolvedValue(new Set());
      vi.mocked(dbModule.findPossibleManualMatchesInDb).mockResolvedValue(new Map());
      vi.mocked(dbModule.createStatementImportBatchInDb).mockResolvedValue({ batchId: "batch-legacy" });

      const preview = await parseAndPreviewStatementImport({
        context: mockContext,
        accountId: "acc-1",
        sourceFilename: "legacy.csv",
        fileBytes: new TextEncoder().encode("Date,Amount,Description,AuthId\n2026-03-01,-50.00,Legacy Shop,TX-LEGACY"),
        mapping: {
          dateColumn: "Date", dateFormat: "YYYY-MM-DD", timezone: "UTC", amountMode: "signed", amountColumn: "Amount",
          currencyMode: "account", descriptionColumn: "Description", authoritativeIdColumn: "AuthId", sourceNamespace: "revolut", sourceAccountId: "rev-new",
          delimiter: ",", hasHeader: true, headerRowIndex: 0, skipLeadingRows: 0,
        },
      });

      expect(preview.rows[0]).toMatchObject({ status: "pending", ambiguityState: "ambiguous", errorCode: "AMBIGUOUS_AUTHORITATIVE_MATCH", selected: false });
    });

    it("treats an empty mapped source account as the legacy null authoritative scope", async () => {
      vi.mocked(dbModule.findAccountInHousehold).mockResolvedValue({ id: "acc-1", householdId: "h-1", name: "Main Checking", type: "checking", currency: "PLN" } as any);
      vi.mocked(dbModule.findExistingAuthoritativeRecordsInDb).mockResolvedValue(new Map([
        [encodeImportIdentityParts(["", "", "TX-EMPTY"]), {
          authoritativeId: "TX-EMPTY",
          transaction: { id: "tx-empty-legacy", voidedAt: null, payee: "Legacy", source: null, amountMinor: 5000n, currency: "PLN", version: 1 },
        }],
      ]));
      vi.mocked(dbModule.findExistingImportDedupeHashes).mockResolvedValue(new Set());
      vi.mocked(dbModule.findPossibleManualMatchesInDb).mockResolvedValue(new Map());
      vi.mocked(dbModule.createStatementImportBatchInDb).mockResolvedValue({ batchId: "batch-empty-legacy" });

      const preview = await parseAndPreviewStatementImport({
        context: mockContext,
        accountId: "acc-1",
        sourceFilename: "empty-legacy.csv",
        fileBytes: new TextEncoder().encode("Date,Amount,Description,AuthId\n2026-03-01,-50.00,Legacy,TX-EMPTY"),
        mapping: {
          dateColumn: "Date", dateFormat: "YYYY-MM-DD", timezone: "UTC", amountMode: "signed", amountColumn: "Amount",
          currencyMode: "account", descriptionColumn: "Description", authoritativeIdColumn: "AuthId", sourceNamespace: "revolut", sourceAccountId: "",
          delimiter: ",", hasHeader: true, headerRowIndex: 0, skipLeadingRows: 0,
        },
      });

      expect(preview.rows[0]).toMatchObject({ status: "pending", ambiguityState: "ambiguous", errorCode: "AMBIGUOUS_AUTHORITATIVE_MATCH", selected: false });
    });

    it("fails closed when scoped and legacy authoritative records collide", async () => {
      vi.mocked(dbModule.findAccountInHousehold).mockResolvedValue({ id: "acc-1", householdId: "h-1", name: "Main Checking", type: "checking", currency: "PLN" } as any);
      const existingAuthMap = new Map();
      existingAuthMap.set(encodeImportIdentityParts(["revolut", "rev-new", "TX-COLLISION"]), {
        authoritativeId: "TX-COLLISION",
        transaction: { id: "tx-scoped", voidedAt: null, payee: "Scoped", source: null, amountMinor: 5000n, currency: "PLN", version: 1 },
      });
      existingAuthMap.set(encodeImportIdentityParts(["", "", "TX-COLLISION"]), {
        authoritativeId: "TX-COLLISION",
        transaction: { id: "tx-legacy", voidedAt: null, payee: "Legacy", source: null, amountMinor: 5000n, currency: "PLN", version: 1 },
      });
      vi.mocked(dbModule.findExistingAuthoritativeRecordsInDb).mockResolvedValue(existingAuthMap);
      vi.mocked(dbModule.findExistingImportDedupeHashes).mockResolvedValue(new Set());
      vi.mocked(dbModule.findPossibleManualMatchesInDb).mockResolvedValue(new Map());
      vi.mocked(dbModule.createStatementImportBatchInDb).mockResolvedValue({ batchId: "batch-collision" });

      const preview = await parseAndPreviewStatementImport({
        context: mockContext,
        accountId: "acc-1",
        sourceFilename: "collision.csv",
        fileBytes: new TextEncoder().encode("Date,Amount,Description,AuthId\n2026-03-01,-50.00,Collision,TX-COLLISION"),
        mapping: {
          dateColumn: "Date", dateFormat: "YYYY-MM-DD", timezone: "UTC", amountMode: "signed", amountColumn: "Amount",
          currencyMode: "account", descriptionColumn: "Description", authoritativeIdColumn: "AuthId", sourceNamespace: "revolut", sourceAccountId: "rev-new",
          delimiter: ",", hasHeader: true, headerRowIndex: 0, skipLeadingRows: 0,
        },
      });

      expect(preview.rows[0]).toMatchObject({
        status: "pending",
        valid: true,
        ambiguityState: "ambiguous",
        errorCode: "AMBIGUOUS_AUTHORITATIVE_MATCH",
        selected: false,
        canonicalTransactionId: null,
      });
      expect(preview.safeToCommitCount).toBe(0);
    });

    it("uses fallback date values when primary date samples are empty", async () => {
      vi.mocked(dbModule.findAccountInHousehold).mockResolvedValue({ id: "acc-1", householdId: "h-1", name: "Main Checking", type: "checking", currency: "PLN" } as any);
      vi.mocked(dbModule.findExistingImportDedupeHashes).mockResolvedValue(new Set());
      vi.mocked(dbModule.findPossibleManualMatchesInDb).mockResolvedValue(new Map());
      vi.mocked(dbModule.createStatementImportBatchInDb).mockResolvedValue({ batchId: "batch-fallback-date" });

      const preview = await parseAndPreviewStatementImport({
        context: mockContext,
        accountId: "acc-1",
        sourceFilename: "fallback-date.csv",
        fileBytes: new TextEncoder().encode("Booked,Value Date,Amount,Description\n,2026-03-01,-10.00,Coffee"),
        mapping: {
          dateColumn: "Booked", dateFallbackColumn: "Value Date", dateFormat: "YYYY-MM-DD", timezone: "UTC", amountMode: "signed", amountColumn: "Amount",
          currencyMode: "account", descriptionColumn: "Description", delimiter: ",", hasHeader: true, headerRowIndex: 0, skipLeadingRows: 0,
        },
      });

      expect(preview.rows[0]).toMatchObject({ valid: true, status: "pending", date: "2026-03-01T00:00:00.000Z", selected: true });
    });

    it("fails closed when a fallback row matches both scoped and legacy records", async () => {
      vi.mocked(dbModule.findAccountInHousehold).mockResolvedValue({ id: "acc-1", householdId: "h-1", name: "Main Checking", type: "checking", currency: "PLN" } as any);
      vi.mocked(dbModule.findExistingFallbackRecordsInDb).mockImplementation(async (params) => {
        const fallbackIdentifier = params.fallbackIdentifiers[0]!;
        const record = (importRowId: string, sourceAccountId: string | null, sourceNamespace: string | null = "revolut") => ({
          importRowId,
          batchId: "batch-prev",
          fallbackIdentifier,
          sourceNamespace,
          sourceAccountId,
          occurrenceIndex: 0,
          canonicalTransactionId: `tx-${importRowId}`,
          voidedAt: null,
        });
        return new Map([
          [encodeImportIdentityParts(["revolut", "rev-new", fallbackIdentifier]), [record("scoped", "rev-new")]],
          [encodeImportIdentityParts(["", "", fallbackIdentifier]), [record("legacy", null, null)]],
        ]);
      });
      vi.mocked(dbModule.findExistingImportDedupeHashes).mockResolvedValue(new Set());
      vi.mocked(dbModule.createStatementImportBatchInDb).mockResolvedValue({ batchId: "batch-fallback-collision" });

      const preview = await parseAndPreviewStatementImport({
        context: mockContext,
        accountId: "acc-1",
        sourceFilename: "fallback-collision.csv",
        fileBytes: new TextEncoder().encode("Date,Amount,Description\n2026-03-01,-50.00,Collision"),
        mapping: {
          dateColumn: "Date", dateFormat: "YYYY-MM-DD", timezone: "UTC", amountMode: "signed", amountColumn: "Amount",
          currencyMode: "account", descriptionColumn: "Description", sourceNamespace: "revolut", sourceAccountId: "rev-new",
          delimiter: ",", hasHeader: true, headerRowIndex: 0, skipLeadingRows: 0,
        },
      });

      expect(preview.rows[0]).toMatchObject({
        status: "pending",
        valid: true,
        ambiguityState: "ambiguous",
        errorCode: "AMBIGUOUS_FALLBACK_MATCH",
        selected: false,
      });
      expect(preview.safeToCommitCount).toBe(0);
    });

    it("matches all blank legacy namespace/account representations without colliding with another scoped source", async () => {
      vi.mocked(dbModule.findAccountInHousehold).mockResolvedValue({
        id: "acc-1", householdId: "h-1", name: "Main Checking", type: "checking", currency: "PLN",
      } as any);
      vi.mocked(dbModule.findExistingImportDedupeHashes).mockResolvedValue(new Set());
      vi.mocked(dbModule.findPossibleManualMatchesInDb).mockResolvedValue(new Map());
      vi.mocked(dbModule.createStatementImportBatchInDb).mockResolvedValue({ batchId: "batch-legacy-scope" });
      vi.mocked(dbModule.findExistingFallbackRecordsInDb).mockImplementation(async (params) => {
        const records = params.fallbackIdentifiers.slice(0, 3).map((fallbackIdentifier, index) => ({
          importRowId: `legacy-${index}`,
          batchId: "batch-prev",
          fallbackIdentifier,
          sourceNamespace: [null, "", "  "][index]!,
          sourceAccountId: [null, "", "  "][index]!,
          occurrenceIndex: 0,
          canonicalTransactionId: `tx-legacy-${index}`,
          voidedAt: null,
        }));
        const result = new Map<string, typeof records>();
        for (const record of records) {
          result.set(encodeImportIdentityParts(["", "", record.fallbackIdentifier]), [record]);
        }
        const scopedIdentifier = params.fallbackIdentifiers[3];
        if (scopedIdentifier) {
          result.set(encodeImportIdentityParts(["other-bank", "other-account", scopedIdentifier]), [{
            importRowId: "scoped-other-source",
            batchId: "batch-prev",
            fallbackIdentifier: scopedIdentifier,
            sourceNamespace: "other-bank",
            sourceAccountId: "other-account",
            occurrenceIndex: 0,
            canonicalTransactionId: "tx-scoped-other-source",
            voidedAt: null,
          }]);
        }
        return result;
      });

      const preview = await parseAndPreviewStatementImport({
        context: mockContext,
        accountId: "acc-1",
        sourceFilename: "legacy-scope.csv",
        fileBytes: new TextEncoder().encode(
          "Date,Amount,Description\n" +
          "2026-03-01,-10.00,Legacy Null\n" +
          "2026-03-02,-11.00,Legacy Empty\n" +
          "2026-03-03,-12.00,Legacy Whitespace\n" +
          "2026-03-04,-13.00,Scoped Other Source",
        ),
        mapping: {
          dateColumn: "Date", dateFormat: "YYYY-MM-DD", timezone: "UTC",
          amountMode: "signed", amountColumn: "Amount", currencyMode: "account",
          descriptionColumn: "Description", sourceNamespace: "bank", sourceAccountId: "incoming-account",
          delimiter: ",", hasHeader: true, headerRowIndex: 0, skipLeadingRows: 0,
        },
      });

      expect(preview.rows.map((row) => row.status)).toEqual(["pending", "pending", "pending", "pending"]);
      expect(preview.rows.slice(0, 3).every((row) => row.errorCode === "AMBIGUOUS_FALLBACK_MATCH")).toBe(true);
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
            m.set(encodeImportIdentityParts(["generic_csv", "", _params.fallbackIdentifiers[0]]), [
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
            m.set(encodeImportIdentityParts(["generic_csv", "", _params.fallbackIdentifiers[0]]), [
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

    it("supports safeOnly commit option without requiring selectedRowIndices", async () => {
      vi.mocked(dbModule.findAccountInHousehold).mockResolvedValue({
        id: "acc-1",
        householdId: "h-1",
        name: "Main",
        type: "checking",
        currency: "PLN",
      } as any);

      vi.mocked(dbModule.commitStatementImportBatchInDb).mockResolvedValue({
        batchId: "batch-123",
        importedCount: 5,
        skippedCount: 2,
        committedTransactionIds: ["tx-1", "tx-2", "tx-3", "tx-4", "tx-5"],
      });

      const res = await commitStatementImport({
        context: mockContext,
        accountId: "acc-1",
        batchId: "batch-123",
        safeOnly: true,
      });

      expect(res.importedCount).toBe(5);
      expect(dbModule.commitStatementImportBatchInDb).toHaveBeenCalledWith(
        expect.objectContaining({
          safeOnly: true,
          batchId: "batch-123",
        }),
      );
    });
  });

  describe("parseAndPreviewStatementImport with autoCommitSafe", () => {
    it("auto-commits safe rows when autoCommitSafe is true and safe rows exist", async () => {
      vi.mocked(dbModule.findAccountInHousehold).mockResolvedValue({
        id: "acc-1",
        householdId: "h-1",
        name: "Main Account",
        type: "checking",
        currency: "PLN",
      } as any);

      vi.mocked(dbModule.createStatementImportBatchInDb).mockResolvedValue({
        batchId: "batch-auto-1",
      });

      vi.mocked(dbModule.findExistingImportDedupeHashes).mockResolvedValue(
        new Set(),
      );
      vi.mocked(dbModule.findPossibleManualMatchesInDb).mockResolvedValue(
        new Map(),
      );

      vi.mocked(dbModule.commitStatementImportBatchInDb).mockResolvedValue({
        batchId: "batch-auto-1",
        importedCount: 1,
        skippedCount: 0,
        committedTransactionIds: ["tx-auto-1"],
      });

      const csv = new TextEncoder().encode("Data,Kwota,Opis\n2026-03-01,-100.00,Store");
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
        autoCommitSafe: true,
      });

      expect(preview.safeToCommitCount).toBe(1);
      expect(preview.autoCommitted).toBeDefined();
      expect(preview.autoCommitted?.importedCount).toBe(1);
      expect(dbModule.commitStatementImportBatchInDb).toHaveBeenCalledWith(
        expect.objectContaining({
          batchId: "batch-auto-1",
          safeOnly: true,
        }),
      );
    });
  });

  describe("mapping profiles operations", () => {
    const sampleMapping = {
      dateColumn: "Data",
      dateFormat: "YYYY-MM-DD" as const,
      timezone: "UTC",
      amountMode: "signed" as const,
      amountColumn: "Kwota",
      invertAmount: false,
      currencyMode: "account" as const,
      descriptionColumn: "Opis",
      delimiter: ";" as const,
      hasHeader: true,
      headerRowIndex: 0,
      skipLeadingRows: 0,
    };

    it("creates a mapping profile scoped to account", async () => {
      vi.mocked(dbModule.findAccountInHousehold).mockResolvedValue({
        id: "acc-1",
        householdId: "h-1",
        name: "Main",
        type: "checking",
        currency: "PLN",
      } as any);

      vi.mocked(dbModule.createStatementImportProfileInDb).mockResolvedValue({
        id: "prof-1",
        householdId: "h-1",
        accountId: "acc-1",
        name: "mBank Profile",
        mappingConfig: sampleMapping,
        autoProcessSafe: true,
        isDefault: true,
        createdAt: new Date("2026-03-01T12:00:00Z"),
        updatedAt: new Date("2026-03-01T12:00:00Z"),
      });

      const res = await createImportProfile({
        context: mockContext,
        name: "mBank Profile",
        mappingConfig: sampleMapping,
        autoProcessSafe: true,
        isDefault: true,
        accountId: "acc-1",
      });

      expect(res.id).toBe("prof-1");
      expect(res.name).toBe("mBank Profile");
      expect(res.autoProcessSafe).toBe(true);
      expect(res.isDefault).toBe(true);
      expect(res.accountId).toBe("acc-1");
    });

    it("lists profiles for account", async () => {
      vi.mocked(dbModule.findAccountInHousehold).mockResolvedValue({
        id: "acc-1",
        householdId: "h-1",
        name: "Main",
        type: "checking",
        currency: "PLN",
      } as any);

      vi.mocked(dbModule.listStatementImportProfilesByHousehold).mockResolvedValue([
        {
          id: "prof-1",
          householdId: "h-1",
          accountId: "acc-1",
          name: "mBank",
          mappingConfig: sampleMapping,
          autoProcessSafe: true,
          isDefault: true,
          createdAt: new Date("2026-03-01T12:00:00Z"),
          updatedAt: new Date("2026-03-01T12:00:00Z"),
        },
      ]);

      const res = await listImportProfiles({
        context: mockContext,
        accountId: "acc-1",
      });

      expect(res).toHaveLength(1);
      expect(res[0]?.name).toBe("mBank");
    });

    it("updates an existing profile", async () => {
      vi.mocked(dbModule.updateStatementImportProfileInDb).mockResolvedValue({
        id: "prof-1",
        householdId: "h-1",
        accountId: "acc-1",
        name: "mBank Updated",
        mappingConfig: sampleMapping,
        autoProcessSafe: false,
        isDefault: false,
        createdAt: new Date("2026-03-01T12:00:00Z"),
        updatedAt: new Date("2026-03-01T12:30:00Z"),
      });

      const res = await updateImportProfile({
        context: mockContext,
        profileId: "prof-1",
        name: "mBank Updated",
        autoProcessSafe: false,
      });

      expect(res.name).toBe("mBank Updated");
      expect(res.autoProcessSafe).toBe(false);
    });

    it("passes account route scope without converting a global profile", async () => {
      const scopeConflict = Object.assign(new Error(), { name: "StatementImportProfileScopeConflictError" });
      vi.mocked(dbModule.updateStatementImportProfileInDb).mockRejectedValue(scopeConflict);

      await expect(updateImportProfile({
        context: mockContext,
        profileId: "prof-global",
        routeAccountId: "acc-1",
        accountId: "acc-1",
        name: "Renamed",
      })).rejects.toBe(scopeConflict);

      expect(dbModule.updateStatementImportProfileInDb).toHaveBeenCalledWith(expect.objectContaining({
        profileId: "prof-global",
        routeAccountId: "acc-1",
        accountId: "acc-1",
      }));
    });

    it("deletes an account-scoped profile", async () => {
      vi.mocked(dbModule.deleteStatementImportProfileInDb).mockResolvedValue(true);

      const res = await deleteImportProfile({
        context: mockContext,
        profileId: "prof-1",
      });

      expect(res).toBe(true);
    });

    it("scopes duplicate authoritative IDs by source namespace and source account", async () => {
      vi.mocked(dbModule.findAccountInHousehold).mockResolvedValue({
        id: "acc-1", householdId: "h-1", name: "Main", type: "checking", currency: "PLN",
      } as any);
      vi.mocked(dbModule.findExistingImportDedupeHashes).mockResolvedValue(new Set());
      vi.mocked(dbModule.findPossibleManualMatchesInDb).mockResolvedValue(new Map());
      vi.mocked(dbModule.createStatementImportBatchInDb).mockResolvedValue({ batchId: "batch-scope" });

      const preview = await parseAndPreviewStatementImport({
        context: mockContext,
        accountId: "acc-1",
        sourceFilename: "scope.csv",
        fileBytes: new TextEncoder().encode(
          "Date,Amount,Description,AuthId,SourceAccount\n" +
          "2026-03-01,-10.00,One,TX-1,source-a\n" +
          "2026-03-02,-20.00,Two,TX-1,source-b",
        ),
        mapping: {
          dateColumn: "Date", dateFormat: "YYYY-MM-DD", timezone: "UTC",
          amountMode: "signed", amountColumn: "Amount", currencyMode: "account",
          descriptionColumn: "Description", authoritativeIdColumn: "AuthId",
          sourceNamespace: "bank", sourceAccountIdColumn: "SourceAccount", delimiter: ",",
          hasHeader: true, headerRowIndex: 0, skipLeadingRows: 0,
        },
      });

      expect(preview.rows.map((row) => row.status)).toEqual(["pending", "pending"]);
    });

    it("passes an explicit empty source-account scope for legacy rows", async () => {
      vi.mocked(dbModule.findAccountInHousehold).mockResolvedValue({
        id: "acc-1", householdId: "h-1", name: "Main", type: "checking", currency: "PLN",
      } as any);
      vi.mocked(dbModule.findExistingImportDedupeHashes).mockResolvedValue(new Set());
      vi.mocked(dbModule.findPossibleManualMatchesInDb).mockResolvedValue(new Map());
      vi.mocked(dbModule.createStatementImportBatchInDb).mockResolvedValue({ batchId: "batch-legacy" });

      await parseAndPreviewStatementImport({
        context: mockContext,
        accountId: "acc-1",
        sourceFilename: "legacy.csv",
        fileBytes: new TextEncoder().encode("Date,Amount,Description,Reference\n2026-03-01,-10.00,Legacy,LEGACY-1"),
        mapping: {
          dateColumn: "Date", dateFormat: "YYYY-MM-DD", timezone: "UTC",
          amountMode: "signed", amountColumn: "Amount", currencyMode: "account",
          descriptionColumn: "Description", authoritativeIdColumn: "Reference", delimiter: ",", hasHeader: true,
          headerRowIndex: 0, skipLeadingRows: 0,
        },
      });

      expect(dbModule.findExistingAuthoritativeRecordsInDb).toHaveBeenCalledWith(
        expect.objectContaining({ sourceAccountIds: [] }),
      );
      expect(dbModule.findExistingFallbackRecordsInDb).toHaveBeenCalledWith(
        expect.objectContaining({ sourceAccountIds: [] }),
      );
      expect(dbModule.findExistingImportDedupeHashes).toHaveBeenCalledWith(
        "acc-1", expect.any(Array), expect.objectContaining({ sourceAccountIds: [] }),
      );
    });
  });
});
