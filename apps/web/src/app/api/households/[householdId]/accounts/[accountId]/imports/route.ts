import { NextResponse } from "next/server";
import { requireHouseholdAccess } from "@/lib/authorization/household";
import { handleImportRouteError } from "@/lib/statement-imports/error-handler";
import { listStatementImportBatchesForAccount } from "@/lib/statement-imports/service";

type RouteContext = {
  params: Promise<{
    householdId: string;
    accountId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { householdId, accountId } = await context.params;
    const authContext = await requireHouseholdAccess(householdId);

    const result = await listStatementImportBatchesForAccount({
      context: authContext,
      accountId,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    return handleImportRouteError(error);
  }
}
