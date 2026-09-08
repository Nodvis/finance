import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  InvalidTransferMatchError,
  TransactionAlreadyVoidedError,
  TransactionNotFoundError,
  TransactionVersionConflictError,
} from "@nodvis/finance-db";

import { AuthenticationRequiredError } from "@/lib/auth/session";
import {
  HouseholdAccessDeniedError,
  requireHouseholdAccess,
} from "@/lib/authorization/household";
import { matchTransferSchema } from "@/lib/transfers/schema";
import { matchTransferEntry } from "@/lib/transfers/service";

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
  if (error instanceof TransactionNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (
    error instanceof TransactionVersionConflictError ||
    error instanceof TransactionAlreadyVoidedError
  ) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof InvalidTransferMatchError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: error.issues[0]?.message || "Validation error" },
      { status: 400 },
    );
  }
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Internal server error" },
    { status: 500 },
  );
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { householdId } = await context.params;
    const access = await requireHouseholdAccess(householdId);

    const body = await request.json();
    const parsed = matchTransferSchema.parse(body);

    const result = await matchTransferEntry(access, parsed);

    return NextResponse.json(
      {
        data: {
          transferId: result.transfer.id,
          matchedTransactionId: result.match.matchedTransactionId,
          confidence: result.match.matchConfidence,
          amountMinor: result.transfer.amount.amountMinor.toString(),
          currency: result.transfer.amount.currency,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
