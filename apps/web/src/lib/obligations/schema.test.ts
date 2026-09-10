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
});