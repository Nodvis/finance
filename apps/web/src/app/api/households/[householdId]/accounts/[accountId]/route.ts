import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthenticationRequiredError } from "@/lib/auth/session";
import {
  HouseholdAccessDeniedError,
  requireHouseholdAccess,
} from "@/lib/authorization/household";
import {
  AccountInvalidOwnerError,
  AccountNotFoundError,
  getHouseholdAccount,
  updateHouseholdAccountMetadataEntry,
} from "@/lib/accounts/service";
import { updateAccountMetadataSchema } from "@/lib/accounts/schema";
import { serializeAccount } from "@/lib/accounts/serialization";

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

  if (error instanceof AccountNotFoundError) {
    return NextResponse.json(
      { error: "Account not found in household" },
      { status: 404 },
    );
  }

  if (error instanceof AccountInvalidOwnerError) {
    return NextResponse.json(
      { error: "All account owners must belong to this household" },
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

  if (error instanceof Error && error.message.includes("Invalid")) {
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
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { householdId, accountId } = await context.params;
    const access = await requireHouseholdAccess(householdId);
    const account = await getHouseholdAccount(access, accountId);

    return NextResponse.json({ data: serializeAccount(account) }, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { householdId, accountId } = await context.params;
    const access = await requireHouseholdAccess(householdId);

    const body = await request.json();
    const parsed = updateAccountMetadataSchema.parse(body);

    const updated = await updateHouseholdAccountMetadataEntry(
      access,
      accountId,
      parsed,
    );

    return NextResponse.json(
      { data: serializeAccount(updated) },
      { status: 200 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
