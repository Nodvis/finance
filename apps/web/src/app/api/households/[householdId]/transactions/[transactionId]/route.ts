import { NextResponse } from "next/server";

import { requireHouseholdAccess } from "@/lib/authorization/household";
import { correctTransactionSchema } from "@/lib/transactions/schema";
import { serializeTransaction } from "@/lib/transactions/serialization";
import {
  correctManualTransaction,
  getManualTransaction,
} from "@/lib/transactions/service";
import { handleRouteError } from "../route";

type RouteContext = {
  params: Promise<{ householdId: string; transactionId: string }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { householdId, transactionId } = await context.params;
    const access = await requireHouseholdAccess(householdId);

    const tx = await getManualTransaction(access, transactionId);

    return NextResponse.json(
      { data: serializeTransaction(tx) },
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
    const { householdId, transactionId } = await context.params;
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

    const parsed = correctTransactionSchema.parse(rawBody);
    const updated = await correctManualTransaction(
      access,
      transactionId,
      parsed,
    );

    return NextResponse.json(
      { data: serializeTransaction(updated) },
      { status: 200 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
