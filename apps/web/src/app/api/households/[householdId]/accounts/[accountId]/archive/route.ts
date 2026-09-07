import { NextResponse } from "next/server";

import { AuthenticationRequiredError } from "@/lib/auth/session";
import {
  HouseholdAccessDeniedError,
  requireHouseholdAccess,
} from "@/lib/authorization/household";
import {
  AccountNotFoundError,
  archiveAccount,
} from "@/lib/accounts/service";
import { serializeAccount } from "@/lib/accounts/serialization";

type RouteContext = {
  params: Promise<{ householdId: string; accountId: string }>;
};

export async function POST(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { householdId, accountId } = await context.params;
    const access = await requireHouseholdAccess(householdId);

    const archived = await archiveAccount(access, accountId);
    return NextResponse.json(
      { data: serializeAccount(archived) },
      { status: 200 },
    );
  } catch (error) {
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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
