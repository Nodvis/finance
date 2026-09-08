import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/session", () => ({
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {
    constructor() {
      super("Authentication is required");
      this.name = "AuthenticationRequiredError";
    }
  },
}));

vi.mock("@/lib/authorization/household", () => ({
  HouseholdAccessDeniedError: class HouseholdAccessDeniedError extends Error {
    constructor() {
      super("Household access denied");
      this.name = "HouseholdAccessDeniedError";
    }
  },
  requireHouseholdAccess: vi.fn(),
}));

vi.mock("@/lib/account-identifiers/service", () => ({
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
  listHouseholdAccountIdentifiers: vi.fn(),
  createHouseholdAccountIdentifier: vi.fn(),
}));

import { requireHouseholdAccess } from "@/lib/authorization/household";
import {
  createHouseholdAccountIdentifier,
  listHouseholdAccountIdentifiers,
} from "@/lib/account-identifiers/service";
import { GET, POST } from "./route";

const hId = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";
const accId = "018f47a0-7762-7b9c-8d17-27f2f79e59a2";
const testAccess = { authUserId: "u1", householdId: hId, personId: "p1" };

describe("/api/households/[householdId]/accounts/[accountId]/identifiers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns identifiers for account", async () => {
    vi.mocked(requireHouseholdAccess).mockResolvedValue(testAccess as any);
    vi.mocked(listHouseholdAccountIdentifiers).mockResolvedValue([
      { id: "iden-1", normalizedIdentifier: "PL74109024020000000123456789" } as any,
    ]);

    const req = new Request("http://localhost");
    const res = await GET(req, {
      params: Promise.resolve({ householdId: hId, accountId: accId }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(listHouseholdAccountIdentifiers).toHaveBeenCalledWith(
      testAccess,
      accId,
    );
  });

  it("POST creates identifier with valid Polish NRB/IBAN", async () => {
    vi.mocked(requireHouseholdAccess).mockResolvedValue(testAccess as any);
    const mockRecord = {
      id: "iden-1",
      normalizedIdentifier: "PL74109024020000000123456789",
      maskedIdentifier: "PL74 •••• •••• •••• •••• •••• 6789",
    };
    vi.mocked(createHouseholdAccountIdentifier).mockResolvedValue(mockRecord as any);

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        rawIdentifier: "74 1090 2402 0000 0001 2345 6789",
        label: "Domestic",
      }),
    });

    const res = await POST(req, {
      params: Promise.resolve({ householdId: hId, accountId: accId }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data).toEqual(mockRecord);
  });

  it("POST returns 400 on invalid identifier checksum/format", async () => {
    vi.mocked(requireHouseholdAccess).mockResolvedValue(testAccess as any);

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        rawIdentifier: "invalid-iban-12345",
      }),
    });

    const res = await POST(req, {
      params: Promise.resolve({ householdId: hId, accountId: accId }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });
});
