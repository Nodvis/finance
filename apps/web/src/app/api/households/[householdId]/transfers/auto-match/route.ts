import { NextResponse } from "next/server";

import { AuthenticationRequiredError } from "@/lib/auth/session";
import {
  HouseholdAccessDeniedError,
  requireHouseholdAccess,
} from "@/lib/authorization/household";
import { autoMatchAllConfirmedReady } from "@/lib/transfers/service";

type RouteContext = {
  params: Promise<{ householdId: string }>;
};

export async function POST(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { householdId } = await context.params;
    const access = await requireHouseholdAccess(householdId);
    const result = await autoMatchAllConfirmedReady(access);

    return NextResponse.json({ data: result }, { status: 200 });
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
