import { NextResponse } from "next/server";
import { requireHouseholdAccess } from "@/lib/authorization/household";
import { matchObligationSchema } from "@/lib/obligations/schema";
import { handleObligationRouteError } from "@/lib/obligations/error-handler";
import { matchHouseholdObligation } from "@/lib/obligations/service";

type RouteContext = {
  params: Promise<{ householdId: string; obligationId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { householdId, obligationId } = await context.params;
    const auth = await requireHouseholdAccess(householdId);

    const json = await request.json();
    const input = matchObligationSchema.parse(json);

    const matched = await matchHouseholdObligation(
      auth,
      obligationId,
      input,
    );

    return NextResponse.json(
      { data: matched },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return handleObligationRouteError(error);
  }
}
