import { describe, expect, it } from "vitest";

import { calculateHistoricalNetWorthSeries, calculateNetWorth } from "./net-worth";
import { money } from "./money";

describe("net worth domain calculations", () => {
  it("calculates assets, liabilities, and net worth per currency", () => {
    const result = calculateNetWorth({
      accounts: [
        { type: "checking", balance: money(500_000n, "PLN") },
        { type: "savings", balance: money(1_500_000n, "PLN") },
        { type: "credit_card", balance: money(-200_000n, "PLN") },
      ],
      liabilities: [money(300_000n, "PLN")],
    });

    expect(result.byCurrency).toEqual([
      {
        currency: "PLN",
        assetsMinor: 2_000_000n,
        liabilitiesMinor: 500_000n,
        netWorthMinor: 1_500_000n,
      },
    ]);
  });

  it("keeps multiple currencies separate and does not apply FX", () => {
    const result = calculateNetWorth({
      accounts: [
        { type: "checking", balance: money(100_000n, "PLN") },
        { type: "savings", balance: money(200_000n, "EUR") },
      ],
      liabilities: [money(50_000n, "EUR")],
    });

    expect(result.byCurrency).toEqual([
      { currency: "EUR", assetsMinor: 200_000n, liabilitiesMinor: 50_000n, netWorthMinor: 150_000n },
      { currency: "PLN", assetsMinor: 100_000n, liabilitiesMinor: 0n, netWorthMinor: 100_000n },
    ]);
  });

  it("treats an overdraft as a liability and card overpayment as an asset", () => {
    const result = calculateNetWorth({
      accounts: [
        { type: "checking", balance: money(-10_000n, "PLN") },
        { type: "credit_card", balance: money(5_000n, "PLN") },
      ],
      liabilities: [],
    });

    expect(result.byCurrency[0]).toEqual({
      currency: "PLN",
      assetsMinor: 5_000n,
      liabilitiesMinor: 10_000n,
      netWorthMinor: -5_000n,
    });
  });

  it("preserves zero-decimal, three-decimal, and very large amounts exactly", () => {
    const result = calculateNetWorth({
      accounts: [
        { type: "checking", balance: money(9_007_199_254_740_993n, "JPY") },
        { type: "savings", balance: money(123_456_789_012_345_678_901n, "KWD") },
      ],
      liabilities: [money(1n, "KWD")],
    });

    expect(result.byCurrency).toEqual([
      { currency: "JPY", assetsMinor: 9_007_199_254_740_993n, liabilitiesMinor: 0n, netWorthMinor: 9_007_199_254_740_993n },
      { currency: "KWD", assetsMinor: 123_456_789_012_345_678_901n, liabilitiesMinor: 1n, netWorthMinor: 123_456_789_012_345_678_900n },
    ]);
  });

  it("returns an empty result when no observations exist", () => {
    expect(calculateNetWorth({ accounts: [], liabilities: [] })).toEqual({ byCurrency: [] });
  });
});

