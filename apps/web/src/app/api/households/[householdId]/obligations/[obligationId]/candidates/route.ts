import { NextResponse } from "next/server";
import { requireHouseholdAccess } from "@/lib/authorization/household";
import { handleObligationRouteError } from "@/lib/obligations/error-handler";
import { listHouseholdObligationCandidates } from "@/lib/obligations/service";

type RouteContext = {
  params: Promise<{ householdId: string; obligationId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { householdId, obligationId } = await context.params;
    const auth = await requireHouseholdAccess(householdId);

    const candidates = await listHouseholdObligationCandidates(
      auth,
      obligationId,
    );

    return NextResponse.json(
      { data: candidates },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return handleObligationRouteError(error);
  }
}
