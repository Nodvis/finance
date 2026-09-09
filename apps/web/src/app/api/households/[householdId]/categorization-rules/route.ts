import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireHouseholdAccess } from "@/lib/authorization/household";
import { createHouseholdCategorizationRule, listHouseholdCategorizationRules } from "@/lib/categorization-rules/service";
import { createCategorizationRuleSchema } from "@/lib/categorization-rules/schema";

export async function GET(_request: Request, context: { params: Promise<{ householdId: string }> }) {
  try {
    const { householdId } = await context.params;
    const access = await requireHouseholdAccess(householdId);
    return NextResponse.json({ data: await listHouseholdCategorizationRules(access) });
  } catch (error) {
    return ruleError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ householdId: string }> }) {
  try {
    const { householdId } = await context.params;
    const access = await requireHouseholdAccess(householdId);
    const input = createCategorizationRuleSchema.parse(await request.json());
    return NextResponse.json({ data: await createHouseholdCategorizationRule(access, input) }, { status: 201 });
  } catch (error) {
    return ruleError(error);
  }
}

export function ruleError(error: unknown) {
  if (error instanceof ZodError) return NextResponse.json({ error: "Validation error", issues: error.issues }, { status: 400 });
  if (error instanceof Error && (error.name.includes("Authentication") || error.name.includes("AccessDenied"))) return NextResponse.json({ error: error.message }, { status: 403 });
  if (error instanceof Error && (error.name.includes("Category") || error.message.includes("not found") || error.message.includes("applicability"))) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
