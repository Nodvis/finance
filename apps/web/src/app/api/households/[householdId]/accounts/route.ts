import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthenticationRequiredError } from "@/lib/auth/session";
import {
  HouseholdAccessDeniedError,
  requireHouseholdAccess,
} from "@/lib/authorization/household";
import {
  AccountInvalidOwnerError,
  createHouseholdAccountEntry,
  listHouseholdAccountsSummary,
} from "@/lib/accounts/service";
import { createAccountInputSchema } from "@/lib/accounts/schema";
import { serializeAccount } from "@/lib/accounts/serialization";

type RouteContext = {
  params: Promise<{ householdId: string }>;
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
    const { householdId } = await context.params;
    const access = await requireHouseholdAccess(householdId);
    const accounts = await listHouseholdAccountsSummary(access);
    const serialized = accounts.map(serializeAccount);

    return NextResponse.json({ data: serialized }, { status: 200 });
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

    const body = await request.json();
    const parsed = createAccountInputSchema.parse(body);

    const created = await createHouseholdAccountEntry(access, parsed);
    const serialized = serializeAccount(created);

    return NextResponse.json({ data: serialized }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
