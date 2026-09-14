import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/session", () => ({
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {
    constructor() {
      super("Authentication is required");
      this.name = "AuthenticationRequiredError";
    }
  },
}));

vi.mock("@/lib/authorization/household", () => ({
  HouseholdAccessDeniedError: class HouseholdAccessDeniedError extends Error {
    constructor() {
      super("Household access denied");
      this.name = "HouseholdAccessDeniedError";
    }
  },
  requireHouseholdAccess: vi.fn(),
}));

vi.mock("@/lib/statement-imports/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/statement-imports/service")>();
  return {
    ...actual,
    inspectCsvFile: vi.fn(),
    parseAndPreviewStatementImport: vi.fn(),
    commitStatementImport: vi.fn(),
    getStatementImportBatchDetails: vi.fn(),
    listStatementImportBatchesForAccount: vi.fn(),
  };
});

import { AuthenticationRequiredError } from "@/lib/auth/session";
import {
  HouseholdAccessDeniedError,
  requireHouseholdAccess,
} from "@/lib/authorization/household";
import {
  DuplicateImportRowError,
  ImportBatchAlreadyCommittedError,
  ImportBatchNotFoundError,
  commitStatementImport,
  getStatementImportBatchDetails,
  inspectCsvFile,
  listStatementImportBatchesForAccount,
  parseAndPreviewStatementImport,
} from "@/lib/statement-imports/service";
import { TransactionAccountNotFoundError } from "@/lib/transactions/service";

import { POST as inspectHandler } from "./inspect/route";
import { POST as previewHandler } from "./preview/route";
import { POST as commitHandler } from "./[batchId]/commit/route";
import { GET as batchDetailsHandler } from "./[batchId]/route";
import { GET as listBatchesHandler } from "./route";

const validHousehold = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";
const validAccount = "018f47a0-7762-7b9c-8d17-27f2f79e59a2";
const validBatch = "018f47a0-7762-7b9c-8d17-27f2f79e59a3";

const testAccess = {
  authUserId: "user-1",
  householdId: validHousehold,
  personId: "person-1",
};

