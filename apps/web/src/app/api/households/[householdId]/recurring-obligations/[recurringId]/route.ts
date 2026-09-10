import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthenticationRequiredError } from "@/lib/auth/session";
import { HouseholdAccessDeniedError, requireHouseholdAccess } from "@/lib/authorization/household";
import { cancelHouseholdRecurringObligation, updateHouseholdRecurringObligation, RecurringObligationNotFoundError, RecurringObligationVersionConflictError } from "@/lib/recurring-obligations/service";
import { cancelRecurringObligationSchema, updateRecurringObligationSchema } from "@/lib/recurring-obligations/schema";

type Context = { params: Promise<{ householdId: string; recurringId: string }> };
function errors(error: unknown) {
  if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: "Authentication is required" }, { status: 401 });
  if (error instanceof HouseholdAccessDeniedError || error instanceof Error && error.message === "Household access denied") return NextResponse.json({ error: "Household access denied" }, { status: 403 });
  if (error instanceof z.ZodError) return NextResponse.json({ error: "Validation error", issues: error.issues }, { status: 400 });
  if (error instanceof RecurringObligationNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
  if (error instanceof RecurringObligationVersionConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
export async function PATCH(request: Request, context: Context) { try { const { householdId, recurringId } = await context.params; const access = await requireHouseholdAccess(householdId); return NextResponse.json({ data: await updateHouseholdRecurringObligation(access, recurringId, updateRecurringObligationSchema.parse(await request.json())) }); } catch (error) { return errors(error); } }
export async function DELETE(request: Request, context: Context) { try { const { householdId, recurringId } = await context.params; const access = await requireHouseholdAccess(householdId); const input = cancelRecurringObligationSchema.parse(await request.json()); return NextResponse.json({ data: await cancelHouseholdRecurringObligation(access, recurringId, input.version) }); } catch (error) { return errors(error); } }
