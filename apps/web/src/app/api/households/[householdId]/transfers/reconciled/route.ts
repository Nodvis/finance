import { NextResponse } from "next/server";

import { AuthenticationRequiredError } from "@/lib/auth/session";
import {
  HouseholdAccessDeniedError,
  requireHouseholdAccess,
} from "@/lib/authorization/household";
import { listReconciledTransfers } from "@/lib/transfers/service";

type RouteContext = {
  params: Promise<{ householdId: string }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { householdId } = await context.params;
    const access = await requireHouseholdAccess(householdId);
    const records = await listReconciledTransfers(access);

    return NextResponse.json({ data: records }, { status: 200 });
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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
