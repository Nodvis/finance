import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthenticationRequiredError } from "@/lib/auth/session";
import {
  HouseholdAccessDeniedError,
  requireHouseholdAccess,
} from "@/lib/authorization/household";
import {
  BnplPurchaseFacilityError,
  createBnplPurchaseRecord,
  listBnplPurchasesByHousehold,
  serializeBnplPurchase,
} from "@nodvis/finance-db";
import { currencyCode, money, transactionId } from "@nodvis/finance-domain";

import {
  bnplPurchaseCreateSchema,
  bnplPurchaseQuerySchema,
} from "@/lib/bnpl/schema";

type RouteContext = { params: Promise<{ householdId: string }> };

function errorResponse(error: unknown) {
  if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: error.message }, { status: 401 });
  if (error instanceof HouseholdAccessDeniedError) return NextResponse.json({ error: "Household access denied" }, { status: 403 });
  if (error instanceof ZodError) return NextResponse.json({ error: "Validation error", issues: error.issues }, { status: 400 });
  if (error instanceof BnplPurchaseFacilityError) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ error: "Unable to save BNPL purchase" }, { status: 500 });
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { householdId } = await context.params;
    await requireHouseholdAccess(householdId);
    const query = bnplPurchaseQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const rows = await listBnplPurchasesByHousehold(householdId, {
      ...(query.facilityId ? { facilityId: query.facilityId } : {}),
      includeVoided: query.includeVoided === "true",
    });
    return NextResponse.json({ data: rows.map(serializeBnplPurchase) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { householdId } = await context.params;
    await requireHouseholdAccess(householdId);
    const input = bnplPurchaseCreateSchema.parse(await request.json());
    const currency = currencyCode(input.currency);
    const row = await createBnplPurchaseRecord({
      householdId,
      creditFacilityId: input.creditFacilityId,
      provider: input.provider,
      product: input.product,
      merchant: input.merchant,
      description: input.description ?? null,
      purchaseDate: new Date(input.purchaseDate),
      financingDate: input.financingDate ? new Date(input.financingDate) : new Date(input.purchaseDate),
      originalAmountMinor: BigInt(input.originalAmountMinor),
      financedAmountMinor: BigInt(input.financedAmountMinor),
      currency,
      observedOutstanding: input.observedOutstandingMinor == null ? null : money(BigInt(input.observedOutstandingMinor), currency),
      observedOutstandingAt: input.observedOutstandingAt ? new Date(input.observedOutstandingAt) : null,
      paymentModel: input.paymentModel ?? "pay_in_30",
      status: input.status ?? "active",
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      principalAmount: input.principalMinor == null ? null : money(BigInt(input.principalMinor), currency),
      interestAmount: input.interestMinor == null ? null : money(BigInt(input.interestMinor), currency),
      feeAmount: input.feeMinor == null ? null : money(BigInt(input.feeMinor), currency),
      transactionId: input.transactionId ? transactionId(input.transactionId) : null,
    });
    return NextResponse.json({ data: serializeBnplPurchase(row) }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
