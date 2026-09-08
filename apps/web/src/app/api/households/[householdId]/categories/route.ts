import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthenticationRequiredError } from "@/lib/auth/session";
import {
  HouseholdAccessDeniedError,
  requireHouseholdAccess,
} from "@/lib/authorization/household";
import {
  createHouseholdCategoryEntry,
  listHouseholdCategories,
} from "@/lib/categories/service";
import {
  createCategorySchema,
  listCategoriesQuerySchema,
} from "@/lib/categories/schema";
import { serializeCategory } from "@/lib/categories/serialization";

type RouteContext = {
  params: Promise<{ householdId: string }>;
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
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { householdId } = await context.params;
    const access = await requireHouseholdAccess(householdId);

    const url = new URL(request.url);
    const queryParams: Record<string, string> = {};

    const includeArchived = url.searchParams.get("includeArchived");
    if (includeArchived) queryParams.includeArchived = includeArchived;

    const applicability = url.searchParams.get("applicability");
    if (applicability) queryParams.applicability = applicability;

    const parsedQuery = listCategoriesQuerySchema.parse(queryParams);
    const categories = await listHouseholdCategories(access, parsedQuery);

    return NextResponse.json(
      { data: categories.map(serializeCategory) },
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
    const { householdId } = await context.params;
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

    const parsed = createCategorySchema.parse(rawBody);
    const created = await createHouseholdCategoryEntry(access, parsed);

    return NextResponse.json(
      { data: serializeCategory(created) },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
