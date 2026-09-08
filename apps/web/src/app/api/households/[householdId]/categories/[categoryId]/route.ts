import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthenticationRequiredError } from "@/lib/auth/session";
import {
  HouseholdAccessDeniedError,
  requireHouseholdAccess,
} from "@/lib/authorization/household";
import {
  CategoryNotFoundError,
  getHouseholdCategory,
  renameHouseholdCategoryEntry,
} from "@/lib/categories/service";
import { renameCategorySchema } from "@/lib/categories/schema";
import { serializeCategory } from "@/lib/categories/serialization";

type RouteContext = {
  params: Promise<{ householdId: string; categoryId: string }>;
};

function handleRouteError(error: unknown): NextResponse {
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

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Validation error",
        issues: error.issues,
      },
      { status: 400 },
    );
  }

  if (error instanceof Error && error.message.includes("Invalid")) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 },
    );
  }

  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 },
  );
}

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { householdId, categoryId } = await context.params;
    const access = await requireHouseholdAccess(householdId);

    const category = await getHouseholdCategory(access, categoryId);

    return NextResponse.json(
      { data: serializeCategory(category) },
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
    const { householdId, categoryId } = await context.params;
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

    const parsed = renameCategorySchema.parse(rawBody);
    const updated = await renameHouseholdCategoryEntry(
      access,
      categoryId,
      parsed,
    );

    return NextResponse.json(
      { data: serializeCategory(updated) },
      { status: 200 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
