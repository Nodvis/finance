import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthenticationRequiredError } from "@/lib/auth/session";
import { HouseholdAccessDeniedError, requireHouseholdAccess } from "@/lib/authorization/household";
import { splitTransactionSchema } from "@/lib/transactions/split-schema";
import { getTransactionSplits, saveTransactionSplits } from "@/lib/transactions/split-service";
import { SplitTransactionNotFoundError, SplitValidationError, SplitVersionConflictError } from "@nodvis/finance-db";

type Context = { params: Promise<{ householdId: string; transactionId: string }> };
function errorResponse(error: unknown) {
  if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: "Authentication is required" }, { status: 401 });
  if (error instanceof HouseholdAccessDeniedError) return NextResponse.json({ error: "Household access denied" }, { status: 403 });
  if (error instanceof SplitTransactionNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
  if (error instanceof SplitVersionConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof ZodError || error instanceof SplitValidationError) return NextResponse.json({ error: error instanceof ZodError ? "Validation error" : error.message, ...(error instanceof ZodError ? { issues: error.issues } : {}) }, { status: 400 });
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
export async function GET(_: Request, context: Context) { try { const { householdId, transactionId } = await context.params; const access = await requireHouseholdAccess(householdId); return NextResponse.json({ data: await getTransactionSplits(access, transactionId) }); } catch (e) { return errorResponse(e); } }
export async function PUT(request: Request, context: Context) { try { const { householdId, transactionId } = await context.params; const access = await requireHouseholdAccess(householdId); let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); } const input = splitTransactionSchema.parse(body); return NextResponse.json({ data: await saveTransactionSplits(access, transactionId, input) }); } catch (e) { return errorResponse(e); } }
