import { NextResponse } from "next/server";
import { requireHouseholdAccess } from "@/lib/authorization/household";
import { unarchiveSavingsGoalSchema } from "@/lib/savings-goals/schema";
import { handleSavingsGoalRouteError } from "@/lib/savings-goals/error-handler";
import { unarchiveHouseholdSavingsGoal } from "@/lib/savings-goals/service";

type RouteContext = {
  params: Promise<{ householdId: string; goalId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { householdId, goalId } = await context.params;
    const auth = await requireHouseholdAccess(householdId);

    const json = await request.json();
    const input = unarchiveSavingsGoalSchema.parse(json);

    const updated = await unarchiveHouseholdSavingsGoal(auth, goalId, input);

    return NextResponse.json(
      { data: updated },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return handleSavingsGoalRouteError(error);
  }
}
