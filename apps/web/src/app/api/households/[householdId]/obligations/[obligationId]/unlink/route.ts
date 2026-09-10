import { NextResponse } from "next/server";
import { requireHouseholdAccess } from "@/lib/authorization/household";
import { unlinkObligationSchema } from "@/lib/obligations/schema";
import { handleObligationRouteError } from "@/lib/obligations/error-handler";
import { unlinkHouseholdObligation } from "@/lib/obligations/service";

type RouteContext = {
  params: Promise<{ householdId: string; obligationId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { householdId, obligationId } = await context.params;
    const auth = await requireHouseholdAccess(householdId);

    const json = await request.json();
    const input = unlinkObligationSchema.parse(json);

    const unlinked = await unlinkHouseholdObligation(
      auth,
      obligationId,
      input,
    );

    return NextResponse.json(
      { data: unlinked },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return handleObligationRouteError(error);
  }
}
