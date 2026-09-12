import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AccountNotFoundError, LiabilityNotFoundError } from "@nodvis/finance-db";
import { AuthenticationRequiredError } from "@/lib/auth/session";
import {
  HouseholdAccessDeniedError,
  requireHouseholdAccess,
} from "@/lib/authorization/household";
import { recordBalanceObservationSchema } from "@/lib/net-worth/schema";
import { serializeBalanceObservation } from "@/lib/net-worth/serialization";
import {
  listHouseholdBalanceHistory,
  recordHouseholdBalanceObservation,
} from "@/lib/net-worth/service";

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

  if (error instanceof AccountNotFoundError) {
    return NextResponse.json(
      { error: error.message },
      { status: 404 },
    );
  }

  if (error instanceof LiabilityNotFoundError) {
    return NextResponse.json(
      { error: error.message },
      { status: 404 },
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

  if (error instanceof Error && (error.message.includes("Invalid") || error.message.includes("mismatch"))) {
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
    const accountId = url.searchParams.get("accountId") ?? undefined;
    const liabilityId = url.searchParams.get("liabilityId") ?? undefined;
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

    const observations = await listHouseholdBalanceHistory(access, {
      ...(accountId ? { accountId } : {}),
      ...(liabilityId ? { liabilityId } : {}),
      ...(limit !== undefined ? { limit } : {}),
    });

    return NextResponse.json({
      data: observations.map(serializeBalanceObservation),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { householdId } = await context.params;
    const access = await requireHouseholdAccess(householdId);

    const body = await request.json();
    const parsed = recordBalanceObservationSchema.parse(body);

    const observation = await recordHouseholdBalanceObservation(access, parsed);

    return NextResponse.json(
      {
        data: serializeBalanceObservation(observation),
      },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
