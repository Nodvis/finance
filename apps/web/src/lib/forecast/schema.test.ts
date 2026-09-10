import { describe, expect, it } from "vitest";

import { forecastQuerySchema } from "./schema";

describe("forecastQuerySchema", () => {
  it("defaults to a bounded seven-day horizon", () => {
    expect(forecastQuerySchema.parse({})).toEqual({ horizon: "7" });
  });

  it("rejects unsupported horizons and invalid calendar dates", () => {
    expect(forecastQuerySchema.safeParse({ horizon: "365" }).success).toBe(false);
    expect(forecastQuerySchema.safeParse({ asOf: "2026-02-30" }).success).toBe(false);
  });
});
