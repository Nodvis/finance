import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/session", () => ({
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {},
}));

vi.mock("@/lib/authorization/household", () => ({
  HouseholdAccessDeniedError: class HouseholdAccessDeniedError extends Error {},
}));

vi.mock("@/lib/transactions/service", () => ({
  TransactionAccountNotFoundError: class TransactionAccountNotFoundError extends Error {},
}));

vi.mock("./service", () => ({
  EmptyCsvError: class EmptyCsvError extends Error {},
  FileTooLargeError: class FileTooLargeError extends Error {},
  AmbiguousImportRowCommitError: class AmbiguousImportRowCommitError extends Error {},
  DuplicateImportRowError: class DuplicateImportRowError extends Error {},
  DuplicateStatementImportProfileNameError: class DuplicateStatementImportProfileNameError extends Error {},
  ImportBatchAlreadyCommittedError: class ImportBatchAlreadyCommittedError extends Error {},
  ImportBatchNotFoundError: class ImportBatchNotFoundError extends Error {},
  ImportMappingValidationError: class ImportMappingValidationError extends Error {
    readonly code = "IMPORT_MAPPING_INVALID";
  },
  StatementImportProfileNotFoundError: class StatementImportProfileNotFoundError extends Error {},
}));

import { handleImportRouteError } from "./error-handler";
import { AmbiguousImportRowCommitError, ImportMappingValidationError } from "./service";

describe("statement import route errors", () => {
  it("returns the stable mapping validation code", async () => {
    const response = handleImportRouteError(new ImportMappingValidationError());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "IMPORT_MAPPING_INVALID",
      code: "IMPORT_MAPPING_INVALID",
    });
  });

  it("returns a stable conflict code for ambiguous row commits", async () => {
    const response = handleImportRouteError(new AmbiguousImportRowCommitError());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "IMPORT_ROW_AMBIGUOUS",
      code: "IMPORT_ROW_AMBIGUOUS",
    });
  });
});
