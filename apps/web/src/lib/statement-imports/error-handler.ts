import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthenticationRequiredError } from "@/lib/auth/session";
import { HouseholdAccessDeniedError } from "@/lib/authorization/household";
import { TransactionAccountNotFoundError } from "@/lib/transactions/service";
import {
  DuplicateImportRowError,
  DuplicateStatementImportProfileNameError,
  EmptyCsvError,
  FileTooLargeError,
  ImportMappingValidationError,
  ImportBatchAlreadyCommittedError,
  AmbiguousImportRowCommitError,
  ImportBatchNotFoundError,
  StatementImportProfileNotFoundError,
} from "./service";

export class InvalidJsonBodyError extends Error {
  constructor(message = "Invalid JSON request body") {
    super(message);
    this.name = "InvalidJsonBodyError";
  }
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new InvalidJsonBodyError();
  }
}

function stableErrorCode(error: unknown): string {
  if (error instanceof InvalidJsonBodyError) return "JSON_INVALID";
  if (error instanceof SyntaxError) return "CSV_PARSE_INVALID";
  if (error instanceof ZodError) return "VALIDATION_ERROR";
  if (error instanceof ImportMappingValidationError) return error.code;
  if (error instanceof Error && error.name === "StatementImportProfileScopeConflictError") {
    return "STATEMENT_IMPORT_PROFILE_SCOPE_CONFLICT";
  }
  if (error instanceof Error && error.name) return error.name.replace(/Error$/, "").toUpperCase();
  return "INTERNAL_ERROR";
}

export function handleImportRouteError(error: unknown): NextResponse {
  if (error instanceof AuthenticationRequiredError) {
    return NextResponse.json(
      { error: "AUTHENTICATION_REQUIRED", code: "AUTHENTICATION_REQUIRED" },
      { status: 401 },
    );
  }

  if (error instanceof HouseholdAccessDeniedError) {
    return NextResponse.json(
      { error: "HOUSEHOLD_ACCESS_DENIED", code: "HOUSEHOLD_ACCESS_DENIED" },
      { status: 403 },
    );
  }

  if (
    error instanceof TransactionAccountNotFoundError ||
    error instanceof ImportBatchNotFoundError ||
    error instanceof StatementImportProfileNotFoundError
  ) {
    return NextResponse.json(
      { error: stableErrorCode(error), code: stableErrorCode(error) },
      { status: 404 },
    );
  }

  if (error instanceof AmbiguousImportRowCommitError) {
    return NextResponse.json(
      { error: "IMPORT_ROW_AMBIGUOUS", code: "IMPORT_ROW_AMBIGUOUS" },
      { status: 409 },
    );
  }

  if (
    error instanceof ImportBatchAlreadyCommittedError ||
    error instanceof DuplicateImportRowError ||
    error instanceof DuplicateStatementImportProfileNameError ||
    (error instanceof Error && error.name === "StatementImportProfileScopeConflictError")
  ) {
    return NextResponse.json(
      { error: stableErrorCode(error), code: stableErrorCode(error) },
      { status: 409 },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "VALIDATION_ERROR",
        code: "VALIDATION_ERROR",
        issues: error.issues,
      },
      { status: 400 },
    );
  }

  if (
    error instanceof FileTooLargeError ||
    error instanceof EmptyCsvError ||
    error instanceof ImportMappingValidationError ||
    error instanceof InvalidJsonBodyError ||
    error instanceof SyntaxError
  ) {
    return NextResponse.json(
      { error: stableErrorCode(error), code: stableErrorCode(error) },
      { status: 400 },
    );
  }

  return NextResponse.json(
    { error: "INTERNAL_ERROR", code: "INTERNAL_ERROR" },
    { status: 500 },
  );
}
