import { NextResponse } from "next/server";

import { requireHouseholdAccess } from "@/lib/authorization/household";
import {
  listHouseholdLiabilityRepayments,
  recordHouseholdLiabilityRepayment,
} from "@/lib/liabilities/service";
import {
  createLiabilityRepaymentSchema,
  listLiabilityRepaymentsQuerySchema,
} from "@/lib/liabilities/schema";
import { serializeRepayment } from "@/lib/liabilities/serialization";
import { serializeTransaction } from "@/lib/transactions/serialization";
import { handleRouteError } from "../route";

type RouteContext = {
  params: Promise<{ householdId: string; liabilityId: string }>;
};

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { householdId, liabilityId } = await context.params;
    const access = await requireHouseholdAccess(householdId);

    const url = new URL(request.url);
    const queryParams: Record<string, string> = {};

    const includeVoided = url.searchParams.get("includeVoided");
    if (includeVoided) queryParams.includeVoided = includeVoided;

    const parsedQuery = listLiabilityRepaymentsQuerySchema.parse(queryParams);
    const repayments = await listHouseholdLiabilityRepayments(
      access,
      liabilityId,
      parsedQuery,
    );

    return NextResponse.json(
      { data: repayments.map(serializeRepayment) },
      { status: 200 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { householdId, liabilityId } = await context.params;
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

    const parsed = createLiabilityRepaymentSchema.parse(rawBody);
    const { repayment, transaction } = await recordHouseholdLiabilityRepayment(
      access,
      liabilityId,
      parsed,
    );

    return NextResponse.json(
      {
        data: {
          repayment: serializeRepayment(repayment),
          transaction: transaction ? serializeTransaction(transaction) : null,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
