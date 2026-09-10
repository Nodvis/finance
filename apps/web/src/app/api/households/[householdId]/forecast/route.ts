import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthenticationRequiredError } from "@/lib/auth/session";
import { HouseholdAccessDeniedError, requireHouseholdAccess } from "@/lib/authorization/household";
import { getHouseholdCashForecast } from "@/lib/forecast/service";
import { forecastQuerySchema } from "@/lib/forecast/schema";

export async function GET(request: Request, { params }: { params: Promise<{ householdId: string }> }) {
  try {
    const { householdId } = await params;
    const context = await requireHouseholdAccess(householdId);
    const url = new URL(request.url);
    const query = forecastQuerySchema.parse({
      horizon: url.searchParams.get("horizon") ?? undefined,
      asOf: url.searchParams.get("asOf") ?? undefined,
    });
    const forecast = await getHouseholdCashForecast(context, {
      asOf: query.asOf ?? new Date().toISOString().slice(0, 10),
      horizonDays: query.horizon === "30" ? 30 : 7,
    });
    return NextResponse.json({
      data: {
        ...forecast,
        byCurrency: forecast.byCurrency.map((item) => ({
          ...item,
          availableCashMinor: item.availableCashMinor.toString(),
          includedObligationsMinor: item.includedObligationsMinor.toString(),
          projectedCashMinor: item.projectedCashMinor.toString(),
        })),
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: "Authentication is required" }, { status: 401 });
    if (error instanceof HouseholdAccessDeniedError) return NextResponse.json({ error: "Household access denied" }, { status: 403 });
    if (error instanceof ZodError) return NextResponse.json({ error: "Validation error", issues: error.issues }, { status: 400 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
