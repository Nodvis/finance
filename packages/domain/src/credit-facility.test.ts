import { describe, expect, it } from "vitest";

import { computeCreditCardCapacity, computeOverdraftCapacity, validateCreditSnapshot } from "./credit-facility";
import { currencyCode } from "./money";

describe("computeOverdraftCapacity", () => {
  it("keeps own funds separate from unused overdraft", () => {
    expect(computeOverdraftCapacity({ currency: "PLN", accountBalanceMinor: 300000n, approvedLimitMinor: 200000n })).toMatchObject({
      ownFundsMinor: 300000n,
      usedBorrowingMinor: 0n,
      availableBorrowingMinor: 200000n,
      combinedCapacityMinor: 500000n,
    });
  });

  it("calculates remaining overdraft from a negative balance", () => {
    expect(computeOverdraftCapacity({ currency: "PLN", accountBalanceMinor: -50000n, approvedLimitMinor: 200000n })).toMatchObject({
      ownFundsMinor: 0n,
      usedBorrowingMinor: 50000n,
      availableBorrowingMinor: 150000n,
      combinedCapacityMinor: 150000n,
    });
  });

  it("does not fabricate capacity when the balance is unknown", () => {
    expect(computeOverdraftCapacity({ currency: "PLN", accountBalanceMinor: null, approvedLimitMinor: 200000n })).toMatchObject({
      ownFundsMinor: null,
      usedBorrowingMinor: null,
      availableBorrowingMinor: null,
      combinedCapacityMinor: null,
      basis: "unknown",
    });
  });

  it("uses a reported available amount instead of guessing", () => {
    expect(computeOverdraftCapacity({ currency: "PLN", accountBalanceMinor: 300000n, approvedLimitMinor: 200000n, observedAvailableMinor: 125000n, observedUsedMinor: 75000n })).toMatchObject({
      usedBorrowingMinor: 75000n,
      availableBorrowingMinor: 125000n,
      combinedCapacityMinor: 425000n,
      basis: "observed",
    });
  });

  it("supports an entirely unused and a fully used facility", () => {
    expect(computeOverdraftCapacity({ currency: "PLN", accountBalanceMinor: 0n, approvedLimitMinor: 200000n }).availableBorrowingMinor).toBe(200000n);
    expect(computeOverdraftCapacity({ currency: "PLN", accountBalanceMinor: -200000n, approvedLimitMinor: 200000n }).availableBorrowingMinor).toBe(0n);
  });

  it("flags an over-limit balance without negative available credit", () => {
    expect(computeOverdraftCapacity({ currency: "PLN", accountBalanceMinor: -250000n, approvedLimitMinor: 200000n })).toMatchObject({ availableBorrowingMinor: 0n, combinedCapacityMinor: 0n, warning: "over_limit" });
  });

  it("flags inconsistent observed usage and availability", () => {
    expect(computeOverdraftCapacity({ currency: "PLN", accountBalanceMinor: 0n, approvedLimitMinor: 200000n, observedUsedMinor: 50000n, observedAvailableMinor: 100000n })).toMatchObject({ warning: "inconsistent_observation", basis: "observed" });
  });
});

describe("computeCreditCardCapacity", () => {
  it("keeps card debt, available credit and positive overpayment separate", () => {
    expect(computeCreditCardCapacity({ currency: "PLN", accountBalanceMinor: -20000n, approvedLimitMinor: 100000n })).toMatchObject({ creditLimitMinor: 100000n, outstandingDebtMinor: 20000n, overpaymentMinor: 0n, availableCreditMinor: 80000n });
    expect(computeCreditCardCapacity({ currency: "PLN", accountBalanceMinor: 15000n, approvedLimitMinor: 100000n })).toMatchObject({ outstandingDebtMinor: 0n, overpaymentMinor: 15000n, availableCreditMinor: 100000n });
  });

  it("preserves observed availability and flags inconsistent observations", () => {
    expect(computeCreditCardCapacity({ currency: "PLN", accountBalanceMinor: -20000n, approvedLimitMinor: 100000n, observedUsedMinor: 25000n, observedAvailableMinor: 70000n })).toMatchObject({ basis: "observed", warning: "inconsistent_observation", outstandingDebtMinor: 25000n, availableCreditMinor: 70000n });
  });
});
describe("validateCreditSnapshot", () => {
  it("requires a date whenever an observed component is entered", () => {
    expect(() => validateCreditSnapshot({ currency: "PLN", observedAvailable: { currency: currencyCode("PLN"), amountMinor: 100n }, observedAt: null })).toThrow("observation date");
    expect(() => validateCreditSnapshot({ currency: "PLN", observedAt: new Date() })).toThrow("observation date");
  });
});
