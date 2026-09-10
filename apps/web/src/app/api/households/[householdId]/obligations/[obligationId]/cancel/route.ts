import { NextResponse } from "next/server";
import { requireHouseholdAccess } from "@/lib/authorization/household";
import { cancelObligationSchema } from "@/lib/obligations/schema";
import { handleObligationRouteError } from "@/lib/obligations/error-handler";
import {
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

    let version: number;
    try {
      const json = await request.json();
      const input = cancelObligationSchema.parse(json);
      version = input.version;
    } catch {
      const existing = await getHouseholdObligation(auth, obligationId);
      version = existing.version;
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
