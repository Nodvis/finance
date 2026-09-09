import "server-only";

import {
  createCategorizationRule,
  findCategorizationRuleInHousehold,
  findCategoryInHousehold,
  findTransactionById,
  listCategorizationRules,
  listTransactionsByHousehold,
  recordCategorizationRuleApplication,
  TransactionVersionConflictError,
  updateCategorizationRule,
  updateTransactionInDb,
} from "@nodvis/finance-db";
import {
  categoryId as toCategoryId,
  correctExpense,
  correctIncome,
  doesRuleMatch,
  isCategoryApplicableToKind,
} from "@nodvis/finance-domain";
import type { CategoryApplicability, Transaction } from "@nodvis/finance-domain";
import type { AuthorizedHouseholdContext } from "@/lib/transactions/service";
import type {
  CategorizationPreviewItem,
  CreateCategorizationRuleInput,
  SerializedCategorizationRule,
  UpdateCategorizationRuleInput,
} from "./schema";

export class CategorizationRuleCategoryError extends Error {}
export class CategorizationRuleConflictError extends Error {}

function serializeRule(row: Awaited<ReturnType<typeof findCategorizationRuleInHousehold>>): SerializedCategorizationRule {
  if (!row) throw new Error("Categorization rule not found");
  return {
    id: row.id,
    householdId: row.householdId,
    name: row.name,
    matchField: row.matchField,
    matchMode: row.matchMode,
    matchText: row.matchText,
    applicability: row.applicability as SerializedCategorizationRule["applicability"],
    categoryId: row.categoryId,
    priority: row.priority,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function validateCategory(householdId: string, categoryId: string, applicability: CategoryApplicability) {
  const category = await findCategoryInHousehold(householdId, categoryId);
  if (!category || category.archivedAt) throw new CategorizationRuleCategoryError("Category is not active in household");
  if (applicability !== "both" && category.applicability !== "both" && category.applicability !== applicability) {
    throw new CategorizationRuleCategoryError("Category applicability does not match rule");
  }
}

export async function listHouseholdCategorizationRules(context: AuthorizedHouseholdContext) {
  return (await listCategorizationRules(context.householdId)).map((row) => serializeRule(row));
}

export async function createHouseholdCategorizationRule(context: AuthorizedHouseholdContext, input: CreateCategorizationRuleInput) {
  await validateCategory(context.householdId, input.categoryId, input.applicability);
  const row = await createCategorizationRule({ householdId: context.householdId, ...input });
  return serializeRule(row);
}

export async function updateHouseholdCategorizationRule(context: AuthorizedHouseholdContext, ruleId: string, input: UpdateCategorizationRuleInput) {
  const existing = await findCategorizationRuleInHousehold(context.householdId, ruleId);
  if (!existing) throw new Error("Categorization rule not found");
  const applicability = input.applicability ?? (existing.applicability as CategoryApplicability);
  if (input.categoryId || input.applicability) await validateCategory(context.householdId, input.categoryId ?? existing.categoryId, applicability);
  return serializeRule(await updateCategorizationRule({
    householdId: context.householdId,
    ruleId,
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.matchMode !== undefined ? { matchMode: input.matchMode } : {}),
    ...(input.matchText !== undefined ? { matchText: input.matchText } : {}),
    ...(input.applicability !== undefined ? { applicability: input.applicability } : {}),
    ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
  }));
}

function counterparty(transaction: Transaction): string | null {
  if (transaction.kind === "expense") return transaction.payee;
  if (transaction.kind === "income") return transaction.source;
  return null;
}

function candidateRules(transaction: Transaction, rules: SerializedCategorizationRule[]) {
  const value = counterparty(transaction);
  if (!value || transaction.kind === "transfer") return [];
  return rules.filter((rule) => rule.enabled && (rule.applicability === "both" || rule.applicability === transaction.kind) && doesRuleMatch(value, rule.matchMode, rule.matchText));
}

export async function previewCategorizationRules(context: AuthorizedHouseholdContext, transactionIds: string[]): Promise<CategorizationPreviewItem[]> {
  const rules = await listHouseholdCategorizationRules(context);
  const transactions = await Promise.all(transactionIds.map((id) => findTransactionById(context.householdId, id)));
  return transactions.map((transaction, index) => {
    const transactionId = transactionIds[index]!;
    if (!transaction) return { transactionId, currentCategoryId: null, proposedCategoryId: null, status: "no_match", explanation: "Transaction not found in household", ruleId: null };
    if (transaction.kind === "transfer") return { transactionId, currentCategoryId: null, proposedCategoryId: null, status: "no_match", explanation: "Transfers are never categorized as spending", ruleId: null };
    const currentCategoryId = transaction.categoryId ?? null;
    if (currentCategoryId) return { transactionId, currentCategoryId, proposedCategoryId: null, status: "manual_override", explanation: "Existing category preserved as a manual/import classification", ruleId: null };
    const matches = candidateRules(transaction, rules);
    if (matches.length === 0) return { transactionId, currentCategoryId: null, proposedCategoryId: null, status: "no_match", explanation: "No enabled rule matched", ruleId: null };
    const top = matches[0]!;
    const tied = matches.filter((rule) => rule.priority === top.priority);
    const categories = new Set(tied.map((rule) => rule.categoryId));
    if (categories.size > 1) return { transactionId, currentCategoryId: null, proposedCategoryId: null, status: "conflict", explanation: `Conflicting rules at priority ${top.priority}; no automatic change`, ruleId: top.id };
    return { transactionId, currentCategoryId: null, proposedCategoryId: top.categoryId, status: "match", explanation: `Matched ${top.name}: ${top.matchMode} “${top.matchText}”`, ruleId: top.id };
  });
}

export async function applyCategorizationRules(context: AuthorizedHouseholdContext, transactionIds: string[]) {
  const preview = await previewCategorizationRules(context, transactionIds);
  const applied: CategorizationPreviewItem[] = [];
  for (const item of preview) {
    if (item.status !== "match" || !item.ruleId || !item.proposedCategoryId) {
      if (item.ruleId) await recordCategorizationRuleApplication({ householdId: context.householdId, ruleId: item.ruleId, transactionId: item.transactionId, beforeCategoryId: item.currentCategoryId, afterCategoryId: item.proposedCategoryId, status: "skipped_conflict", explanation: item.explanation });
      continue;
    }
    const transaction = await findTransactionById(context.householdId, item.transactionId);
    if (!transaction || transaction.kind === "transfer" || transaction.categoryId) continue;
    const category = toCategoryId(item.proposedCategoryId);
    const corrected = transaction.kind === "expense"
      ? correctExpense(transaction, { accountId: transaction.accountId, amount: transaction.amount, payee: transaction.payee, paidByPersonId: transaction.paidByPersonId, occurredOn: transaction.occurredOn, categoryId: category })
      : correctIncome(transaction, { accountId: transaction.accountId, amount: transaction.amount, source: transaction.source, receivedByPersonId: transaction.receivedByPersonId, occurredOn: transaction.occurredOn, categoryId: category });
    try {
      await updateTransactionInDb({ householdId: context.householdId, id: transaction.id, expectedVersion: transaction.version, transaction: corrected, audit: { authUserId: context.authUserId, personId: context.personId, source: "system" } });
    } catch (error) {
      if (!(error instanceof TransactionVersionConflictError)) throw error;
      await recordCategorizationRuleApplication({ householdId: context.householdId, ruleId: item.ruleId, transactionId: item.transactionId, beforeCategoryId: item.currentCategoryId, afterCategoryId: item.proposedCategoryId, status: "skipped_stale", explanation: "Transaction changed after preview; no category was applied" });
      continue;
    }
    await recordCategorizationRuleApplication({ householdId: context.householdId, ruleId: item.ruleId, transactionId: item.transactionId, beforeCategoryId: null, afterCategoryId: item.proposedCategoryId, status: "applied", explanation: item.explanation });
    applied.push(item);
  }
  return { preview, applied };
}
