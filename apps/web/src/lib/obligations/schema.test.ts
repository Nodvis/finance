import { describe, expect, it } from "vitest";

import { calendarDateSchema, obligationQuerySchema } from "./schema";

describe("obligation calendar date schema", () => {
  it("rejects dates that are shaped correctly but do not exist", () => {
    expect(calendarDateSchema.safeParse("2026-02-31").success).toBe(false);
    expect(obligationQuerySchema.safeParse({ today: "2026-02-31" }).success).toBe(false);
  });

  it("accepts leap-day dates", () => {
    expect(calendarDateSchema.safeParse("2028-02-29").success).toBe(true);
  });

  it("parses valid obligationQuerySchema with status, scope, currency, sorting, and limit", () => {
    const result = obligationQuerySchema.safeParse({
      status: "active",
      scope: "active",
      currency: "pln",
      sortOrder: "desc",
      limit: "25",
      offset: "10",
      today: "2026-09-10",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("active");
      expect(result.data.scope).toBe("active");
      expect(result.data.currency).toBe("PLN");
      expect(result.data.sortOrder).toBe("desc");
      expect(result.data.limit).toBe(25);
      expect(result.data.offset).toBe(10);
      expect(result.data.today).toBe("2026-09-10");
    }
  });

  it("transforms sort=dueDateDesc and sort=dueDateAsc into sortOrder", () => {
    const descResult = obligationQuerySchema.safeParse({ sort: "dueDateDesc" });
    expect(descResult.success).toBe(true);
    if (descResult.success) {
      expect(descResult.data.sortOrder).toBe("desc");
    }

    const ascResult = obligationQuerySchema.safeParse({ sort: "dueDateAsc" });
    expect(ascResult.success).toBe(true);
    if (ascResult.success) {
      expect(ascResult.data.sortOrder).toBe("asc");
    }
  });

  it("accepts history and individual statuses", () => {
    for (const status of ["all", "active", "upcoming", "overdue", "paid", "cancelled", "history"] as const) {
      expect(obligationQuerySchema.safeParse({ status }).success).toBe(true);
    }
  });
});