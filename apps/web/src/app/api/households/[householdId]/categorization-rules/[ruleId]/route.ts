import { NextResponse } from "next/server";
import { requireHouseholdAccess } from "@/lib/authorization/household";
import { updateHouseholdCategorizationRule } from "@/lib/categorization-rules/service";
import { updateCategorizationRuleSchema } from "@/lib/categorization-rules/schema";
import { ruleError } from "../route";

export async function PATCH(request: Request, context: { params: Promise<{ householdId: string; ruleId: string }> }) {
  try {
    const { householdId, ruleId } = await context.params;
    const access = await requireHouseholdAccess(householdId);
    const input = updateCategorizationRuleSchema.parse(await request.json());
    return NextResponse.json({ data: await updateHouseholdCategorizationRule(access, ruleId, input) });
  } catch (error) {
    return ruleError(error);
  }
}
