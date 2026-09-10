import { describe, expect, it } from "vitest";

import { overviewQuerySchema } from "./schema";

describe("overviewQuerySchema", () => {
  it("rejects incomplete custom date ranges", () => {
    expect(() => overviewQuerySchema.parse({ from: "2026-09-01" })).toThrow();
    expect(() => overviewQuerySchema.parse({ to: "2026-09-30" })).toThrow();
  });

  it("accepts a complete calendar date range", () => {
    expect(
      overviewQuerySchema.parse({ from: "2026-09-01", to: "2026-09-30" }),
    ).toEqual({ from: "2026-09-01", to: "2026-09-30" });
  });
});
