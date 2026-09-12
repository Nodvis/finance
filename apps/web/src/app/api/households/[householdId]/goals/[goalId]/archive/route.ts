import { NextResponse } from "next/server";
import { requireHouseholdAccess } from "@/lib/authorization/household";
import { archiveSavingsGoalSchema } from "@/lib/savings-goals/schema";
import { handleSavingsGoalRouteError } from "@/lib/savings-goals/error-handler";
import { archiveHouseholdSavingsGoal } from "@/lib/savings-goals/service";

type RouteContext = {
  params: Promise<{ householdId: string; goalId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { householdId, goalId } = await context.params;
    const auth = await requireHouseholdAccess(householdId);

    const json = await request.json();
    const input = archiveSavingsGoalSchema.parse(json);

    const updated = await archiveHouseholdSavingsGoal(auth, goalId, input);

    return NextResponse.json(
      { data: updated },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return handleSavingsGoalRouteError(error);
  }
}
