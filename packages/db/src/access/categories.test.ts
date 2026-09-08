import { describe, expect, it } from "vitest";

import {
  CategoryNotFoundError,
} from "./categories";

describe("db categories access invariants", () => {
  it("provides specific error class for category not found in household", () => {
    const notFoundErr = new CategoryNotFoundError("Category not found");
    expect(notFoundErr).toBeInstanceOf(Error);
    expect(notFoundErr.name).toBe("CategoryNotFoundError");
    expect(notFoundErr.message).toBe("Category not found");
  });
});
