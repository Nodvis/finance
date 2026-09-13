import { describe, expect, it } from "vitest";
import { aggregateMonthlyIncome, buildPlanningSuggestions, type PlanningInput } from "./planning";
import { currencyCode } from "./money";

const forecast = (currency: string, projectedCashMinor: bigint, isComplete = true) => ({ currency: currencyCode(currency), availableCashMinor: projectedCashMinor + 100n, includedObligationsMinor: 100n, includedObligationCount: 1, projectedCashMinor, isComplete, status: isComplete ? (projectedCashMinor < 0n ? "deficit" : projectedCashMinor === 0n ? "zero" : "positive") : "incomplete" } as const);
const base: PlanningInput = { strategy: "stabilization", forecast: { asOf: "2026-09-01", horizonDays: 30, endDate: "2026-10-01", byCurrency: [forecast("PLN", 12345678901234567890n)] }, budgets: [], goals: [], debts: [] };

describe("planning suggestions", () => {
  it("deduplicates repeated analytics rows for one income transaction", () => {
    expect(aggregateMonthlyIncome([{ id: "income", currency: "PLN", amountMinor: 100n }, { id: "income", currency: "PLN", amountMinor: 100n }])).toEqual([{ currency: "PLN", amountMinor: 100n }]);
  });
  it("returns deterministic stabilization advice with exact cash", () => {
    expect(buildPlanningSuggestions(base)).toMatchObject({ strategy: "stabilization", byCurrency: [{ currency: "PLN", projectedCashMinor: "12345678901234567890", suggestions: [{ code: "protect-buffer", amountMinor: "12345678901234567890" }] }] });
  });
  it("never combines currencies", () => {
    const result = buildPlanningSuggestions({ ...base, forecast: { ...base.forecast, byCurrency: [forecast("PLN", 1000n), forecast("EUR", 2000n)] } });
    expect(result.byCurrency.map((x) => [x.currency, x.projectedCashMinor])).toEqual([["EUR", "2000"], ["PLN", "1000"]]);
  });
  it("marks incomplete and unknown cash honestly", () => {
    const result = buildPlanningSuggestions({ ...base, forecast: { ...base.forecast, byCurrency: [forecast("PLN", 0n, false)] } });
    expect(result.byCurrency[0]).toMatchObject({ status: "incomplete", suggestions: [{ code: "verify-cash" }] });
  });
  it("supports debt avalanche and sinking funds only with supporting data", () => {
    const result = buildPlanningSuggestions({ ...base, strategy: "debt-avalanche", debts: [{ currency: "PLN", outstandingMinor: 900n }], goals: [{ currency: "PLN", remainingMinor: 500n }] });
    expect(result.byCurrency[0]?.suggestions.map((s) => s.code)).toEqual(["missing-rate-data", "fund-goals-after-debt"]);
  });

  it("selects the smallest positive debt with an exact id and amount", () => {
    const result = buildPlanningSuggestions({ ...base, strategy: "debt-snowball", debts: [
      { id: "large", currency: "PLN", outstandingMinor: 900n },
      { id: "small", currency: "PLN", outstandingMinor: 25n },
      { id: "zero", currency: "PLN", outstandingMinor: 0n },
    ] });
    expect(result.byCurrency[0]?.suggestions[0]).toEqual({ code: "prioritize-smallest-debt", debtId: "small", amountMinor: "25" });
  });

  it("selects the highest-rate debt for avalanche and rejects partial rate data", () => {
    const rated = buildPlanningSuggestions({ ...base, strategy: "debt-avalanche", debts: [
      { id: "low", currency: "PLN", outstandingMinor: 900n, annualInterestRateBps: 100n },
      { id: "high", currency: "PLN", outstandingMinor: 500n, annualInterestRateBps: 300n },
    ] });
    expect(rated.byCurrency[0]?.suggestions[0]).toEqual({ code: "prioritize-high-cost-debt", debtId: "high", amountMinor: "500" });
    const partial = buildPlanningSuggestions({ ...base, strategy: "debt-avalanche", debts: [{ id: "high", currency: "PLN", outstandingMinor: 500n, annualInterestRateBps: 300n }, { id: "unknown", currency: "PLN", outstandingMinor: 900n }] });
    expect(partial.byCurrency[0]?.suggestions[0]).toEqual({ code: "missing-rate-data" });
  });

  it("caps goal contributions at projected cash and positive monthly income", () => {
    const result = buildPlanningSuggestions({ ...base, strategy: "pay-yourself-first", forecast: { ...base.forecast, byCurrency: [forecast("PLN", 300n)] }, monthlyIncome: [{ currency: "PLN", amountMinor: 120n }], goals: [{ currency: "PLN", remainingMinor: 500n }] });
    expect(result.byCurrency[0]?.suggestions[0]).toEqual({ code: "fund-goals-first", amountMinor: "120" });
  });
  it("calls out an over-budget category without changing cash arithmetic", () => {
    const result = buildPlanningSuggestions({ ...base, budgets: [{ currency: "PLN", limitAmountMinor: 100n, remainingAmountMinor: -1n }] });
    expect(result.byCurrency[0]?.suggestions[0]).toEqual({ code: "review-over-budget" });
  });
  it("returns an honest no-data state", () => expect(buildPlanningSuggestions({ ...base, forecast: { ...base.forecast, byCurrency: [] } })).toEqual({ strategy: "stabilization", byCurrency: [], hasData: false }));
});
