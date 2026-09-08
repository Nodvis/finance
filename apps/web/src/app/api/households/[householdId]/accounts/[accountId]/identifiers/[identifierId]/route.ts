import { NextResponse } from "next/server";

import { AuthenticationRequiredError } from "@/lib/auth/session";
import {
  HouseholdAccessDeniedError,
  requireHouseholdAccess,
} from "@/lib/authorization/household";
import {
  AccountIdentifierNotFoundError,
  removeHouseholdAccountIdentifier,
} from "@/lib/account-identifiers/service";

type RouteContext = {
  params: Promise<{
    householdId: string;
    accountId: string;
    identifierId: string;
  }>;
};

export async function DELETE(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { householdId, identifierId } = await context.params;
    const access = await requireHouseholdAccess(householdId);

    await removeHouseholdAccountIdentifier(access, identifierId);

    return NextResponse.json({ success: true }, { status: 200 });
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
    if (error instanceof AccountIdentifierNotFoundError) {
      return NextResponse.json(
        { error: "Account identifier not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
