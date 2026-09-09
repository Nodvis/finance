import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { archiveCreditFacility, createCreditFacility, findCreditFacilityForAccount, serializeCreditFacility, updateCreditFacility } from "@nodvis/finance-db";
import { AuthenticationRequiredError } from "@/lib/auth/session";
import { HouseholdAccessDeniedError, requireHouseholdAccess } from "@/lib/authorization/household";
import { parseAccountBalanceToMinor } from "@/lib/transactions/money-entry";
import { creditFacilityInputSchema, creditFacilityUpdateSchema } from "@/lib/credit-facilities/schema";

type RouteContext = { params: Promise<{ householdId: string; accountId: string }> };

function errorResponse(error: unknown) {
  if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: "Authentication is required" }, { status: 401 });
  if (error instanceof HouseholdAccessDeniedError) return NextResponse.json({ error: "Household access denied" }, { status: 403 });
  if (error instanceof ZodError) return NextResponse.json({ error: "Validation error", issues: error.issues }, { status: 400 });
  if (error instanceof Error && error.message.includes("modified concurrently")) return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof Error && (error.message.includes("Invalid") || error.message.includes("facility") || error.message.includes("account"))) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

function toMinor(value: string | null | undefined, currency: string) {
  if (value === undefined || value === null) return null;
  const parsed = parseAccountBalanceToMinor(value, currency);
  if (!parsed.success || parsed.amountMinor === null || parsed.amountMinor < 0n) throw new Error("Invalid credit facility amount");
  return parsed.amountMinor;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { householdId, accountId } = await context.params;
    await requireHouseholdAccess(householdId);
    const facility = await findCreditFacilityForAccount(householdId, accountId);
    return NextResponse.json({ data: facility ? serializeCreditFacility(facility) : null });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { householdId, accountId } = await context.params;
    await requireHouseholdAccess(householdId);
    const input = creditFacilityInputSchema.parse(await request.json());
    const created = await createCreditFacility({
      householdId,
      accountId,
      kind: input.kind,
      name: input.name,
      currency: input.currency,
      approvedLimitMinor: toMinor(input.approvedLimitMinor, input.currency),
      observedUsedMinor: toMinor(input.observedUsedMinor, input.currency),
      observedAvailableMinor: toMinor(input.observedAvailableMinor, input.currency),
      observedAt: input.observedAt ? new Date(input.observedAt) : null,
      effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    });
    return NextResponse.json({ data: serializeCreditFacility(created) }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { householdId, accountId } = await context.params;
    await requireHouseholdAccess(householdId);
    const input = creditFacilityUpdateSchema.parse(await request.json());
    const current = await findCreditFacilityForAccount(householdId, accountId);
    if (!current) return NextResponse.json({ error: "Credit facility not found" }, { status: 404 });
    const updated = await updateCreditFacility(householdId, current.id, {
      accountId, kind: input.kind, name: input.name, currency: input.currency,
      approvedLimitMinor: toMinor(input.approvedLimitMinor, input.currency),
      observedUsedMinor: toMinor(input.observedUsedMinor, input.currency),
      observedAvailableMinor: toMinor(input.observedAvailableMinor, input.currency),
      observedAt: input.observedAt ? new Date(input.observedAt) : null,
      effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      version: input.version,
    });
    return NextResponse.json({ data: serializeCreditFacility(updated) });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { householdId, accountId } = await context.params;
    await requireHouseholdAccess(householdId);
    const body = z.object({ version: z.number().int().positive() }).parse(await request.json());
    const current = await findCreditFacilityForAccount(householdId, accountId);
    if (!current) return NextResponse.json({ error: "Credit facility not found" }, { status: 404 });
    const archived = await archiveCreditFacility(householdId, current.id, body.version);
    return NextResponse.json({ data: serializeCreditFacility(archived) });
  } catch (error) { return errorResponse(error); }
}
