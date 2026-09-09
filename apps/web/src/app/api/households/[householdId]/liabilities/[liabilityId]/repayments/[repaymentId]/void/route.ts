import { NextResponse } from "next/server";

import { requireHouseholdAccess } from "@/lib/authorization/household";
import { voidHouseholdLiabilityRepayment } from "@/lib/liabilities/service";
import { voidLiabilityRepaymentSchema } from "@/lib/liabilities/schema";
import { serializeRepayment } from "@/lib/liabilities/serialization";
import { handleRouteError } from "../../../route";

type RouteContext = {
  params: Promise<{
    householdId: string;
    liabilityId: string;
    repaymentId: string;
  }>;
};

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { householdId, liabilityId, repaymentId } = await context.params;
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

    const parsed = voidLiabilityRepaymentSchema.parse(rawBody);
    const voided = await voidHouseholdLiabilityRepayment(
      access,
      liabilityId,
      repaymentId,
      parsed,
    );

    return NextResponse.json(
      { data: serializeRepayment(voided) },
      { status: 200 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
