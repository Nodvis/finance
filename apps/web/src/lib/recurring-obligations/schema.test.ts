import { describe, expect, it } from "vitest";

import { createRecurringObligationSchema } from "./schema";

describe("recurring obligation request schema", () => {
  it("rejects impossible calendar dates and reversed end dates", () => {
    expect(() => createRecurringObligationSchema.parse({
      title: "Rent", amountNatural: "100.00", currency: "PLN", frequency: "monthly", firstDueDate: "2026-02-30",
    })).toThrow();
    expect(() => createRecurringObligationSchema.parse({
      title: "Rent", amountNatural: "100.00", currency: "PLN", frequency: "monthly", firstDueDate: "2026-03-01", endDate: "2026-02-28",
    })).toThrow();
  });

  it("accepts exact minor-unit strings without converting them to Number", () => {
    const value = createRecurringObligationSchema.parse({
      title: "Large invoice", amountMinor: "9007199254740993", currency: "EUR", frequency: "yearly", firstDueDate: "2028-02-29",
    });
    expect(value.amountMinor).toBe("9007199254740993");
  });
});
