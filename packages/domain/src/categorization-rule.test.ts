import { describe, expect, it } from "vitest";

import { doesRuleMatch, normalizeRuleText } from "./categorization-rule";

describe("categorization rules", () => {
  it("normalizes and matches counterparty text deterministically", () => {
    expect(normalizeRuleText("  Grocery   Store ")).toBe("Grocery Store");
    expect(doesRuleMatch("Acme Market Warsaw", "contains", "market")).toBe(true);
    expect(doesRuleMatch("Acme Market", "exact", "acme market")).toBe(true);
    expect(doesRuleMatch("Acme Market", "starts_with", "acme")).toBe(true);
    expect(doesRuleMatch("Acme Market", "exact", "market")).toBe(false);
  });

  it("does not treat empty rule text as valid", () => {
    expect(() => normalizeRuleText("  ")).toThrow();
    expect(() => normalizeRuleText("x".repeat(161))).toThrow();
  });
});
