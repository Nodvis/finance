import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthenticationRequiredError } from "@/lib/auth/session";
import {
  HouseholdAccessDeniedError,
  requireHouseholdAccess,
} from "@/lib/authorization/household";
import {
  LiabilityDestinationAccountCurrencyMismatchError,
  LiabilityDestinationAccountInvalidHouseholdError,
  LiabilityDestinationAccountNotFoundError,
  LiabilityInvalidResponsiblePersonError,
  LiabilityNotFoundError,
  LiabilityRepaymentAlreadyVoidedError,
  LiabilityRepaymentInvalidAllocationError,
  LiabilityRepaymentNotFoundError,
  LiabilityRepaymentSourceAccountCurrencyMismatchError,
  LiabilityRepaymentSourceAccountNotFoundError,
  LiabilityRepaymentVersionConflictError,
  LiabilityVersionConflictError,
  createHouseholdLiabilityEntry,
  listHouseholdLiabilities,
} from "@/lib/liabilities/service";
import {
  createLiabilitySchema,
  listLiabilitiesQuerySchema,
} from "@/lib/liabilities/schema";
import { serializeLiability } from "@/lib/liabilities/serialization";

type RouteContext = {
  params: Promise<{ householdId: string }>;
};

export function handleRouteError(error: unknown): NextResponse {
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
    error instanceof LiabilityNotFoundError ||
    error instanceof LiabilityRepaymentNotFoundError
  ) {
    return NextResponse.json(
      { error: error.message || "Resource not found in household" },
      { status: 404 },
    );
  }

  if (
    error instanceof LiabilityVersionConflictError ||
    error instanceof LiabilityRepaymentVersionConflictError
  ) {
    return NextResponse.json(
      { error: error.message || "Conflict: resource modified concurrently" },
      { status: 409 },
    );
  }

  if (
    error instanceof LiabilityRepaymentAlreadyVoidedError ||
    error instanceof LiabilityDestinationAccountNotFoundError ||
    error instanceof LiabilityDestinationAccountCurrencyMismatchError ||
    error instanceof LiabilityDestinationAccountInvalidHouseholdError ||
    error instanceof LiabilityRepaymentSourceAccountNotFoundError ||
    error instanceof LiabilityRepaymentSourceAccountCurrencyMismatchError ||
    error instanceof LiabilityInvalidResponsiblePersonError ||
    error instanceof LiabilityRepaymentInvalidAllocationError
  ) {
    return NextResponse.json(
      { error: error.message },
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

  if (error instanceof Error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 },
    );
  }

  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 },
  );
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { householdId } = await context.params;
    const access = await requireHouseholdAccess(householdId);

    const url = new URL(request.url);
    const queryParams: Record<string, string> = {};

    const includeArchived = url.searchParams.get("includeArchived");
    if (includeArchived) queryParams.includeArchived = includeArchived;

    const parsedQuery = listLiabilitiesQuerySchema.parse(queryParams);
    const liabilities = await listHouseholdLiabilities(access, parsedQuery);

    return NextResponse.json(
      { data: liabilities.map(serializeLiability) },
      { status: 200 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { householdId } = await context.params;
    const access = await requireHouseholdAccess(householdId);

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    const parsed = createLiabilitySchema.parse(rawBody);
    const created = await createHouseholdLiabilityEntry(access, parsed);

    return NextResponse.json(
      { data: serializeLiability(created) },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
