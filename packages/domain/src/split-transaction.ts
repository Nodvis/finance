import type { CategoryId } from "./identity";
import type { Money } from "./money";
import type { ExpenseTransaction, Transaction } from "./transaction";

export type SplitAllocation = Readonly<{ categoryId: CategoryId; amount: Money }>;

/** Validates the complete allocation of one canonical expense transaction. */
export function createSplitAllocations(
  parent: Transaction,
  allocations: readonly SplitAllocation[],
): readonly SplitAllocation[] {
  if (parent.kind !== "expense") throw new Error("Only expense transactions can be split");
  if (allocations.length < 2) throw new Error("A split requires at least two allocations");
  const seen = new Set<string>();
  let total = 0n;
  for (const allocation of allocations) {
    if (allocation.amount.currency !== parent.amount.currency) throw new Error("All split allocations must use the parent currency");
    if (allocation.amount.amountMinor <= 0n) throw new Error("Split allocations must be positive");
    if (seen.has(allocation.categoryId)) throw new Error("Duplicate split category allocations are not allowed");
    seen.add(allocation.categoryId);
    total += allocation.amount.amountMinor;
  }
  if (total !== parent.amount.amountMinor) throw new Error("Split allocations must sum exactly to the parent amount");
  return Object.freeze(allocations.map((a) => Object.freeze({ categoryId: a.categoryId, amount: a.amount })));
}

export function isSplitExpense(transaction: Transaction): transaction is ExpenseTransaction {
  return transaction.kind === "expense";
}
