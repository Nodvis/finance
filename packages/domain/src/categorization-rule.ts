export const RULE_MATCH_FIELDS = ["counterparty"] as const;
export type RuleMatchField = (typeof RULE_MATCH_FIELDS)[number];

export const RULE_MATCH_MODES = ["contains", "exact", "starts_with"] as const;
export type RuleMatchMode = (typeof RULE_MATCH_MODES)[number];

export const RULE_APPLICABILITIES = ["expense", "income", "both"] as const;
export type RuleApplicability = (typeof RULE_APPLICABILITIES)[number];

export function normalizeRuleText(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length === 0 || normalized.length > 160) {
    throw new Error("Rule match text must be between 1 and 160 characters");
  }
  return normalized;
}

export function doesRuleMatch(
  value: string,
  mode: RuleMatchMode,
  matchText: string,
): boolean {
  const candidate = value.trim().toLocaleLowerCase();
  const expected = matchText.trim().toLocaleLowerCase();
  if (mode === "exact") return candidate === expected;
  if (mode === "starts_with") return candidate.startsWith(expected);
  return candidate.includes(expected);
}
