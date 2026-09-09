import { NextResponse } from "next/server";
import { z } from "zod";

import {
  HouseholdAccessDeniedError,
  requireHouseholdAccess,
} from "@/lib/authorization/household";
import { AuthenticationRequiredError } from "@/lib/auth/session";
import {
  listHouseholdRecurringPatterns,
  updateHouseholdRecurringPattern,
} from "@/lib/recurring/service";

const updateSchema = z.object({
  patternKey: z.string().trim().min(1).max(320),
  status: z.enum(["confirmed", "dismissed"]),
});

type RouteContext = { params: Promise<{ householdId: string }> };

function errorResponse(error: unknown) {
  if (error instanceof AuthenticationRequiredError) {
    return NextResponse.json({ error: "Authentication is required" }, { status: 401 });
  }
  if (error instanceof HouseholdAccessDeniedError) {
    return NextResponse.json({ error: "Household access denied" }, { status: 403 });
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: "Validation error", issues: error.issues }, { status: 400 });
  }
  if (error instanceof Error && error.message.includes("no longer supported")) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const { householdId } = await context.params;
    const access = await requireHouseholdAccess(householdId);
    return NextResponse.json({ data: await listHouseholdRecurringPatterns(access) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { householdId } = await context.params;
    const access = await requireHouseholdAccess(householdId);
    const input = updateSchema.parse(await request.json());
    return NextResponse.json({
      data: await updateHouseholdRecurringPattern(access, input.patternKey, input.status),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
