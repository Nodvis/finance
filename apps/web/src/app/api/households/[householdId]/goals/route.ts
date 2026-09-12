import { NextResponse } from "next/server";
import { requireHouseholdAccess } from "@/lib/authorization/household";
import {
  createSavingsGoalSchema,
  savingsGoalQuerySchema,
} from "@/lib/savings-goals/schema";
import { handleSavingsGoalRouteError } from "@/lib/savings-goals/error-handler";
import {
  createHouseholdSavingsGoal,
  listHouseholdSavingsGoals,
} from "@/lib/savings-goals/service";

type RouteContext = {
  params: Promise<{ householdId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { householdId } = await context.params;
    const auth = await requireHouseholdAccess(householdId);

    const { searchParams } = new URL(request.url);
    const query = savingsGoalQuerySchema.parse({
      status: searchParams.get("status") ?? undefined,
      accountId: searchParams.get("accountId") ?? undefined,
      sortBy: searchParams.get("sortBy") ?? undefined,
      sortOrder: searchParams.get("sortOrder") ?? undefined,
      asOfDate: searchParams.get("asOfDate") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      offset: searchParams.get("offset") ?? undefined,
    });

    const goals = await listHouseholdSavingsGoals(auth, query);

    return NextResponse.json(
      { data: goals },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return handleSavingsGoalRouteError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { householdId } = await context.params;
    const auth = await requireHouseholdAccess(householdId);

    const json = await request.json();
    const input = createSavingsGoalSchema.parse(json);

    const created = await createHouseholdSavingsGoal(auth, input);

    return NextResponse.json(
      { data: created },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return handleSavingsGoalRouteError(error);
  }
}
