import { NextResponse } from "next/server";

import { requireHouseholdAccess } from "@/lib/authorization/household";
import { unarchiveHouseholdLiabilityEntry } from "@/lib/liabilities/service";
import { unarchiveLiabilitySchema } from "@/lib/liabilities/schema";
import { serializeLiability } from "@/lib/liabilities/serialization";
import { handleRouteError } from "../../route";

type RouteContext = {
  params: Promise<{ householdId: string; liabilityId: string }>;
};

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { householdId, liabilityId } = await context.params;
    const access = await requireHouseholdAccess(householdId);

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    const parsed = unarchiveLiabilitySchema.parse(rawBody);
    const unarchived = await unarchiveHouseholdLiabilityEntry(
      access,
      liabilityId,
      parsed,
    );

    return NextResponse.json(
      { data: serializeLiability(unarchived) },
      { status: 200 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
