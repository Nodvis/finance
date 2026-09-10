import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { calendarDateSchema } from "@/lib/obligations/schema";

import { HouseholdAccessDeniedError, requireHouseholdAccess } from "@/lib/authorization/household";
import { getHouseholdAnalytics } from "@/lib/analytics/service";

const analyticsQuerySchema = z.object({
  from: calendarDateSchema.optional(),
  to: calendarDateSchema.optional(),
}).superRefine((query, ctx) => {
  if ((query.from === undefined) !== (query.to === undefined)) {
    ctx.addIssue({ code: "custom", path: [query.to === undefined ? "to" : "from"], message: "from and to must be provided together" });
  } else if (query.from !== undefined && query.to !== undefined && query.from > query.to) {
    ctx.addIssue({ code: "custom", path: ["from"], message: "from must not be after to" });
  }
});

export async function GET(request: Request, { params }: { params: Promise<{ householdId: string }> }) {
  try {
    const { householdId } = await params;
    const context = await requireHouseholdAccess(householdId);
    const url = new URL(request.url);
    const query = analyticsQuerySchema.parse({
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });
    const filters = {
      ...(query.from ? { from: new Date(`${query.from}T00:00:00.000Z`) } : {}),
      ...(query.to ? { to: new Date(`${query.to}T23:59:59.999Z`) } : {}),
    };
    return NextResponse.json({ data: await getHouseholdAnalytics(context, filters) });
  } catch (error) {
    if (error instanceof HouseholdAccessDeniedError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error instanceof ZodError) return NextResponse.json({ error: "Invalid query" }, { status: 400 });
    return NextResponse.json({ error: "Unable to load analytics" }, { status: 500 });
  }
}
