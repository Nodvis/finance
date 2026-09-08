import { NextResponse } from "next/server";

import { requireHouseholdAccess } from "@/lib/authorization/household";
import { getTransactionHistory } from "@/lib/transactions/service";
import { handleRouteError } from "../../route";

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

    const result = await getTransactionHistory(access, transactionId);

    return NextResponse.json(
      { data: result },
      { status: 200 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