describe("Statement import API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("inspect route", () => {
    it("denies access if unauthenticated", async () => {
      vi.mocked(requireHouseholdAccess).mockRejectedValue(
        new AuthenticationRequiredError(),
      );

      const req = new Request("http://localhost/inspect", { method: "POST" });
      const res = await inspectHandler(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          accountId: validAccount,
        }),
      });

      expect(res.status).toBe(401);
    });

    it("denies cross-household access (403)", async () => {
      vi.mocked(requireHouseholdAccess).mockRejectedValue(
        new HouseholdAccessDeniedError(),
      );

      const req = new Request("http://localhost/inspect", { method: "POST" });
      const res = await inspectHandler(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          accountId: validAccount,
        }),
      });

      expect(res.status).toBe(403);
    });

    it("returns a stable JSON error when the multipart file is missing", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValue(testAccess as any);
      const form = new FormData();
      const res = await inspectHandler(
        new Request("http://localhost/inspect", { method: "POST", body: form }),
        { params: Promise.resolve({ householdId: validHousehold, accountId: validAccount }) },
      );

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: "IMPORT_FILE_INVALID",
        code: "IMPORT_FILE_INVALID",
      });
    });

    it("normalizes malformed multipart parsing without exposing parser details", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValue(testAccess as any);
      const res = await inspectHandler(
        new Request("http://localhost/inspect", {
          method: "POST",
          headers: { "Content-Type": "multipart/form-data; boundary=broken" },
          body: "--broken\r\nContent-Disposition: form-data; name=\"file\"\r\n\r\n",
        }),
        { params: Promise.resolve({ householdId: validHousehold, accountId: validAccount }) },
      );

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: "MULTIPART_PARSE_INVALID",
        code: "MULTIPART_PARSE_INVALID",
      });
    });

    it("keeps malformed CSV parser errors distinct from multipart errors", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValue(testAccess as any);
      vi.mocked(inspectCsvFile).mockRejectedValue(new SyntaxError("raw CSV parser details"));
      const form = new FormData();
      form.append("file", new File(["Date,Amount\nunterminated\""], "statement.csv"));

      const res = await inspectHandler(
        new Request("http://localhost/inspect", { method: "POST", body: form }),
        { params: Promise.resolve({ householdId: validHousehold, accountId: validAccount }) },
      );

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: "CSV_PARSE_INVALID",
        code: "CSV_PARSE_INVALID",
      });
    });

    it("returns stable validation codes for unsupported encoding and delimiter", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValue(testAccess as any);
      for (const [field, value, code] of [
        ["encoding", "utf-16", "IMPORT_ENCODING_INVALID"],
        ["delimiter", "^", "IMPORT_DELIMITER_INVALID"],
      ] as const) {
        const form = new FormData();
        form.append("file", new File(["Date,Amount\n2026-01-01,1"], "statement.csv"));
        form.append(field, value);
        const res = await inspectHandler(
          new Request("http://localhost/inspect", { method: "POST", body: form }),
          { params: Promise.resolve({ householdId: validHousehold, accountId: validAccount }) },
        );
        expect(res.status).toBe(400);
        await expect(res.json()).resolves.toEqual({ error: code, code });
      }
    });
  });

  describe("commit route", () => {
    it("returns a stable JSON validation error for malformed JSON", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValue(testAccess as any);

      const res = await commitHandler(new Request("http://localhost/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not-json",
      }), { params: Promise.resolve({ householdId: validHousehold, accountId: validAccount, batchId: validBatch }) });

      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toMatchObject({ code: "JSON_INVALID" });
    });
  });

  describe("preview route", () => {
    it.each([
      ["missing multipart file", async () => {
        const form = new FormData();
        form.append("mappingConfig", "{}");
        return new Request("http://localhost/preview", { method: "POST", body: form });
      }],
      ["missing multipart mappingConfig", async () => {
        const form = new FormData();
        form.append("file", new File(["Date,Amount,Description\\n2026-03-01,-10,Coffee"], "statement.csv"));
        return new Request("http://localhost/preview", { method: "POST", body: form });
      }],
      ["empty JSON body", async () => new Request("http://localhost/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(null),
      })],
      ["missing JSON file source", async () => new Request("http://localhost/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappingConfig: {} }),
      })],
    ])("returns a stable validation code for %s", async (_name, makeRequest) => {
      vi.mocked(requireHouseholdAccess).mockResolvedValue(testAccess as any);

      const res = await previewHandler(await makeRequest(), {
        params: Promise.resolve({ householdId: validHousehold, accountId: validAccount }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      if (_name === "missing multipart file" || _name === "empty JSON body" || _name === "missing JSON file source") {
        expect(body).toEqual({ error: "IMPORT_FILE_INVALID", code: "IMPORT_FILE_INVALID" });
      } else {
        expect(body).toEqual({ error: "IMPORT_MAPPING_INVALID", code: "IMPORT_MAPPING_INVALID" });
      }
    });

    it("classifies malformed non-multipart JSON as mapping validation", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValue(testAccess as any);

      const res = await previewHandler(
        new Request("http://localhost/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{not-json",
        }),
        { params: Promise.resolve({ householdId: validHousehold, accountId: validAccount }) },
      );

      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toMatchObject({
        code: "IMPORT_MAPPING_INVALID",
        error: "IMPORT_MAPPING_INVALID",
      });
    });

    it("returns a stable multipart parse error for malformed form data", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValue(testAccess as any);

      const res = await previewHandler(
        new Request("http://localhost/preview", {
          method: "POST",
          headers: { "Content-Type": "multipart/form-data; boundary=broken" },
          body: "malformed",
        }),
        { params: Promise.resolve({ householdId: validHousehold, accountId: validAccount }) },
      );

      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({
        error: "MULTIPART_PARSE_INVALID",
        code: "MULTIPART_PARSE_INVALID",
      });
    });

    it("returns 403 on cross-household access attempt", async () => {
      vi.mocked(requireHouseholdAccess).mockRejectedValue(
        new HouseholdAccessDeniedError(),
      );

      const req = new Request("http://localhost/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileText: "Data,Kwota,Opis\n2026-03-01,-10,Coffee",
          mappingConfig: {
            dateColumn: "Data",
            descriptionColumn: "Opis",
          },
        }),
      });

      const res = await previewHandler(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          accountId: validAccount,
        }),
      });

      expect(res.status).toBe(403);
    });

    it("returns 404 if account not found in household", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValue(testAccess as any);
      vi.mocked(parseAndPreviewStatementImport).mockRejectedValue(
        new TransactionAccountNotFoundError("Account not found"),
      );

      const req = new Request("http://localhost/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileText: "Data,Kwota,Opis\n2026-03-01,-10,Coffee",
          mappingConfig: {
            dateColumn: "Data",
            descriptionColumn: "Opis",
          },
        }),
      });

      const res = await previewHandler(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          accountId: validAccount,
        }),
      });

      expect(res.status).toBe(404);
    });

    it("classifies malformed multipart mapping JSON as validation", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValue(testAccess as any);
      const form = new FormData();
      form.append("file", new File(["Date,Amount,Description\\n2026-03-01,-10,Coffee"], "statement.csv"));
      form.append("mappingConfig", "{not-json");

      const res = await previewHandler(
        new Request("http://localhost/preview", { method: "POST", body: form }),
        { params: Promise.resolve({ householdId: validHousehold, accountId: validAccount }) },
      );

      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toMatchObject({
        code: "IMPORT_MAPPING_INVALID",
        error: "IMPORT_MAPPING_INVALID",
      });
    });

    it("returns 200 with preview data on valid request", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValue(testAccess as any);
      vi.mocked(parseAndPreviewStatementImport).mockResolvedValue({
        batchId: validBatch,
        sourceFilename: "test.csv",
        fileHash: "hash-1",
        totalRowCount: 1,
        validRowCount: 1,
        invalidRowCount: 0,
        duplicateRowCount: 0,
        safeToCommitCount: 1,
        attentionRowCount: 0,
        rows: [
          {
            rowIndex: 0,
            valid: true,
            status: "pending",
            date: "2026-03-01T00:00:00.000Z",
            kind: "expense",
            amountMinor: "1000",
            currency: "PLN",
            formattedAmount: "10.00 PLN",
            description: "Coffee",
            rawRowContent: "2026-03-01,-10,Coffee",
            dedupeHash: "dhash-1",
            sourceRowIdentity: "id-1",
            possibleMatch: null,
            selected: true,
          },
        ],
      });

      const req = new Request("http://localhost/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileText: "Data,Kwota,Opis\n2026-03-01,-10,Coffee",
          mappingConfig: {
            dateColumn: "Data",
            descriptionColumn: "Opis",
          },
        }),
      });

      const res = await previewHandler(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          accountId: validAccount,
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.batchId).toBe(validBatch);
      expect(data.data.rows[0].description).toBe("Coffee");
    });

    it("passes autoCommitSafe flag to parseAndPreviewStatementImport", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValue(testAccess as any);
      vi.mocked(parseAndPreviewStatementImport).mockResolvedValue({
        batchId: validBatch,
        sourceFilename: "statement.csv",
        fileHash: "hash123",
        totalRowCount: 1,
        validRowCount: 1,
        invalidRowCount: 0,
        duplicateRowCount: 0,
        safeToCommitCount: 1,
        attentionRowCount: 0,
        rows: [],
        autoCommitted: {
          batchId: validBatch,
          importedCount: 1,
          skippedCount: 0,
          committedTransactionIds: ["tx-1"],
        },
      });

      const req = new Request("http://localhost/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileText: "Data,Kwota,Opis\n2026-03-01,-10,Coffee",
          autoCommitSafe: true,
          mappingConfig: {
            dateColumn: "Data",
            descriptionColumn: "Opis",
          },
        }),
      });

      const res = await previewHandler(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          accountId: validAccount,
        }),
      });

      expect(res.status).toBe(200);
      expect(parseAndPreviewStatementImport).toHaveBeenCalledWith(
        expect.objectContaining({
          autoCommitSafe: true,
        }),
      );
    });
  });

  describe("commit route", () => {
    it("returns 409 Conflict on repeated confirmation (already committed batch)", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValue(testAccess as any);
      vi.mocked(commitStatementImport).mockRejectedValue(
        new ImportBatchAlreadyCommittedError(),
      );

      const req = new Request("http://localhost/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedRowIndices: [0],
        }),
      });

      const res = await commitHandler(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          accountId: validAccount,
          batchId: validBatch,
        }),
      });

      expect(res.status).toBe(409);
    });

    it("returns 409 Conflict on duplicate import row error", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValue(testAccess as any);
      vi.mocked(commitStatementImport).mockRejectedValue(
        new DuplicateImportRowError(),
      );

      const req = new Request("http://localhost/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedRowIndices: [0],
        }),
      });

      const res = await commitHandler(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          accountId: validAccount,
          batchId: validBatch,
        }),
      });

      expect(res.status).toBe(409);
    });

    it("returns 200 on successful atomic commit", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValue(testAccess as any);
      vi.mocked(commitStatementImport).mockResolvedValue({
        batchId: validBatch,
        importedCount: 1,
        skippedCount: 0,
        committedTransactionIds: ["tx-1"],
      });

      const req = new Request("http://localhost/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedRowIndices: [0],
        }),
      });

      const res = await commitHandler(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          accountId: validAccount,
          batchId: validBatch,
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.importedCount).toBe(1);
    });

    it("supports safeOnly commit option without selectedRowIndices", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValue(testAccess as any);
      vi.mocked(commitStatementImport).mockResolvedValue({
        batchId: validBatch,
        importedCount: 3,
        skippedCount: 1,
        committedTransactionIds: ["tx-1", "tx-2", "tx-3"],
      });

      const req = new Request("http://localhost/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          safeOnly: true,
        }),
      });

      const res = await commitHandler(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          accountId: validAccount,
          batchId: validBatch,
        }),
      });

      expect(res.status).toBe(200);
      expect(commitStatementImport).toHaveBeenCalledWith(
        expect.objectContaining({
          safeOnly: true,
        }),
      );
    });
  });

  describe("batch details route", () => {
    it("returns 404 if batch not found", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValue(testAccess as any);
      vi.mocked(getStatementImportBatchDetails).mockRejectedValue(
        new ImportBatchNotFoundError(),
      );

      const req = new Request("http://localhost/batch", { method: "GET" });
      const res = await batchDetailsHandler(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          accountId: validAccount,
          batchId: validBatch,
        }),
      });

      expect(res.status).toBe(404);
    });
  });
});