describe("historical net worth series with incomplete-history confidence", () => {
  it("builds a complete historical series when all subjects have observations", () => {
    const subjects = [
      { id: "acc-1", name: "Main Checking", kind: "account" as const, accountType: "checking" as const, currency: "PLN" },
      { id: "acc-2", name: "Savings Vault", kind: "account" as const, accountType: "savings" as const, currency: "PLN" },
      { id: "liab-1", name: "Mortgage", kind: "liability" as const, currency: "PLN" },
    ];

    const observations = [
      { id: "o-1", subjectId: "acc-1", subjectKind: "account" as const, amountMinor: 500_000n, currency: "PLN", observedAt: new Date("2026-08-01T10:00:00Z") },
      { id: "o-2", subjectId: "acc-2", subjectKind: "account" as const, amountMinor: 1_000_000n, currency: "PLN", observedAt: new Date("2026-08-01T10:00:00Z") },
      { id: "o-3", subjectId: "liab-1", subjectKind: "liability" as const, amountMinor: 800_000n, currency: "PLN", observedAt: new Date("2026-08-01T10:00:00Z") },
      { id: "o-4", subjectId: "acc-1", subjectKind: "account" as const, amountMinor: 600_000n, currency: "PLN", observedAt: new Date("2026-09-01T10:00:00Z") },
      { id: "o-5", subjectId: "acc-2", subjectKind: "account" as const, amountMinor: 1_200_000n, currency: "PLN", observedAt: new Date("2026-09-01T10:00:00Z") },
      { id: "o-6", subjectId: "liab-1", subjectKind: "liability" as const, amountMinor: 750_000n, currency: "PLN", observedAt: new Date("2026-09-01T10:00:00Z") },
    ];

    const series = calculateHistoricalNetWorthSeries({
      subjects,
      observations,
      dates: ["2026-08-01", "2026-09-01"],
      asOf: new Date("2026-09-01T23:59:59Z"),
    });

    expect(series.byCurrency).toHaveLength(1);
    const pln = series.byCurrency[0]!;
    expect(pln.currency).toBe("PLN");
    expect(pln.currentConfidence).toBe("complete");
    expect(pln.currentIsComplete).toBe(true);
    expect(pln.currentNetWorthMinor).toBe(1_050_000n); // (600k + 1.2M) - 750k = 1.05M
    expect(pln.currentAssetsMinor).toBe(1_800_000n);
    expect(pln.currentLiabilitiesMinor).toBe(750_000n);

    expect(pln.points).toHaveLength(2);
    expect(pln.points[0]!).toEqual({
      date: "2026-08-01",
      timestamp: new Date("2026-08-01T23:59:59.999Z"),
      currency: "PLN",
      assetsMinor: 1_500_000n,
      liabilitiesMinor: 800_000n,
      netWorthMinor: 700_000n,
      confidence: "complete",
      isComplete: true,
      observedSubjectCount: 3,
      totalSubjectCount: 3,
      missingSubjectNames: [],
    });

    expect(pln.points[1]!).toEqual({
      date: "2026-09-01",
      timestamp: new Date("2026-09-01T23:59:59.999Z"),
      currency: "PLN",
      assetsMinor: 1_800_000n,
      liabilitiesMinor: 750_000n,
      netWorthMinor: 1_050_000n,
      confidence: "complete",
      isComplete: true,
      observedSubjectCount: 3,
      totalSubjectCount: 3,
      missingSubjectNames: [],
    });
  });

  it("explicitly flags incomplete history when an account is missing an observation at an evaluation date", () => {
    const subjects = [
      { id: "acc-1", name: "Checking Account", kind: "account" as const, accountType: "checking" as const, currency: "PLN" },
      { id: "acc-2", name: "Brokerage Account", kind: "account" as const, accountType: "savings" as const, currency: "PLN" },
    ];

    // Brokerage account was only observed on 2026-09-01, not on 2026-08-01
    const observations = [
      { id: "o-1", subjectId: "acc-1", subjectKind: "account" as const, amountMinor: 200_000n, currency: "PLN", observedAt: new Date("2026-08-01T12:00:00Z") },
      { id: "o-2", subjectId: "acc-1", subjectKind: "account" as const, amountMinor: 250_000n, currency: "PLN", observedAt: new Date("2026-09-01T12:00:00Z") },
      { id: "o-3", subjectId: "acc-2", subjectKind: "account" as const, amountMinor: 500_000n, currency: "PLN", observedAt: new Date("2026-09-01T12:00:00Z") },
    ];

    const series = calculateHistoricalNetWorthSeries({
      subjects,
      observations,
      dates: ["2026-08-01", "2026-09-01"],
    });

    const pln = series.byCurrency[0]!;
    const point1 = pln.points[0]!;
    // Point 1 (2026-08-01) has only acc-1 observed; acc-2 is missing!
    expect(point1.confidence).toBe("incomplete");
    expect(point1.isComplete).toBe(false);
    expect(point1.observedSubjectCount).toBe(1);
    expect(point1.totalSubjectCount).toBe(2);
    expect(point1.missingSubjectNames).toEqual(["Brokerage Account"]);
    expect(point1.netWorthMinor).toBe(200_000n);

    // Point 2 (2026-09-01) has both accounts observed
    const point2 = pln.points[1]!;
    expect(point2.confidence).toBe("complete");
    expect(point2.isComplete).toBe(true);
    expect(point2.missingSubjectNames).toEqual([]);
    expect(point2.netWorthMinor).toBe(750_000n);
  });

  it("handles multi-currency separation with no FX and individual currency confidence", () => {
    const subjects = [
      { id: "acc-pln", name: "PLN Checking", kind: "account" as const, accountType: "checking" as const, currency: "PLN" },
      { id: "acc-eur", name: "EUR Savings", kind: "account" as const, accountType: "savings" as const, currency: "EUR" },
      { id: "liab-eur", name: "EUR Loan", kind: "liability" as const, currency: "EUR" },
    ];

    const observations = [
      { id: "o-1", subjectId: "acc-pln", subjectKind: "account" as const, amountMinor: 100_000n, currency: "PLN", observedAt: new Date("2026-09-01T10:00:00Z") },
      { id: "o-2", subjectId: "acc-eur", subjectKind: "account" as const, amountMinor: 50_000n, currency: "EUR", observedAt: new Date("2026-09-01T10:00:00Z") },
      // EUR loan is missing an observation!
    ];

    const series = calculateHistoricalNetWorthSeries({
      subjects,
      observations,
      dates: ["2026-09-01"],
    });

    expect(series.byCurrency).toHaveLength(2);
    const eur = series.byCurrency.find((c) => c.currency === "EUR")!;
    const pln = series.byCurrency.find((c) => c.currency === "PLN")!;

    // PLN is complete
    expect(pln.currentConfidence).toBe("complete");
    expect(pln.currentIsComplete).toBe(true);
    expect(pln.currentNetWorthMinor).toBe(100_000n);

    // EUR is incomplete because EUR loan is not observed
    expect(eur.currentConfidence).toBe("incomplete");
    expect(eur.currentIsComplete).toBe(false);
    expect(eur.missingSubjectNames).toEqual(["EUR Loan"]);
    expect(eur.currentNetWorthMinor).toBe(50_000n);
  });

  it("handles credit-card debt and overpayments accurately over time", () => {
    const subjects = [
      { id: "card-1", name: "Visa Card", kind: "account" as const, accountType: "credit_card" as const, currency: "PLN" },
    ];

    const observations = [
      // 2026-08-01: negative balance means debt owed to issuer (-500.00 PLN)
      { id: "o-1", subjectId: "card-1", subjectKind: "account" as const, amountMinor: -50_000n, currency: "PLN", observedAt: new Date("2026-08-01T10:00:00Z") },
      // 2026-09-01: positive balance means card overpayment asset (+100.00 PLN)
      { id: "o-2", subjectId: "card-1", subjectKind: "account" as const, amountMinor: 10_000n, currency: "PLN", observedAt: new Date("2026-09-01T10:00:00Z") },
    ];

    const series = calculateHistoricalNetWorthSeries({
      subjects,
      observations,
      dates: ["2026-08-01", "2026-09-01"],
    });

    const pln = series.byCurrency[0]!;
    expect(pln.points[0]!.assetsMinor).toBe(0n);
    expect(pln.points[0]!.liabilitiesMinor).toBe(50_000n);
    expect(pln.points[0]!.netWorthMinor).toBe(-50_000n);

    expect(pln.points[1]!.assetsMinor).toBe(10_000n);
    expect(pln.points[1]!.liabilitiesMinor).toBe(0n);
    expect(pln.points[1]!.netWorthMinor).toBe(10_000n);
  });

  it("handles checking account overdrafts as liabilities", () => {
    const subjects = [
      { id: "chk-1", name: "Checking", kind: "account" as const, accountType: "checking" as const, currency: "PLN" },
    ];

    const observations = [
      { id: "o-1", subjectId: "chk-1", subjectKind: "account" as const, amountMinor: -25_000n, currency: "PLN", observedAt: new Date("2026-09-01T10:00:00Z") },
    ];

    const series = calculateHistoricalNetWorthSeries({
      subjects,
      observations,
      dates: ["2026-09-01"],
    });

    const pln = series.byCurrency[0]!;
    expect(pln.points[0]!.assetsMinor).toBe(0n);
    expect(pln.points[0]!.liabilitiesMinor).toBe(25_000n);
    expect(pln.points[0]!.netWorthMinor).toBe(-25_000n);
  });

  it("reports 'no_data' when subjects exist but have no observations", () => {
    const subjects = [
      { id: "acc-1", name: "Checking", kind: "account" as const, accountType: "checking" as const, currency: "PLN" },
    ];

    const series = calculateHistoricalNetWorthSeries({
      subjects,
      observations: [],
      dates: ["2026-09-01"],
    });

    const pln = series.byCurrency[0]!;
    expect(pln.currentConfidence).toBe("no_data");
    expect(pln.currentIsComplete).toBe(false);
    expect(pln.currentNetWorthMinor).toBe(0n);
    expect(pln.missingSubjectNames).toEqual(["Checking"]);
  });

  it("preserves exact large bigint amounts without floating point distortion", () => {
    const subjects = [
      { id: "acc-huge", name: "Huge Wealth", kind: "account" as const, accountType: "savings" as const, currency: "PLN" },
    ];

    const hugeMinor = 987_654_321_098_765_432n;
    const observations = [
      { id: "o-1", subjectId: "acc-huge", subjectKind: "account" as const, amountMinor: hugeMinor, currency: "PLN", observedAt: new Date("2026-09-01T10:00:00Z") },
    ];

    const series = calculateHistoricalNetWorthSeries({
      subjects,
      observations,
      dates: ["2026-09-01"],
    });

    const pln = series.byCurrency[0]!;
    expect(pln.currentNetWorthMinor).toBe(hugeMinor);
    expect(pln.points[0]!.assetsMinor).toBe(hugeMinor);
  });

  it("uses the latest created observation when observed timestamps tie", () => {
    const series = calculateHistoricalNetWorthSeries({
      subjects: [{ id: "acc-1", name: "Checking", kind: "account", accountType: "checking", currency: "PLN" }],
      observations: [
        { id: "old", subjectId: "acc-1", subjectKind: "account", amountMinor: 0n, currency: "PLN", observedAt: new Date("2026-09-12T00:00:00Z"), createdAt: new Date("2026-09-12T10:00:00Z") },
        { id: "new", subjectId: "acc-1", subjectKind: "account", amountMinor: 123_450n, currency: "PLN", observedAt: new Date("2026-09-12T00:00:00Z"), createdAt: new Date("2026-09-12T11:00:00Z") },
      ],
      dates: ["2026-09-12"],
    });

    expect(series.byCurrency[0]!.currentNetWorthMinor).toBe(123_450n);
  });
});
