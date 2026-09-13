import "server-only";
import { listTransactionSplits, replaceTransactionSplit } from "@nodvis/finance-db";
import type { AuthorizedHouseholdContext } from "./service";
import type { SplitTransactionInput } from "./split-schema";

export async function getTransactionSplits(context: AuthorizedHouseholdContext, transactionId: string) {
  return listTransactionSplits(context.householdId, transactionId);
}
export async function saveTransactionSplits(context: AuthorizedHouseholdContext, transactionId: string, input: SplitTransactionInput) {
  return replaceTransactionSplit({
    householdId: context.householdId,
    transactionId,
    expectedVersion: input.expectedVersion,
    authUserId: context.authUserId,
    personId: context.personId,
    allocations: input.allocations.map((a) => ({ categoryId: a.categoryId, amountMinor: a.amount.amountMinor, currency: a.amount.currency })),
  });
}
