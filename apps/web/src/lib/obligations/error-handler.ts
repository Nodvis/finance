import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthenticationRequiredError } from "@/lib/auth/session";
import {
  HouseholdAccessDeniedError,
  ObligationMatchConflictError,
  ObligationNotFoundError,
  ObligationValidationError,
  ObligationVersionConflictError,
} from "./service";

export function handleObligationRouteError(error: unknown): NextResponse {
  if (error instanceof AuthenticationRequiredError) {
    return NextResponse.json(
      { error: "Authentication is required" },
      { status: 401 },
    );
  }

  if (
    error instanceof HouseholdAccessDeniedError ||
    (error instanceof Error && error.name === "HouseholdAccessDeniedError")
  ) {
    return NextResponse.json(
      { error: "Household access denied" },
      { status: 403 },
    );
  }

  if (error instanceof ObligationNotFoundError) {
    return NextResponse.json(
      { error: error.message || "Obligation not found in household" },
      { status: 404 },
    );
  }

  if (
    error instanceof ObligationVersionConflictError ||
    error instanceof ObligationMatchConflictError
  ) {
    return NextResponse.json(
      { error: error.message || "Conflict with current obligation state" },
      { status: 409 },
    );
  }

  if (error instanceof ObligationValidationError) {
    return NextResponse.json(
      { error: error.message || "Validation error" },
      { status: 400 },
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

  console.error("Unhandled error in obligation route:", error);
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 },
  );
}
