import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthenticationRequiredError } from "@/lib/auth/session";
import {
  HouseholdAccessDeniedError,
  requireHouseholdAccess,
} from "@/lib/authorization/household";
import {
  DuplicateAccountIdentifierError,
  InvalidAccountIdentifierError,
  createHouseholdAccountIdentifier,
  listHouseholdAccountIdentifiers,
} from "@/lib/account-identifiers/service";
import { addAccountIdentifierSchema } from "@/lib/account-identifiers/schema";

type RouteContext = {
  params: Promise<{ householdId: string; accountId: string }>;
};

function handleRouteError(error: unknown): NextResponse {
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

  if (error instanceof DuplicateAccountIdentifierError) {
    return NextResponse.json(
      { error: error.message },
      { status: 409 },
    );
  }

  if (error instanceof InvalidAccountIdentifierError) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: error.issues[0]?.message || "Validation error",
        issues: error.issues,
      },
      { status: 400 },
    );
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Internal server error" },
    { status: 500 },
  );
}

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { householdId, accountId } = await context.params;
    const access = await requireHouseholdAccess(householdId);
    const identifiers = await listHouseholdAccountIdentifiers(
      access,
      accountId,
    );

    return NextResponse.json({ data: identifiers }, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { householdId, accountId } = await context.params;
    const access = await requireHouseholdAccess(householdId);

    const body = await request.json();
    const parsed = addAccountIdentifierSchema.parse(body);

    const created = await createHouseholdAccountIdentifier(
      access,
      accountId,
      parsed,
    );

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
