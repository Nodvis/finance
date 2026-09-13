import { NextResponse } from "next/server";
import { requireHouseholdAccess } from "@/lib/authorization/household";
import { archiveHouseholdBudget, updateHouseholdBudget } from "@/lib/budgets/service";
import { archiveBudgetSchema, updateBudgetSchema } from "@/lib/budgets/schema";
import { handleBudgetRouteError } from "@/lib/budgets/error-handler";
type C = { params: Promise<{ householdId: string; budgetId: string }> };
export async function PUT(req: Request, ctx: C) { try { const { householdId, budgetId } = await ctx.params; const auth = await requireHouseholdAccess(householdId); return NextResponse.json({ data: await updateHouseholdBudget(auth, budgetId, updateBudgetSchema.parse(await req.json())) }); } catch (e) { return handleBudgetRouteError(e); } }
export async function DELETE(req: Request, ctx: C) { try { const { householdId, budgetId } = await ctx.params; const auth = await requireHouseholdAccess(householdId); const body = archiveBudgetSchema.parse(await req.json()); await archiveHouseholdBudget(auth, budgetId, body.version); return new NextResponse(null, { status: 204 }); } catch (e) { return handleBudgetRouteError(e); } }
