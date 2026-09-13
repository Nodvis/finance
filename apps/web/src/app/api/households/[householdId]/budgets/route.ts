import { NextResponse } from "next/server";
import { requireHouseholdAccess } from "@/lib/authorization/household";
import { budgetQuerySchema, createBudgetSchema } from "@/lib/budgets/schema";
import { listHouseholdBudgets, createHouseholdBudget } from "@/lib/budgets/service";
import { handleBudgetRouteError } from "@/lib/budgets/error-handler";
type C = { params: Promise<{ householdId: string }> };
export async function GET(req: Request, ctx: C) { try { const { householdId } = await ctx.params; const auth = await requireHouseholdAccess(householdId); const u = new URL(req.url); const q = budgetQuerySchema.parse({ month: u.searchParams.get("month") ?? undefined, includeArchived: u.searchParams.get("includeArchived") ?? undefined }); return NextResponse.json({ data: await listHouseholdBudgets(auth, q) }, { headers: { "Cache-Control": "private, no-store" } }); } catch (e) { return handleBudgetRouteError(e); } }
export async function POST(req: Request, ctx: C) { try { const { householdId } = await ctx.params; const auth = await requireHouseholdAccess(householdId); const created = await createHouseholdBudget(auth, createBudgetSchema.parse(await req.json())); return NextResponse.json({ data: created }, { status: 201 }); } catch (e) { return handleBudgetRouteError(e); } }
