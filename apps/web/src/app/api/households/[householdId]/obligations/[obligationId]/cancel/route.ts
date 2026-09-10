import { NextResponse } from "next/server";
import { requireHouseholdAccess } from "@/lib/authorization/household";
import { cancelObligationSchema } from "@/lib/obligations/schema";
import { handleObligationRouteError } from "@/lib/obligations/error-handler";
import {
  ObligationValidationError,
  cancelHouseholdObligation,
  getHouseholdObligation,
} from "@/lib/obligations/service";

type RouteContext = {
  params: Promise<{ householdId: string; obligationId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { householdId, obligationId } = await context.params;
    const auth = await requireHouseholdAccess(householdId);

    const rawBody = await request.text();
    let version: number;
    if (rawBody.trim() === "") {
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
