import { describe, expect, it } from "vitest";

import { calculateCashForecast } from "./forecast";

describe("calculateCashForecast", () => {
  it("subtracts only unpaid obligations through the horizon per currency", () => {
    const result = calculateCashForecast({
      asOf: "2026-09-10",
      horizonDays: 7,
      availableCash: [
        { currency: "PLN", amountMinor: 520000n, isComplete: true },
        { currency: "EUR", amountMinor: 100000n, isComplete: true },
      ],
      obligations: [
        { currency: "PLN", amountMinor: 210000n, dueDate: "2026-09-12", status: "upcoming" },
        { currency: "PLN", amountMinor: 99000n, dueDate: "2026-09-18", status: "upcoming" },
        { currency: "PLN", amountMinor: 1n, dueDate: "2026-09-17", status: "paid" },
        { currency: "EUR", amountMinor: 50000n, dueDate: "2026-09-14", status: "upcoming" },
      ],
    });

    expect(result.byCurrency).toEqual([
      expect.objectContaining({ currency: "EUR", availableCashMinor: 100000n, includedObligationsMinor: 50000n, projectedCashMinor: 50000n, isComplete: true }),
      expect.objectContaining({ currency: "PLN", availableCashMinor: 520000n, includedObligationsMinor: 210000n, projectedCashMinor: 310000n, includedObligationCount: 1, isComplete: true }),
    ]);
  });

  it("marks forecast incomplete without treating unknown cash as zero", () => {
    const result = calculateCashForecast({
      asOf: "2026-02-28",
      horizonDays: 7,
      availableCash: [{ currency: "PLN", amountMinor: 0n, isComplete: false }],
      obligations: [{ currency: "PLN", amountMinor: 100n, dueDate: "2026-03-01", status: "upcoming" }],
    });

    expect(result.byCurrency[0]).toMatchObject({ isComplete: false, projectedCashMinor: -100n });
  });

  it("includes the cutoff date, excludes cancelled and classifies zero/deficit", () => {
    const result = calculateCashForecast({
      asOf: "2026-09-10",
      horizonDays: 7,
      availableCash: [
        { currency: "PLN", amountMinor: 100n, isComplete: true },
        { currency: "EUR", amountMinor: 50n, isComplete: true },
      ],
      obligations: [
        { currency: "PLN", amountMinor: 100n, dueDate: "2026-09-17", status: "upcoming" },
        { currency: "EUR", amountMinor: 1n, dueDate: "2026-09-17", status: "cancelled" },
        { currency: "EUR", amountMinor: 75n, dueDate: "2026-09-17", status: "upcoming" },
      ],
    });

    expect(result.byCurrency).toEqual([
      expect.objectContaining({ currency: "EUR", projectedCashMinor: -25n, status: "deficit", includedObligationCount: 1 }),
      expect.objectContaining({ currency: "PLN", projectedCashMinor: 0n, status: "zero", includedObligationCount: 1 }),
    ]);
  });
});
