import { describe, expect, it } from "vitest";

import {
  AccountInvalidOwnerError,
  AccountNotFoundError,
} from "./accounts";

describe("db accounts access invariants", () => {
  it("provides specific error classes for account not found and invalid owner", () => {
    const notFoundErr = new AccountNotFoundError("Custom account missing");
    expect(notFoundErr).toBeInstanceOf(Error);
    expect(notFoundErr.name).toBe("AccountNotFoundError");
    expect(notFoundErr.message).toBe("Custom account missing");

    const invalidOwnerErr = new AccountInvalidOwnerError("Owner not in household");
    expect(invalidOwnerErr).toBeInstanceOf(Error);
    expect(invalidOwnerErr.name).toBe("AccountInvalidOwnerError");
    expect(invalidOwnerErr.message).toBe("Owner not in household");
  });
});
