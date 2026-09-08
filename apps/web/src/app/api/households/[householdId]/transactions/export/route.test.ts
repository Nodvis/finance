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

vi.mock("@/lib/transactions/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/transactions/service")>();
  return {
    ...actual,
    exportManualTransactionsToCsv: vi.fn(),
  };
});

import { AuthenticationRequiredError } from "@/lib/auth/session";
import {
  HouseholdAccessDeniedError,
  requireHouseholdAccess,
} from "@/lib/authorization/household";
import { exportManualTransactionsToCsv } from "@/lib/transactions/service";
import { GET } from "./route";

const validHousehold = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";
const validPerson = "018f47a0-7762-7b9c-8d17-27f2f79e59a2";

describe("Transactions Export API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const authorizedContext = {
    authUserId: "auth-user-1",
    householdId: validHousehold as any,
    personId: validPerson as any,
  };

  it("returns 401 when authentication is missing", async () => {
    vi.mocked(requireHouseholdAccess).mockRejectedValueOnce(
      new AuthenticationRequiredError(),
    );

    const req = new Request("http://localhost/api/households/any/transactions/export");
    const response = await GET(req, {
      params: Promise.resolve({ householdId: validHousehold }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 403 when household access is denied", async () => {
    vi.mocked(requireHouseholdAccess).mockRejectedValueOnce(
      new HouseholdAccessDeniedError(),
    );

    const req = new Request("http://localhost/api/households/any/transactions/export");
    const response = await GET(req, {
      params: Promise.resolve({ householdId: validHousehold }),
    });

    expect(response.status).toBe(403);
  });

  it("returns 200 with text/csv header, attachment filename, and exported CSV in EN", async () => {
    vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(authorizedContext);
    vi.mocked(exportManualTransactionsToCsv).mockResolvedValueOnce(
      "\uFEFFDate,Type,Amount,Currency,Account,Category,Description,Status,Void Reason\r\n",
    );

    const req = new Request(
      `http://localhost/api/households/${validHousehold}/transactions/export?kind=expense&month=2026-09&locale=en`,
    );
    const response = await GET(req, {
      params: Promise.resolve({ householdId: validHousehold }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toContain("attachment; filename=");
    const text = await response.text();
    expect(text).toContain("Date,Type,Amount,Currency,Account,Category,Description,Status,Void Reason");
    expect(exportManualTransactionsToCsv).toHaveBeenCalledWith(
      authorizedContext,
      expect.objectContaining({
        kind: "expense",
        month: "2026-09",
      }),
      "en",
    );
  });

  it("exports CSV in Polish when locale=pl is provided", async () => {
    vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(authorizedContext);
    vi.mocked(exportManualTransactionsToCsv).mockResolvedValueOnce(
      "\uFEFFData,Typ,Kwota,Waluta,Konto,Kategoria,Opis,Status,Powód anulowania\r\n",
    );

    const req = new Request(
      `http://localhost/api/households/${validHousehold}/transactions/export?locale=pl`,
    );
    const response = await GET(req, {
      params: Promise.resolve({ householdId: validHousehold }),
    });

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("Data,Typ,Kwota,Waluta,Konto,Kategoria,Opis,Status,Powód anulowania");
    expect(exportManualTransactionsToCsv).toHaveBeenCalledWith(
      authorizedContext,
      expect.anything(),
      "pl",
    );
  });

  it("returns 400 when invalid query parameters are supplied", async () => {
    vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(authorizedContext);

    const req = new Request(
      `http://localhost/api/households/${validHousehold}/transactions/export?month=invalid-month`,
    );
    const response = await GET(req, {
      params: Promise.resolve({ householdId: validHousehold }),
    });

    expect(response.status).toBe(400);
  });
});
