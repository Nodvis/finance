import { NextResponse } from "next/server";

import { requireHouseholdAccess } from "@/lib/authorization/household";
import { voidTransactionSchema } from "@/lib/transactions/schema";
import { serializeTransaction } from "@/lib/transactions/serialization";
import { voidManualTransaction } from "@/lib/transactions/service";
import { handleRouteError } from "../../route";

type RouteContext = {
  params: Promise<{ householdId: string; transactionId: string }>;
};

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { householdId, transactionId } = await context.params;
    const access = await requireHouseholdAccess(householdId);

    let rawBody: unknown = {};
    try {
      rawBody = await request.json();
    } catch {
      // Body may be empty or invalid JSON, will be caught by Zod if required fields missing
      rawBody = {};
    }

    const parsed = voidTransactionSchema.parse(rawBody);
    const voided = await voidManualTransaction(access, transactionId, parsed);

    return NextResponse.json(
      { data: serializeTransaction(voided) },
      { status: 200 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
