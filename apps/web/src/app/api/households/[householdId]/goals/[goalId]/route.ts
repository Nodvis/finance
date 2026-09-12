import { NextResponse } from "next/server";
import { requireHouseholdAccess } from "@/lib/authorization/household";
import {
  archiveSavingsGoalSchema,
  calendarDateSchema,
  updateSavingsGoalSchema,
} from "@/lib/savings-goals/schema";
import { handleSavingsGoalRouteError } from "@/lib/savings-goals/error-handler";
import {
  archiveHouseholdSavingsGoal,
  getHouseholdSavingsGoal,
  updateHouseholdSavingsGoal,
} from "@/lib/savings-goals/service";

type RouteContext = {
  params: Promise<{ householdId: string; goalId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { householdId, goalId } = await context.params;
    const auth = await requireHouseholdAccess(householdId);

    const { searchParams } = new URL(request.url);
    const rawAsOf = searchParams.get("asOfDate");
    const asOfDate = rawAsOf ? calendarDateSchema.parse(rawAsOf) : undefined;

    const goal = await getHouseholdSavingsGoal(auth, goalId, asOfDate);

    return NextResponse.json(
      { data: goal },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return handleSavingsGoalRouteError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { householdId, goalId } = await context.params;
    const auth = await requireHouseholdAccess(householdId);

    const json = await request.json();
    const input = updateSavingsGoalSchema.parse(json);

    const updated = await updateHouseholdSavingsGoal(auth, goalId, input);

    return NextResponse.json(
      { data: updated },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return handleSavingsGoalRouteError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { householdId, goalId } = await context.params;
    const auth = await requireHouseholdAccess(householdId);

    const rawBody = await request.text();
    let version: number;
    if (rawBody.trim() === "") {
      const existing = await getHouseholdSavingsGoal(auth, goalId);
      version = existing.version;
    } else {
      let json: unknown;
      try {
        json = JSON.parse(rawBody);
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON body" },
          { status: 400 },
        );
      }
      version = archiveSavingsGoalSchema.parse(json).version;
    }

    const archived = await archiveHouseholdSavingsGoal(auth, goalId, {
      version,
    });

    return NextResponse.json(
      { data: archived },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return handleSavingsGoalRouteError(error);
  }
}
