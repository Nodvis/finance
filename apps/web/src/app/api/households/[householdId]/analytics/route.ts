import { NextResponse } from "next/server";

import { HouseholdAccessDeniedError, requireHouseholdAccess } from "@/lib/authorization/household";
import { getHouseholdAnalytics } from "@/lib/analytics/service";

export async function GET(request: Request, { params }: { params: Promise<{ householdId: string }> }) {
  try {
    const { householdId } = await params;
    await requireHouseholdAccess(householdId);
    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const filters = {
      ...(from ? { from: new Date(`${from}T00:00:00.000Z`) } : {}),
      ...(to ? { to: new Date(`${to}T23:59:59.999Z`) } : {}),
    };
    return NextResponse.json({ data: await getHouseholdAnalytics(householdId, filters) });
  } catch (error) {
    if (error instanceof HouseholdAccessDeniedError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Unable to load analytics" }, { status: 500 });
  }
}
