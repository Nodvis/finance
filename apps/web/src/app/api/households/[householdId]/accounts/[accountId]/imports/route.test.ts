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
  });

  describe("preview route", () => {
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
