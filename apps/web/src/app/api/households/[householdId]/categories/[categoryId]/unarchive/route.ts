import { NextResponse } from "next/server";

import { AuthenticationRequiredError } from "@/lib/auth/session";
import {
  HouseholdAccessDeniedError,
  requireHouseholdAccess,
} from "@/lib/authorization/household";
import {
  CategoryNotFoundError,
  unarchiveHouseholdCategoryEntry,
} from "@/lib/categories/service";
import { serializeCategory } from "@/lib/categories/serialization";

type RouteContext = {
  params: Promise<{ householdId: string; categoryId: string }>;
};

export async function POST(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { householdId, categoryId } = await context.params;
    const access = await requireHouseholdAccess(householdId);

    const unarchived = await unarchiveHouseholdCategoryEntry(access, categoryId);
    return NextResponse.json(
      { data: serializeCategory(unarchived) },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { error: "Authentication is required" },
        { status: 401 },
      );
    }
    if (error instanceof HouseholdAccessDeniedError) {
      return NextResponse.json(
        { error: "Household access denied" },
        { status: 403 },
      );
    }
    if (error instanceof CategoryNotFoundError) {
      return NextResponse.json(
        { error: "Category not found in household" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
