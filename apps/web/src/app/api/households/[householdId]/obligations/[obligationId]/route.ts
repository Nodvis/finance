import { NextResponse } from "next/server";
import { requireHouseholdAccess } from "@/lib/authorization/household";
import {
  cancelObligationSchema,
  calendarDateSchema,
  updateObligationSchema,
} from "@/lib/obligations/schema";
import { handleObligationRouteError } from "@/lib/obligations/error-handler";
import {
  ObligationValidationError,
  cancelHouseholdObligation,
  getHouseholdObligation,
  updateHouseholdObligation,
} from "@/lib/obligations/service";

type RouteContext = {
  params: Promise<{ householdId: string; obligationId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { householdId, obligationId } = await context.params;
    const auth = await requireHouseholdAccess(householdId);

    const { searchParams } = new URL(request.url);
    const rawToday = searchParams.get("today");
    const today = rawToday === null ? undefined : calendarDateSchema.parse(rawToday);

    const obligation = await getHouseholdObligation(
      auth,
      obligationId,
      today,
    );

    return NextResponse.json(
      { data: obligation },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return handleObligationRouteError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { householdId, obligationId } = await context.params;
    const auth = await requireHouseholdAccess(householdId);

    const json = await request.json();
    const input = updateObligationSchema.parse(json);

    const updated = await updateHouseholdObligation(
      auth,
      obligationId,
      input,
    );

    return NextResponse.json(
      { data: updated },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return handleObligationRouteError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { householdId, obligationId } = await context.params;
    const auth = await requireHouseholdAccess(householdId);

    const rawBody = await request.text();
    let version: number;
    if (rawBody.trim() === "") {
      // Empty-body compatibility path: read the current version explicitly.
      const existing = await getHouseholdObligation(auth, obligationId);
      version = existing.version;
    } else {
      let json: unknown;
      try {
        json = JSON.parse(rawBody);
      } catch {
        throw new ObligationValidationError("Invalid cancellation request body");
      }
      version = cancelObligationSchema.parse(json).version;
    }

    const cancelled = await cancelHouseholdObligation(auth, obligationId, {
      version,
    });

    return NextResponse.json(
      { data: cancelled },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return handleObligationRouteError(error);
  }
}
