import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthenticationRequiredError } from "@/lib/auth/session";
import { HouseholdAccessDeniedError, requireHouseholdAccess } from "@/lib/authorization/household";
import { createCreditFacility, listCreditFacilitiesByHousehold, serializeCreditFacility } from "@nodvis/finance-db";
import { creditFacilityInputSchema } from "@/lib/credit-facilities/schema";

type RouteContext = { params: Promise<{ householdId: string }> };

function toMinor(value: string | null | undefined) {
  return value === undefined || value === null ? null : BigInt(value);
}

function handleError(error: unknown) {
  if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: error.message }, { status: 401 });
  if (error instanceof HouseholdAccessDeniedError) return NextResponse.json({ error: error.message }, { status: 403 });
  if (error instanceof ZodError) return NextResponse.json({ error: "Validation error", issues: error.issues }, { status: 400 });
  if (error instanceof Error) return NextResponse.json({ error: "Unable to save credit facility" }, { status: 400 });
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { householdId } = await context.params;
    await requireHouseholdAccess(householdId);
    const includeArchived = new URL(request.url).searchParams.get("includeArchived") === "true";
    const facilities = await listCreditFacilitiesByHousehold(householdId, includeArchived);
    return NextResponse.json({ data: facilities.map(serializeCreditFacility) });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { householdId } = await context.params;
    await requireHouseholdAccess(householdId);
    const input = creditFacilityInputSchema.parse(await request.json());
    if (input.kind === "overdraft" || input.kind === "credit_card") {
      return NextResponse.json({ error: "This facility kind must be created through its linked account" }, { status: 400 });
    }
    const facility = await createCreditFacility({
      householdId,
      accountId: null,
      kind: input.kind,
      name: input.name,
      currency: input.currency,
      approvedLimitMinor: toMinor(input.approvedLimitMinor),
      observedUsedMinor: toMinor(input.observedUsedMinor),
      observedAvailableMinor: toMinor(input.observedAvailableMinor),
      observedAt: input.observedAt ? new Date(input.observedAt) : null,
      effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    });
    return NextResponse.json({ data: serializeCreditFacility(facility) }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
