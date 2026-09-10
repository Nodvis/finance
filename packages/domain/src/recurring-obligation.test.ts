import { describe, expect, it } from "vitest";

import { generateRecurringDueDates } from "./recurring-obligation";

describe("generateRecurringDueDates", () => {
  it("generates weekly and respects inclusive boundaries", () => {
    expect(generateRecurringDueDates({ frequency: "weekly", firstDueDate: "2026-01-05" }, "2026-01-19")).toEqual([
      "2026-01-05", "2026-01-12", "2026-01-19",
    ]);
  });

  it("normalizes monthly month ends", () => {
    expect(generateRecurringDueDates({ frequency: "monthly", firstDueDate: "2026-01-31" }, "2026-04-30")).toEqual([
      "2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30",
    ]);
  });

  it("handles leap-year February and yearly leap dates", () => {
    expect(generateRecurringDueDates({ frequency: "monthly", firstDueDate: "2024-01-31" }, "2024-03-31")).toEqual([
      "2024-01-31", "2024-02-29", "2024-03-31",
    ]);
    expect(generateRecurringDueDates({ frequency: "yearly", firstDueDate: "2024-02-29" }, "2030-03-01")).toEqual([
      "2024-02-29", "2025-02-28", "2026-02-28", "2027-02-28", "2028-02-29", "2029-02-28", "2030-02-28",
    ]);
  });

  it("honors start/end and does not generate unbounded rows", () => {
    expect(generateRecurringDueDates({ frequency: "monthly", firstDueDate: "2026-05-15", endDate: "2026-06-15" }, "2030-01-01")).toEqual([
      "2026-05-15", "2026-06-15",
    ]);
    expect(generateRecurringDueDates({ frequency: "monthly", firstDueDate: "2026-05-15" }, "2026-05-01")).toEqual([]);
  });
});
