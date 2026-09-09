import { NextResponse } from "next/server";
import { requireHouseholdAccess } from "@/lib/authorization/household";
import { applyCategorizationRules, previewCategorizationRules } from "@/lib/categorization-rules/service";
import { applyCategorizationRulesSchema } from "@/lib/categorization-rules/schema";
import { ruleError } from "../route";

export async function POST(request: Request, context: { params: Promise<{ householdId: string }> }) {
  try {
    const { householdId } = await context.params;
    const access = await requireHouseholdAccess(householdId);
    const input = applyCategorizationRulesSchema.parse(await request.json());
    if (input.previewOnly) return NextResponse.json({ data: await previewCategorizationRules(access, input.transactionIds) });
    return NextResponse.json({ data: await applyCategorizationRules(access, input.transactionIds) });
  } catch (error) {
    return ruleError(error);
  }
}
