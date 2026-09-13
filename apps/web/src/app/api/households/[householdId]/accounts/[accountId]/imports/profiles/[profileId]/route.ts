import { NextResponse } from "next/server";
import { requireHouseholdAccess } from "@/lib/authorization/household";
import { handleImportRouteError, readJsonBody } from "@/lib/statement-imports/error-handler";
import { updateStatementImportProfileSchema } from "@/lib/statement-imports/schema";
import {
  deleteImportProfile,
  getImportProfile,
  updateImportProfile,
} from "@/lib/statement-imports/service";

type RouteContext = {
  params: Promise<{
    householdId: string;
    accountId: string;
    profileId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { householdId, accountId, profileId } = await context.params;
    const authContext = await requireHouseholdAccess(householdId);

    const data = await getImportProfile({
      context: authContext,
      profileId,
      accountId,
    });

    return NextResponse.json({ data });
  } catch (error) {
    return handleImportRouteError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { householdId, accountId, profileId } = await context.params;
    const authContext = await requireHouseholdAccess(householdId);

    const body = await readJsonBody(request);
    const validated = updateStatementImportProfileSchema.parse(body);

    const data = await updateImportProfile({
      context: authContext,
      profileId,
      routeAccountId: accountId,
      name: validated.name,
      mappingConfig: validated.mappingConfig,
      autoProcessSafe: validated.autoProcessSafe,
      isDefault: validated.isDefault,
      accountId,
    });

    return NextResponse.json({ data });
  } catch (error) {
    return handleImportRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { householdId, accountId, profileId } = await context.params;
    const authContext = await requireHouseholdAccess(householdId);

    await deleteImportProfile({
      context: authContext,
      profileId,
      accountId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleImportRouteError(error);
  }
}
