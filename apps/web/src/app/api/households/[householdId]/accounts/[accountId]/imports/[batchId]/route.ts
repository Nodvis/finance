import { NextResponse } from "next/server";
import { requireHouseholdAccess } from "@/lib/authorization/household";
import { handleImportRouteError } from "@/lib/statement-imports/error-handler";
import { getStatementImportBatchDetails } from "@/lib/statement-imports/service";

type RouteContext = {
  params: Promise<{
    householdId: string;
    accountId: string;
    batchId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { householdId, batchId } = await context.params;
    const authContext = await requireHouseholdAccess(householdId);

    const result = await getStatementImportBatchDetails({
      context: authContext,
      batchId,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    return handleImportRouteError(error);
  }
}
