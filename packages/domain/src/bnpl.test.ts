import { describe, expect, it } from "vitest";
import {
  BNPL_PAYMENT_MODELS,
  BNPL_PURCHASE_STATUSES,
  createBnplPurchase,
  isBnplPaymentModel,
  isBnplPurchaseStatus,
  isBnplPurchaseVoided,
  updateBnplPurchase,
  voidBnplPurchase,
} from "./bnpl";
import {
  bnplPurchaseId,
  creditFacilityId,
  householdId,
  transactionId,
} from "./identity";
import { money } from "./money";

describe("BNPL Financed Purchase Domain", () => {
  const defaultHousehold = householdId("018f47a0-7762-7b9c-8d17-27f2f79e59a1");
  const defaultFacility = creditFacilityId(
    "018f47a0-7762-7b9c-8d17-27f2f79e59a2",
  );
  const defaultPurchaseId = bnplPurchaseId(
    "018f47a0-7762-7b9c-8d17-27f2f79e59a3",
  );

  const baseInput = {
    id: defaultPurchaseId,
    householdId: defaultHousehold,
    creditFacilityId: defaultFacility,
    provider: "Allegro Pay",
    product: "pay_in_30",
    merchant: "Allegro",
    description: "Office Supplies",
    purchaseDate: new Date("2026-09-01T10:00:00Z"),
    originalAmount: money(15000n, "PLN"),
    financedAmount: money(15000n, "PLN"),
    currency: "PLN",
  };

  it("creates a BNPL financed purchase with minimal fields and valid defaults", () => {
    const purchase = createBnplPurchase(baseInput);

    expect(purchase.id).toBe(defaultPurchaseId);
    expect(purchase.householdId).toBe(defaultHousehold);
    expect(purchase.creditFacilityId).toBe(defaultFacility);
    expect(purchase.provider).toBe("Allegro Pay");
    expect(purchase.product).toBe("pay_in_30");
    expect(purchase.merchant).toBe("Allegro");
    expect(purchase.description).toBe("Office Supplies");
    expect(purchase.originalAmount.amountMinor).toBe(15000n);
    expect(purchase.financedAmount.amountMinor).toBe(15000n);
    expect(purchase.currency).toBe("PLN");
    expect(purchase.financingDate.toISOString()).toBe(
      baseInput.purchaseDate.toISOString(),
    );
    expect(purchase.paymentModel).toBe("pay_in_30");
    expect(purchase.status).toBe("active");
    expect(purchase.observedOutstanding).toBeNull();
    expect(purchase.observedOutstandingAt).toBeNull();
    expect(purchase.dueDate).toBeNull();
    expect(purchase.principalAmount).toBeNull();
    expect(purchase.interestAmount).toBeNull();
    expect(purchase.feeAmount).toBeNull();
    expect(purchase.transactionId).toBeNull();
    expect(purchase.version).toBe(1);
    expect(purchase.voidedAt).toBeNull();
    expect(purchase.voidReason).toBeNull();
    expect(isBnplPurchaseVoided(purchase)).toBe(false);
  });

  it("creates a BNPL purchase with all optional fields and allocations", () => {
    const txId = transactionId("018f47a0-7762-7b9c-8d17-27f2f79e59a4");
    const purchase = createBnplPurchase({
      ...baseInput,
      financingDate: new Date("2026-09-02T12:00:00Z"),
      paymentModel: "installments",
      status: "active",
      observedOutstanding: money(10000n, "PLN"),
      observedOutstandingAt: new Date("2026-09-05T00:00:00Z"),
      dueDate: new Date("2026-10-01T00:00:00Z"),
      principalAmount: money(13000n, "PLN"),
      interestAmount: money(1500n, "PLN"),
      feeAmount: money(500n, "PLN"),
      transactionId: txId,
    });

    expect(purchase.financingDate.toISOString()).toBe("2026-09-02T12:00:00.000Z");
    expect(purchase.paymentModel).toBe("installments");
    expect(purchase.observedOutstanding?.amountMinor).toBe(10000n);
    expect(purchase.observedOutstandingAt?.toISOString()).toBe(
      "2026-09-05T00:00:00.000Z",
    );
    expect(purchase.dueDate?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(purchase.principalAmount?.amountMinor).toBe(13000n);
    expect(purchase.interestAmount?.amountMinor).toBe(1500n);
    expect(purchase.feeAmount?.amountMinor).toBe(500n);
    expect(purchase.transactionId).toBe(txId);
  });

  it("validates payment models and statuses", () => {
    expect(BNPL_PAYMENT_MODELS).toContain("pay_in_full");
    expect(BNPL_PAYMENT_MODELS).toContain("pay_in_30");
    expect(BNPL_PAYMENT_MODELS).toContain("installments");
    expect(BNPL_PAYMENT_MODELS).toContain("split_pay");
    expect(BNPL_PAYMENT_MODELS).toContain("revolving");

    expect(isBnplPaymentModel("pay_in_30")).toBe(true);
    expect(isBnplPaymentModel("invalid_model")).toBe(false);

    expect(BNPL_PURCHASE_STATUSES).toContain("pending");
    expect(BNPL_PURCHASE_STATUSES).toContain("active");
    expect(BNPL_PURCHASE_STATUSES).toContain("settled");
    expect(BNPL_PURCHASE_STATUSES).toContain("overdue");
    expect(BNPL_PURCHASE_STATUSES).toContain("cancelled");
    expect(BNPL_PURCHASE_STATUSES).toContain("defaulted");

    expect(isBnplPurchaseStatus("active")).toBe(true);
    expect(isBnplPurchaseStatus("invalid_status")).toBe(false);
  });

  it("rejects blank or overly long provider, product, and merchant", () => {
    expect(() =>
      createBnplPurchase({ ...baseInput, provider: "   " }),
    ).toThrow("Provider cannot be blank");
    expect(() =>
      createBnplPurchase({ ...baseInput, product: "" }),
    ).toThrow("Product cannot be blank");
    expect(() =>
      createBnplPurchase({ ...baseInput, merchant: "   " }),
    ).toThrow("Merchant cannot be blank");

    const longString = "a".repeat(161);
    expect(() =>
      createBnplPurchase({ ...baseInput, provider: longString }),
    ).toThrow("exceeds maximum length");
  });

  it("rejects non-positive original and financed amounts", () => {
    expect(() =>
      createBnplPurchase({
        ...baseInput,
        originalAmount: money(0n, "PLN"),
      }),
    ).toThrow("Original amount must be strictly positive");

    expect(() =>
      createBnplPurchase({
        ...baseInput,
        financedAmount: money(-500n, "PLN"),
      }),
    ).toThrow("Financed amount must be strictly positive");
  });

  it("enforces currency consistency across amounts", () => {
    expect(() =>
      createBnplPurchase({
        ...baseInput,
        originalAmount: money(10000n, "EUR"),
      }),
    ).toThrow("Original amount currency (EUR) does not match purchase currency (PLN)");

    expect(() =>
      createBnplPurchase({
        ...baseInput,
        financedAmount: money(10000n, "USD"),
      }),
    ).toThrow("Financed amount currency (USD) does not match purchase currency (PLN)");

    expect(() =>
      createBnplPurchase({
        ...baseInput,
        observedOutstanding: money(5000n, "EUR"),
        observedOutstandingAt: new Date(),
      }),
    ).toThrow("Observed outstanding currency (EUR) does not match purchase currency (PLN)");

    expect(() =>
      createBnplPurchase({
        ...baseInput,
        principalAmount: money(5000n, "EUR"),
      }),
    ).toThrow("Principal amount currency (EUR) does not match purchase currency (PLN)");
  });

  it("requires both observed outstanding amount and observation date together", () => {
    expect(() =>
      createBnplPurchase({
        ...baseInput,
        observedOutstanding: money(5000n, "PLN"),
        observedOutstandingAt: null,
      }),
    ).toThrow(
      "Observed outstanding amount and observation date must both be provided or both be null",
    );

    expect(() =>
      createBnplPurchase({
        ...baseInput,
        observedOutstanding: null,
        observedOutstandingAt: new Date(),
      }),
    ).toThrow(
      "Observed outstanding amount and observation date must both be provided or both be null",
    );
  });

  it("voids an active purchase and preserves void metadata", () => {
    const purchase = createBnplPurchase(baseInput);
    const voidTime = new Date("2026-09-08T15:00:00Z");
    const voided = voidBnplPurchase(purchase, "Duplicate entry", voidTime);

    expect(voided.voidedAt?.toISOString()).toBe(voidTime.toISOString());
    expect(voided.voidReason).toBe("Duplicate entry");
    expect(voided.version).toBe(2);
    expect(isBnplPurchaseVoided(voided)).toBe(true);

    expect(() => voidBnplPurchase(voided, "Again")).toThrow(
      "BNPL purchase is already voided",
    );
  });

  it("updates / corrects purchase fields and increments version", () => {
    const purchase = createBnplPurchase(baseInput);
    const updated = updateBnplPurchase(purchase, {
      description: "Updated Supplies description",
      status: "settled",
      dueDate: new Date("2026-10-15T00:00:00Z"),
      observedOutstanding: money(0n, "PLN"),
      observedOutstandingAt: new Date("2026-10-01T00:00:00Z"),
    });

    expect(updated.description).toBe("Updated Supplies description");
    expect(updated.status).toBe("settled");
    expect(updated.dueDate?.toISOString()).toBe("2026-10-15T00:00:00.000Z");
    expect(updated.observedOutstanding?.amountMinor).toBe(0n);
    expect(updated.version).toBe(2);
  });

  it("disallows updating a voided purchase", () => {
    const purchase = createBnplPurchase(baseInput);
    const voided = voidBnplPurchase(purchase, "Canceled order");

    expect(() =>
      updateBnplPurchase(voided, {
        description: "Trying to edit",
      }),
    ).toThrow("Cannot update a voided BNPL purchase");
  });
});
