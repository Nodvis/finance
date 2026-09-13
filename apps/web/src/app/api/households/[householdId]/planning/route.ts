import { NextResponse } from "next/server";
import { z } from "zod";
import { requireHouseholdAccess, HouseholdAccessDeniedError } from "@/lib/authorization/household";
import { AuthenticationRequiredError } from "@/lib/auth/session";
import { getHouseholdPlanning } from "@/lib/planning/service";
import { calendarDateSchema } from "@/lib/obligations/schema";
import { isValidCalendarDate } from "@nodvis/finance-domain";

const querySchema = z.object({
  strategy: z.enum(["stabilization", "50-30-20", "pay-yourself-first", "debt-avalanche", "debt-snowball", "sinking-fund"]).default("stabilization"),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).refine((value) => isValidCalendarDate(`${value}-01`), "Invalid calendar month").default(new Date().toISOString().slice(0, 7)),
  asOf: calendarDateSchema.default(new Date().toISOString().slice(0, 10)),
  horizon: z.enum(["7", "30"]).default("30"),
});

export async function GET(request: Request, { params }: { params: Promise<{ householdId: string }> }) {
  try {
    const { householdId } = await params;
    const context = await requireHouseholdAccess(householdId);
    const url = new URL(request.url);
    const query = querySchema.parse(Object.fromEntries(url.searchParams));
    const data = await getHouseholdPlanning(context, { strategy: query.strategy, month: query.month, asOf: query.asOf, horizonDays: query.horizon === "7" ? 7 : 30 });
    return NextResponse.json({ data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: "Authentication is required" }, { status: 401 });
    if (error instanceof HouseholdAccessDeniedError) return NextResponse.json({ error: "Household access denied" }, { status: 403 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Validation error", issues: error.issues }, { status: 400 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
