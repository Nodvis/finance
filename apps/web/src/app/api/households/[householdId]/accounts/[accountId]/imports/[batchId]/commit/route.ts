import { NextResponse } from "next/server";
import { requireHouseholdAccess } from "@/lib/authorization/household";
import { handleImportRouteError } from "@/lib/statement-imports/error-handler";
import { commitImportBatchSchema } from "@/lib/statement-imports/schema";
import { commitStatementImport } from "@/lib/statement-imports/service";

type RouteContext = {
  params: Promise<{
    householdId: string;
    accountId: string;
    batchId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { householdId, accountId, batchId } = await context.params;
    const authContext = await requireHouseholdAccess(householdId);

    const body = await request.json();
    const { selectedRowIndices } = commitImportBatchSchema.parse(body);

    const result = await commitStatementImport({
      context: authContext,
      accountId,
      batchId,
      selectedRowIndices,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    return handleImportRouteError(error);
  }
}
