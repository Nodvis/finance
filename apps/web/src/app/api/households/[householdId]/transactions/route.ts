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
  DuplicateSubmissionError,
  TransactionAccountNotFoundError,
  TransactionAlreadyVoidedError,
  TransactionCategoryApplicabilityError,
  TransactionCategoryArchivedError,
  TransactionCategoryNotAllowedError,
  TransactionCategoryNotFoundError,
  TransactionCurrencyMismatchError,
  TransactionInvalidPersonError,
  TransactionKindMismatchError,
  TransactionNotFoundError,
  TransactionVersionConflictError,
  createManualTransaction,
  exportManualTransactionsToCsv,
  listManualTransactions,
  queryManualTransactions,
} from "../../../../../lib/transactions/service";

type RouteContext = {
  params: Promise<{ householdId: string }>;
};

export function handleRouteError(error: unknown): NextResponse {
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

  if (error instanceof TransactionNotFoundError) {
    return NextResponse.json(
      { error: error.message },
      { status: 404 },
    );
  }

  if (
    error instanceof TransactionVersionConflictError ||
    error instanceof DuplicateSubmissionError
  ) {
    return NextResponse.json(
      { error: error.message },
      { status: 409 },
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
    error instanceof TransactionAlreadyVoidedError ||
    error instanceof TransactionKindMismatchError ||
    error instanceof SyntaxError
  ) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }

  // Also catch any domain invariant Error thrown during transaction creation/correction
  if (error instanceof Error && (error.message.includes("Transaction") || error.message.includes("Transfer"))) {
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
): Promise<Response> {
  try {
    const { householdId } = await context.params;
    const access = await requireHouseholdAccess(householdId);

    const url = new URL(request.url);
    const queryParams: Record<string, string> = {};
    for (const [key, value] of url.searchParams.entries()) {
      queryParams[key] = value;
    }

    const parsedQuery = listTransactionsQuerySchema.parse(queryParams);

    if (parsedQuery.format === "csv" || parsedQuery.export === "csv") {
      const locale = parsedQuery.locale ?? "en";
      const csv = await exportManualTransactionsToCsv(access, parsedQuery, locale);
      const todayStr = new Date().toISOString().split("T")[0];
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="transactions-${todayStr}.csv"`,
          "Cache-Control": "no-store, no-cache",
        },
      });
    }

    const { transactions, total, limit, offset, page, totalPages, hasMore } =
      await queryManualTransactions(access, parsedQuery);

    return NextResponse.json(
      {
        data: transactions.map(serializeTransaction),
        pagination: {
          total,
          limit,
          offset,
          page,
          totalPages,
          hasMore,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
