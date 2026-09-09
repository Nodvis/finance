import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  AuthenticationRequiredError,
} from "@/lib/auth/session";
import { HouseholdAccessDeniedError, requireHouseholdAccess } from "@/lib/authorization/household";
import { bnplPurchaseUpdateSchema, bnplPurchaseVoidSchema } from "@/lib/bnpl/schema";
import {
  BnplPurchaseFacilityError,
  BnplPurchaseNotFoundError,
  BnplPurchaseVersionConflictError,
  getBnplPurchase,
  serializeBnplPurchase,
  updateBnplPurchaseRecord,
  voidBnplPurchaseRecord,
} from "@nodvis/finance-db";
import { money, transactionId } from "@nodvis/finance-domain";

type RouteContext = { params: Promise<{ householdId: string; purchaseId: string }> };

function errorResponse(error: unknown) {
  if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: error.message }, { status: 401 });
  if (error instanceof HouseholdAccessDeniedError) return NextResponse.json({ error: "Household access denied" }, { status: 403 });
  if (error instanceof BnplPurchaseNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
  if (error instanceof BnplPurchaseVersionConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof ZodError) return NextResponse.json({ error: "Validation error", issues: error.issues }, { status: 400 });
  if (error instanceof BnplPurchaseFacilityError) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ error: "Unable to update BNPL purchase" }, { status: 500 });
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { householdId, purchaseId } = await context.params;
    await requireHouseholdAccess(householdId);
    return NextResponse.json({ data: serializeBnplPurchase(await getBnplPurchase(householdId, purchaseId)) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { householdId, purchaseId } = await context.params;
    await requireHouseholdAccess(householdId);
    const input = bnplPurchaseUpdateSchema.parse(await request.json());
    const currency = (await getBnplPurchase(householdId, purchaseId)).currency;
    const updateInput = {
      ...(input.provider !== undefined ? { provider: input.provider } : {}),
      ...(input.product !== undefined ? { product: input.product } : {}),
      ...(input.merchant !== undefined ? { merchant: input.merchant } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.purchaseDate !== undefined ? { purchaseDate: new Date(input.purchaseDate) } : {}),
      ...(input.financingDate !== undefined ? { financingDate: new Date(input.financingDate) } : {}),
      ...(input.originalAmountMinor !== undefined ? { originalAmountMinor: BigInt(input.originalAmountMinor) } : {}),
      ...(input.financedAmountMinor !== undefined ? { financedAmountMinor: BigInt(input.financedAmountMinor) } : {}),
      ...(input.observedOutstandingMinor !== undefined ? { observedOutstanding: input.observedOutstandingMinor === null ? null : BigInt(input.observedOutstandingMinor) } : {}),
      ...(input.observedOutstandingAt !== undefined ? { observedOutstandingAt: input.observedOutstandingAt === null ? null : new Date(input.observedOutstandingAt) } : {}),
      ...(input.paymentModel !== undefined ? { paymentModel: input.paymentModel } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.dueDate !== undefined ? { dueDate: input.dueDate === null ? null : new Date(input.dueDate) } : {}),
      ...(input.principalMinor !== undefined ? { principalAmount: input.principalMinor === null ? null : money(BigInt(input.principalMinor), currency) } : {}),
      ...(input.interestMinor !== undefined ? { interestAmount: input.interestMinor === null ? null : money(BigInt(input.interestMinor), currency) } : {}),
      ...(input.feeMinor !== undefined ? { feeAmount: input.feeMinor === null ? null : money(BigInt(input.feeMinor), currency) } : {}),
      ...(input.transactionId !== undefined ? { transactionId: input.transactionId === null ? null : transactionId(input.transactionId) } : {}),
    };
    const row = await updateBnplPurchaseRecord(householdId, purchaseId, input.version, updateInput);
    return NextResponse.json({ data: serializeBnplPurchase(row) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { householdId, purchaseId } = await context.params;
    await requireHouseholdAccess(householdId);
    const input = bnplPurchaseVoidSchema.parse(await request.json());
    const row = await voidBnplPurchaseRecord(householdId, purchaseId, input.version, input.reason ?? null);
    return NextResponse.json({ data: serializeBnplPurchase(row) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
