import { describe, expect, it } from "vitest";

import {
  addMoney,
  currencyCode,
  isZeroMoney,
  money,
  negateMoney,
  subtractMoney,
} from "./money";

describe("Money", () => {
  it("normalizes valid currency codes", () => {
    expect(currencyCode(" pln ")).toBe("PLN");
  });

  it("rejects malformed currency codes", () => {
    expect(() => currencyCode("PL")).toThrow(/Invalid currency code/);
    expect(() => currencyCode("PLN1")).toThrow(/Invalid currency code/);
  });

  it("adds exact minor units without floating point arithmetic", () => {
    const result = addMoney(money(10n, "PLN"), money(20n, "PLN"));

    expect(result).toEqual({ amountMinor: 30n, currency: "PLN" });
  });

  it("subtracts exact minor units", () => {
    const result = subtractMoney(money(1000n, "PLN"), money(250n, "PLN"));

    expect(result).toEqual({ amountMinor: 750n, currency: "PLN" });
  });

  it("refuses accidental cross-currency arithmetic", () => {
    expect(() => addMoney(money(100n, "PLN"), money(100n, "EUR"))).toThrow(
      /Currency mismatch/,
    );
  });

  it("supports negative values and exact zero checks", () => {
    expect(negateMoney(money(125n, "PLN"))).toEqual({
      amountMinor: -125n,
      currency: "PLN",
    });
    expect(isZeroMoney(money(0n, "PLN"))).toBe(true);
  });
});
