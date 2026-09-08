import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthenticationRequiredError } from "../../../../../lib/auth/session";
import {
  HouseholdAccessDeniedError,
  requireHouseholdAccess,
} from "../../../../../lib/authorization/household";
import {
  createTransactionSchema,
  listTransactionsQuerySchema,
} from "../../../../../lib/transactions/schema";
import { serializeTransaction } from "../../../../../lib/transactions/serialization";
import {
  createManualTransaction,
  listManualTransactions,
  TransactionAccountNotFoundError,
  TransactionCategoryApplicabilityError,
  TransactionCategoryArchivedError,
  TransactionCategoryNotAllowedError,
  TransactionCategoryNotFoundError,
  TransactionCurrencyMismatchError,
  TransactionInvalidPersonError,
} from "../../../../../lib/transactions/service";

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

  if (
    error instanceof TransactionAccountNotFoundError ||
    error instanceof TransactionCategoryNotFoundError ||
    error instanceof TransactionCategoryArchivedError ||
    error instanceof TransactionCategoryApplicabilityError ||
    error instanceof TransactionCategoryNotAllowedError ||
    error instanceof TransactionCurrencyMismatchError ||
    error instanceof TransactionInvalidPersonError ||
    error instanceof SyntaxError
  ) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }

  // Also catch any domain invariant Error thrown during transaction creation
  if (error instanceof Error && error.message.includes("Transaction")) {
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

    const parsed = createTransactionSchema.parse(rawBody);
    const created = await createManualTransaction(access, parsed);

    return NextResponse.json(
      { data: serializeTransaction(created) },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
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

    const accountId = url.searchParams.get("accountId");
    if (accountId) queryParams.accountId = accountId;

    const categoryId = url.searchParams.get("categoryId");
    if (categoryId) queryParams.categoryId = categoryId;

    const limit = url.searchParams.get("limit");
    if (limit) queryParams.limit = limit;

    const offset = url.searchParams.get("offset");
    if (offset) queryParams.offset = offset;

    const parsedQuery = listTransactionsQuerySchema.parse(queryParams);
    const transactions = await listManualTransactions(access, parsedQuery);

    return NextResponse.json(
      { data: transactions.map(serializeTransaction) },
      { status: 200 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
