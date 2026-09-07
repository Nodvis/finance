import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { AuthenticationRequiredError } from "@/lib/auth/session";
import {
  ACTIVE_HOUSEHOLD_COOKIE_NAME,
  HouseholdAccessDeniedError,
  requireHouseholdAccess,
} from "@/lib/authorization/household";

const selectHouseholdSchema = z.object({
  householdId: z.uuid("Invalid household ID"),
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const parsed = selectHouseholdSchema.parse(body);

    // Verify user belongs to this household
    await requireHouseholdAccess(parsed.householdId);

    const response = NextResponse.json(
      { data: { activeHouseholdId: parsed.householdId } },
      { status: 200 },
    );

    response.cookies.set(ACTIVE_HOUSEHOLD_COOKIE_NAME, parsed.householdId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });

    return response;
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
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation error", issues: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
