import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthenticationRequiredError } from "@/lib/auth/session";
import { HouseholdAccessDeniedError } from "@/lib/authorization/household";
import {
  SavingsGoalAccountInvalidError,
  SavingsGoalNotFoundError,
  SavingsGoalValidationError,
  SavingsGoalVersionConflictError,
} from "@nodvis/finance-db";

export function handleSavingsGoalRouteError(error: unknown): NextResponse {
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

  if (error instanceof SavingsGoalNotFoundError) {
    return NextResponse.json(
      { error: error.message || "Savings goal not found in household" },
      { status: 404 },
    );
  }

  if (error instanceof SavingsGoalVersionConflictError) {
    return NextResponse.json(
      { error: error.message || "Conflict with current savings goal state" },
      { status: 409 },
    );
  }

  if (
    error instanceof SavingsGoalValidationError ||
    error instanceof SavingsGoalAccountInvalidError
  ) {
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

  console.error("Unhandled error in savings goal route:", error);
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 },
  );
}
