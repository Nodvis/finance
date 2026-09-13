import { describe, expect, it } from "vitest";
import { isValidCalendarDate } from "./calendar-date";

describe("isValidCalendarDate", () => {
  it("rejects impossible calendar dates", () => {
    expect(isValidCalendarDate("2026-02-29")).toBe(false);
    expect(isValidCalendarDate("2024-02-29")).toBe(true);
  });
});