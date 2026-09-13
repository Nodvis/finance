import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { BudgetConflictError, BudgetNotFoundError } from "@nodvis/finance-db";

export function handleBudgetRouteError(error: unknown): NextResponse {
  if (error instanceof Error && error.name === "AuthenticationRequiredError") return NextResponse.json({ error: "Authentication is required" }, { status: 401 });
  if (error instanceof Error && error.name === "HouseholdAccessDeniedError") return NextResponse.json({ error: "Household access denied" }, { status: 403 });
  if (error instanceof BudgetNotFoundError) return NextResponse.json({ error: error.message || "Budget not found in household" }, { status: 404 });
  if (error instanceof BudgetConflictError) return NextResponse.json({ error: error.message || "Conflict with current budget state" }, { status: 409 });
  if (error instanceof ZodError) return NextResponse.json({ error: "Validation error", issues: error.issues }, { status: 400 });
  console.error("Unhandled error in budget route:", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}