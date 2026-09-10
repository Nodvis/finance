import { describe, expect, it } from "vitest";

import { minorToNatural } from "./presentation";

describe("obligation amount presentation", () => {
  it("uses the currency fraction digits when opening an edit form", () => {
    expect(minorToNatural("1500", "JPY")).toBe("1500");
    expect(minorToNatural("12345", "KWD")).toBe("12.345");
    expect(minorToNatural("14999", "PLN")).toBe("149.99");
  });
});
