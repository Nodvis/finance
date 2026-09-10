import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthenticationRequiredError } from "@/lib/auth/session";
import { HouseholdAccessDeniedError, requireHouseholdAccess } from "@/lib/authorization/household";
import { createHouseholdRecurringObligation, listHouseholdRecurringObligations } from "@/lib/recurring-obligations/service";
import { createRecurringObligationSchema } from "@/lib/recurring-obligations/schema";

type Context = { params: Promise<{ householdId: string }> };
function errors(error: unknown) {
  if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: "Authentication is required" }, { status: 401 });
  if (error instanceof HouseholdAccessDeniedError || error instanceof Error && error.message === "Household access denied") return NextResponse.json({ error: "Household access denied" }, { status: 403 });
  if (error instanceof z.ZodError) return NextResponse.json({ error: "Validation error", issues: error.issues }, { status: 400 });
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
export async function GET(_: Request, context: Context) { try { const { householdId } = await context.params; const access = await requireHouseholdAccess(householdId); return NextResponse.json({ data: await listHouseholdRecurringObligations(access) }); } catch (error) { return errors(error); } }
export async function POST(request: Request, context: Context) { try { const { householdId } = await context.params; const access = await requireHouseholdAccess(householdId); return NextResponse.json({ data: await createHouseholdRecurringObligation(access, createRecurringObligationSchema.parse(await request.json())) }, { status: 201 }); } catch (error) { return errors(error); } }
