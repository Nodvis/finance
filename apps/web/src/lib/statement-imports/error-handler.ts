import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthenticationRequiredError } from "@/lib/auth/session";
import { HouseholdAccessDeniedError } from "@/lib/authorization/household";
import { TransactionAccountNotFoundError } from "@/lib/transactions/service";
import {
  DuplicateImportRowError,
  EmptyCsvError,
  FileTooLargeError,
  ImportBatchAlreadyCommittedError,
  ImportBatchNotFoundError,
} from "./service";

export function handleImportRouteError(error: unknown): NextResponse {
  if (error instanceof AuthenticationRequiredError) {
    return NextResponse.json(
      { error: "Authentication is required" },
      { status: 401 },
    );
  }

  if (error instanceof HouseholdAccessDeniedError) {
    return NextResponse.json(
      { error: "Household access denied" },
      { status: 403 },
    );
  }

  if (
    error instanceof TransactionAccountNotFoundError ||
    error instanceof ImportBatchNotFoundError
  ) {
    return NextResponse.json(
      { error: error.message },
      { status: 404 },
    );
  }

  if (
    error instanceof ImportBatchAlreadyCommittedError ||
    error instanceof DuplicateImportRowError
  ) {
    return NextResponse.json(
      { error: error.message },
      { status: 409 },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Validation error",
        issues: error.issues,
      },
      { status: 400 },
    );
  }

  if (
    error instanceof FileTooLargeError ||
    error instanceof EmptyCsvError ||
    error instanceof SyntaxError
  ) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Internal server error" },
    { status: 500 },
  );
}
