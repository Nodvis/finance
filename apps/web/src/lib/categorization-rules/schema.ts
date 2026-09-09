import { z } from "zod";

export const ruleMatchFieldSchema = z.literal("counterparty");
export const ruleMatchModeSchema = z.enum(["contains", "exact", "starts_with"]);
export const ruleApplicabilitySchema = z.enum(["expense", "income", "both"]);

export const createCategorizationRuleSchema = z.object({
  name: z.string().trim().min(1).max(160),
  matchField: ruleMatchFieldSchema,
  matchMode: ruleMatchModeSchema,
  matchText: z.string().trim().min(1).max(160),
  applicability: ruleApplicabilitySchema,
  categoryId: z.string().uuid(),
  priority: z.number().int().min(0).max(100000),
});

export const updateCategorizationRuleSchema = createCategorizationRuleSchema.partial().extend({
  enabled: z.boolean().optional(),
});

export const applyCategorizationRulesSchema = z.object({
  transactionIds: z.array(z.string().uuid()).min(1).max(500),
  previewToken: z.string().min(16).optional(),
  previewOnly: z.boolean().optional().default(true),
});

export type CreateCategorizationRuleInput = z.infer<typeof createCategorizationRuleSchema>;
export type UpdateCategorizationRuleInput = z.infer<typeof updateCategorizationRuleSchema>;

export type SerializedCategorizationRule = {
  id: string;
  householdId: string;
  name: string;
  matchField: "counterparty";
  matchMode: "contains" | "exact" | "starts_with";
  matchText: string;
  applicability: "expense" | "income" | "both";
  categoryId: string;
  priority: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CategorizationPreviewItem = {
  transactionId: string;
  currentCategoryId: string | null;
  proposedCategoryId: string | null;
  status: "match" | "manual_override" | "conflict" | "no_match";
  explanation: string;
  ruleId: string | null;
};
