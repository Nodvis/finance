import type { HouseholdLiabilitySummary } from "@nodvis/finance-db";
import type { LiabilityRepayment } from "@nodvis/finance-domain";
import type {
  SerializedHouseholdLiability,
  SerializedLiabilityRepayment,
} from "./schema";

export function serializeLiability(
  liability: HouseholdLiabilitySummary,
): SerializedHouseholdLiability {
  return {
    id: liability.id,
    householdId: liability.householdId,
    name: liability.name,
    kind: liability.kind,
    currency: liability.currency,
    observedOutstandingMinor:
      liability.observedOutstandingMinor !== null
        ? liability.observedOutstandingMinor.toString()
        : null,
    observedOutstandingAt:
      liability.observedOutstandingAt !== null
        ? liability.observedOutstandingAt.toISOString()
        : null,
    responsiblePersonId: liability.responsiblePersonId,
    responsiblePersonName: liability.responsiblePersonName,
    lender: liability.lender,
    destinationAccountId: liability.destinationAccountId,
    destinationAccountName: liability.destinationAccountName,
    notes: liability.notes,
    version: liability.version,
    archivedAt:
      liability.archivedAt !== null
        ? liability.archivedAt.toISOString()
        : null,
    createdAt: liability.createdAt.toISOString(),
    updatedAt: liability.updatedAt.toISOString(),
  };
}

export function serializeRepayment(
  repayment: LiabilityRepayment,
): SerializedLiabilityRepayment {
  return {
    id: repayment.id,
    householdId: repayment.householdId,
    liabilityId: repayment.liabilityId,
    transactionId: repayment.transactionId,
    paidAt: repayment.paidAt.toISOString(),
    amountMinor: repayment.amount.amountMinor.toString(),
    currency: repayment.amount.currency,
    principalMinor:
      repayment.principalAmount !== null
        ? repayment.principalAmount.amountMinor.toString()
        : null,
    interestMinor:
      repayment.interestAmount !== null
        ? repayment.interestAmount.amountMinor.toString()
        : null,
    feeMinor:
      repayment.feeAmount !== null
        ? repayment.feeAmount.amountMinor.toString()
        : null,
    allocationState: repayment.allocationState,
    notes: repayment.notes,
    version: repayment.version,
    voidedAt:
      repayment.voidedAt !== null ? repayment.voidedAt.toISOString() : null,
    voidReason: repayment.voidReason,
    createdAt: repayment.createdAt.toISOString(),
    updatedAt: repayment.updatedAt.toISOString(),
  };
}
