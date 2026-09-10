import { NextResponse } from "next/server";
import { requireHouseholdAccess } from "@/lib/authorization/household";
import { handleObligationRouteError } from "@/lib/obligations/error-handler";
import { getHouseholdUpcomingSummary } from "@/lib/obligations/service";

type RouteContext = {
  params: Promise<{ householdId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { householdId } = await context.params;
    const auth = await requireHouseholdAccess(householdId);

    const { searchParams } = new URL(request.url);
    const today = searchParams.get("today") ?? undefined;

    const summary = await getHouseholdUpcomingSummary(
      auth,
      today ? { today } : undefined,
    );

    const serialized = {
      upcomingCount: summary.upcomingCount,
      overdueCount: summary.overdueCount,
      paidCount: summary.paidCount,
      upcomingByCurrency: summary.upcomingByCurrency.map((c) => ({
        currency: c.currency,
        totalMinor: c.totalMinor.toString(),
      })),
      overdueByCurrency: summary.overdueByCurrency.map((c) => ({
        currency: c.currency,
        totalMinor: c.totalMinor.toString(),
      })),
    };

    return NextResponse.json(
      { data: serialized },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return handleObligationRouteError(error);
  }
}
