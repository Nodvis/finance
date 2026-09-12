import { NextResponse } from "next/server";
import { requireHouseholdAccess } from "@/lib/authorization/household";
import { calendarDateSchema } from "@/lib/savings-goals/schema";
import { handleSavingsGoalRouteError } from "@/lib/savings-goals/error-handler";
import { getHouseholdSavingsGoalsOverview } from "@/lib/savings-goals/service";

type RouteContext = {
  params: Promise<{ householdId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { householdId } = await context.params;
    const auth = await requireHouseholdAccess(householdId);

    const { searchParams } = new URL(request.url);
    const rawAsOf = searchParams.get("asOfDate");
    const asOfDate = rawAsOf ? calendarDateSchema.parse(rawAsOf) : undefined;

    const summary = await getHouseholdSavingsGoalsOverview(auth, asOfDate);

    return NextResponse.json(
      { data: summary },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return handleSavingsGoalRouteError(error);
  }
}
