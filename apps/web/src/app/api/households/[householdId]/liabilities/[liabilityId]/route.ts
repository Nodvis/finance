import { NextResponse } from "next/server";

import { requireHouseholdAccess } from "@/lib/authorization/household";
import {
  getHouseholdLiability,
  updateHouseholdLiabilityEntry,
} from "@/lib/liabilities/service";
import { updateLiabilitySchema } from "@/lib/liabilities/schema";
import { serializeLiability } from "@/lib/liabilities/serialization";
import { handleRouteError } from "../route";

export { handleRouteError } from "../route";

type RouteContext = {
  params: Promise<{ householdId: string; liabilityId: string }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { householdId, liabilityId } = await context.params;
    const access = await requireHouseholdAccess(householdId);

    const liability = await getHouseholdLiability(access, liabilityId);

    return NextResponse.json(
      { data: serializeLiability(liability) },
      { status: 200 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(
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

    const parsed = updateLiabilitySchema.parse(rawBody);
    const updated = await updateHouseholdLiabilityEntry(
      access,
      liabilityId,
      parsed,
    );

    return NextResponse.json(
      { data: serializeLiability(updated) },
      { status: 200 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
