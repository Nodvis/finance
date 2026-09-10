import { NextResponse } from "next/server";
import { requireHouseholdAccess } from "@/lib/authorization/household";
import {
  createObligationSchema,
  obligationQuerySchema,
} from "@/lib/obligations/schema";
import { handleObligationRouteError } from "@/lib/obligations/error-handler";
import {
  createHouseholdObligation,
  listHouseholdObligations,
} from "@/lib/obligations/service";

type RouteContext = {
  params: Promise<{ householdId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { householdId } = await context.params;
    const auth = await requireHouseholdAccess(householdId);

    const { searchParams } = new URL(request.url);
    const query = obligationQuerySchema.parse({
      status: searchParams.get("status") ?? undefined,
      scope: searchParams.get("scope") ?? undefined,
      currency: searchParams.get("currency") ?? undefined,
      sortBy: searchParams.get("sortBy") ?? undefined,
      sortOrder: searchParams.get("sortOrder") ?? undefined,
      sort: searchParams.get("sort") ?? undefined,
      today: searchParams.get("today") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      offset: searchParams.get("offset") ?? undefined,
    });

    const obligations = await listHouseholdObligations(auth, query);

    return NextResponse.json(
      { data: obligations },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return handleObligationRouteError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { householdId } = await context.params;
    const auth = await requireHouseholdAccess(householdId);

    const json = await request.json();
    const input = createObligationSchema.parse(json);

    const created = await createHouseholdObligation(auth, input);

    return NextResponse.json(
      { data: created },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return handleObligationRouteError(error);
  }
}
