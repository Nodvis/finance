import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@nodvis/finance-db", () => ({
  AccountIdentifierNotFoundError: class AccountIdentifierNotFoundError extends Error {
    constructor() {
      super("Account identifier not found in household");
      this.name = "AccountIdentifierNotFoundError";
    }
  },
  DuplicateAccountIdentifierError: class DuplicateAccountIdentifierError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = "DuplicateAccountIdentifierError";
    }
  },
  InvalidAccountIdentifierError: class InvalidAccountIdentifierError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = "InvalidAccountIdentifierError";
    }
  },
  listAccountIdentifiersByHousehold: vi.fn(),
  findAccountIdentifierById: vi.fn(),
  addAccountIdentifier: vi.fn(),
  deleteAccountIdentifier: vi.fn(),
}));

import {
  AccountIdentifierNotFoundError,
  DuplicateAccountIdentifierError,
  addAccountIdentifier,
  deleteAccountIdentifier,
  findAccountIdentifierById,
  listAccountIdentifiersByHousehold,
} from "@nodvis/finance-db";
import {
  createHouseholdAccountIdentifier,
  getHouseholdAccountIdentifier,
  listHouseholdAccountIdentifiers,
  removeHouseholdAccountIdentifier,
} from "./service";

const mockContext = {
  authUserId: "auth-1",
  householdId: "018f47a0-7762-7b9c-8d17-27f2f79e59a1" as any,
  personId: "018f47a0-7762-7b9c-8d17-27f2f79e59a2" as any,
  householdName: "Our Family",
  personDisplayName: "Eryk",
  defaultCurrency: "PLN",
};

describe("account-identifiers service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates listing identifiers to db access layer", async () => {
    const mockList = [
      {
        id: "id-1",
        householdId: mockContext.householdId,
        accountId: "acc-1",
        identifierType: "iban",
        rawIdentifier: "PL74109024020000000123456789",
        normalizedIdentifier: "PL74109024020000000123456789",
        formattedIdentifier: "PL74 1090 2402 0000 0001 2345 6789",
        maskedIdentifier: "PL74 •••• •••• •••• •••• •••• 6789",
        label: "Main",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    vi.mocked(listAccountIdentifiersByHousehold).mockResolvedValue(mockList as any);

    const result = await listHouseholdAccountIdentifiers(mockContext, "acc-1");
    expect(listAccountIdentifiersByHousehold).toHaveBeenCalledWith(
      mockContext.householdId,
      "acc-1",
    );
    expect(result).toEqual(mockList);
  });

  it("creates account identifier delegating to db access", async () => {
    const mockRecord = {
      id: "id-1",
      householdId: mockContext.householdId,
      accountId: "acc-1",
      identifierType: "domestic_nrb",
      rawIdentifier: "74109024020000000123456789",
      normalizedIdentifier: "PL74109024020000000123456789",
      formattedIdentifier: "PL74 1090 2402 0000 0001 2345 6789",
      maskedIdentifier: "PL74 •••• •••• •••• •••• •••• 6789",
      label: "Domestic",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(addAccountIdentifier).mockResolvedValue(mockRecord as any);

    const result = await createHouseholdAccountIdentifier(mockContext, "acc-1", {
      rawIdentifier: "74109024020000000123456789",
      label: "Domestic",
    });

    expect(addAccountIdentifier).toHaveBeenCalledWith({
      householdId: mockContext.householdId,
      accountId: "acc-1",
      rawIdentifier: "74109024020000000123456789",
      label: "Domestic",
    });
    expect(result).toEqual(mockRecord);
  });

  it("throws not found when getting non-existent identifier", async () => {
    vi.mocked(findAccountIdentifierById).mockResolvedValue(null);

    await expect(
      getHouseholdAccountIdentifier(mockContext, "missing-id"),
    ).rejects.toThrow(AccountIdentifierNotFoundError);
  });

  it("deletes identifier delegating to db access", async () => {
    vi.mocked(deleteAccountIdentifier).mockResolvedValue(undefined);

    await removeHouseholdAccountIdentifier(mockContext, "del-1");
    expect(deleteAccountIdentifier).toHaveBeenCalledWith(
      mockContext.householdId,
      "del-1",
    );
  });
});
