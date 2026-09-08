import { NextResponse } from "next/server";
import { requireHouseholdAccess } from "@/lib/authorization/household";
import { handleImportRouteError } from "@/lib/statement-imports/error-handler";
import { createStatementImportProfileSchema } from "@/lib/statement-imports/schema";
import {
  createImportProfile,
  listImportProfiles,
} from "@/lib/statement-imports/service";

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

    const data = await listImportProfiles({
      context: authContext,
      accountId,
    });

    return NextResponse.json({ data });
  } catch (error) {
    return handleImportRouteError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { householdId, accountId } = await context.params;
    const authContext = await requireHouseholdAccess(householdId);

    const body = await request.json();
    const validated = createStatementImportProfileSchema.parse(body);

    const data = await createImportProfile({
      context: authContext,
      name: validated.name,
      mappingConfig: validated.mappingConfig,
      autoProcessSafe: validated.autoProcessSafe,
      isDefault: validated.isDefault,
      accountId:
        validated.accountId !== undefined ? validated.accountId : accountId,
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return handleImportRouteError(error);
  }
}
