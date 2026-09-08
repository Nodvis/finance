import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthenticationRequiredError } from "@/lib/auth/session";
import {
  HouseholdAccessDeniedError,
  requireHouseholdAccess,
} from "@/lib/authorization/household";
import { overviewQuerySchema } from "@/lib/overview/schema";
import { serializeOverview } from "@/lib/overview/serialization";
import { getHouseholdOverview } from "@/lib/overview/service";

type RouteContext = {
  params: Promise<{ householdId: string }>;
};

function handleRouteError(error: unknown): NextResponse {
  if (error instanceof AuthenticationRequiredError) {
    return NextResponse.json(
      { error: "Authentication is required" },
      { status: 401 },
    );
  }

  if (error instanceof HouseholdAccessDeniedError) {
    return NextResponse.json(
      { error: "Household access denied" },
      { status: 403 },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Validation error",
        issues: error.issues,
      },
      { status: 400 },
    );
  }

  if (error instanceof Error && error.message.includes("Invalid")) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 },
    );
  }

  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 },
  );
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { householdId } = await context.params;
    const access = await requireHouseholdAccess(householdId);

    const url = new URL(request.url);
    const query = overviewQuerySchema.parse({
      month: url.searchParams.get("month") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });

    const overview = await getHouseholdOverview(access, query);

    return NextResponse.json({
      data: serializeOverview(overview),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
