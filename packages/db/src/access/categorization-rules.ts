import { and, asc, desc, eq } from "drizzle-orm";
import type { RuleApplicability, RuleMatchField, RuleMatchMode } from "@nodvis/finance-domain";

import { getDb } from "../client";
import { categorizationRuleApplications, categorizationRules } from "../schema/categorization-rules";

export type CategorizationRuleRow = typeof categorizationRules.$inferSelect;
export type NewCategorizationRuleRow = typeof categorizationRules.$inferInsert;
export type CategorizationRuleApplicationRow = typeof categorizationRuleApplications.$inferSelect;

export async function listCategorizationRules(householdId: string): Promise<CategorizationRuleRow[]> {
  return getDb().select().from(categorizationRules)
    .where(eq(categorizationRules.householdId, householdId))
    .orderBy(asc(categorizationRules.priority), asc(categorizationRules.createdAt));
}

export async function findCategorizationRuleInHousehold(householdId: string, ruleId: string): Promise<CategorizationRuleRow | null> {
  const [row] = await getDb().select().from(categorizationRules)
    .where(and(eq(categorizationRules.householdId, householdId), eq(categorizationRules.id, ruleId)))
    .limit(1);
  return row ?? null;
}

export async function createCategorizationRule(input: {
  householdId: string;
  name: string;
  matchField: RuleMatchField;
  matchMode: RuleMatchMode;
  matchText: string;
  applicability: RuleApplicability;
  categoryId: string;
  priority: number;
}): Promise<CategorizationRuleRow> {
  const [row] = await getDb().insert(categorizationRules).values(input).returning();
  if (!row) throw new Error("Failed to create categorization rule");
  return row;
}

export async function updateCategorizationRule(input: {
  householdId: string;
  ruleId: string;
  name?: string;
  matchMode?: RuleMatchMode;
  matchText?: string;
  applicability?: RuleApplicability;
  categoryId?: string;
  priority?: number;
  enabled?: boolean;
}): Promise<CategorizationRuleRow> {
  const [row] = await getDb().update(categorizationRules).set({
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.matchMode !== undefined ? { matchMode: input.matchMode } : {}),
    ...(input.matchText !== undefined ? { matchText: input.matchText } : {}),
    ...(input.applicability !== undefined ? { applicability: input.applicability } : {}),
    ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
    updatedAt: new Date(),
  }).where(and(eq(categorizationRules.householdId, input.householdId), eq(categorizationRules.id, input.ruleId))).returning();
  if (!row) throw new Error("Categorization rule not found in household");
  return row;
}

export async function recordCategorizationRuleApplication(input: {
  householdId: string;
  ruleId: string;
  transactionId: string;
  beforeCategoryId: string | null;
  afterCategoryId: string | null;
  status: "applied" | "skipped_conflict" | "skipped_stale";
  explanation: string;
}): Promise<CategorizationRuleApplicationRow> {
  const [row] = await getDb().insert(categorizationRuleApplications).values(input).returning();
  if (!row) throw new Error("Failed to record categorization rule application");
  return row;
}

export async function listCategorizationRuleApplications(householdId: string, ruleId?: string): Promise<CategorizationRuleApplicationRow[]> {
  return getDb().select().from(categorizationRuleApplications).where(and(
    eq(categorizationRuleApplications.householdId, householdId),
    ...(ruleId ? [eq(categorizationRuleApplications.ruleId, ruleId)] : []),
  )).orderBy(desc(categorizationRuleApplications.createdAt));
}
