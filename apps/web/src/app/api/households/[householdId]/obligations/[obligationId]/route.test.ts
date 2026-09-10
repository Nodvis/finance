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

vi.mock("@/lib/obligations/service", () => ({
  ObligationNotFoundError: class ObligationNotFoundError extends Error {},
  ObligationVersionConflictError: class ObligationVersionConflictError extends Error {},
  ObligationValidationError: class ObligationValidationError extends Error {},
  ObligationMatchConflictError: class ObligationMatchConflictError extends Error {},
  HouseholdAccessDeniedError: class HouseholdAccessDeniedError extends Error {},
  getHouseholdObligation: vi.fn(),
  updateHouseholdObligation: vi.fn(),
  cancelHouseholdObligation: vi.fn(),
  matchHouseholdObligation: vi.fn(),
  unlinkHouseholdObligation: vi.fn(),
}));

import { requireHouseholdAccess } from "@/lib/authorization/household";
import {
  getHouseholdObligation,
  updateHouseholdObligation,
  cancelHouseholdObligation,
  matchHouseholdObligation,
  unlinkHouseholdObligation,
} from "@/lib/obligations/service";
import { GET, PATCH, DELETE } from "./route";
import { POST as matchPost } from "./match/route";
import { POST as unlinkPost } from "./unlink/route";
import { POST as cancelPost } from "./cancel/route";

const validHousehold = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";
const validObligation = "018f47a0-7762-7b9c-8d17-27f2f79e59a2";
const validTx = "018f47a0-7762-7b9c-8d17-27f2f79e59a3";

const testAccess = {
  authUserId: "user-1",
  householdId: validHousehold,
  personId: "person-1",
};

describe("/api/households/[householdId]/obligations/[obligationId] routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireHouseholdAccess).mockResolvedValue(testAccess as any);
  });

  it("GET returns obligation detail", async () => {
    vi.mocked(getHouseholdObligation).mockResolvedValue({
      id: validObligation,
      householdId: validHousehold,
      title: "Rent",
      amountMinor: "250000",
      currency: "PLN",
      dueDate: "2026-09-15",
      notes: null,
      transactionId: null,
      version: 1,
      status: "upcoming",
      cancelledAt: null,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    });

    const response = await GET(
      new Request(`http://localhost/api/households/${validHousehold}/obligations/${validObligation}`),
      { params: Promise.resolve({ householdId: validHousehold, obligationId: validObligation }) },
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.title).toBe("Rent");
  });

  it("PATCH updates obligation fields", async () => {
    vi.mocked(updateHouseholdObligation).mockResolvedValue({
      id: validObligation,
      householdId: validHousehold,
      title: "Updated Rent",
      amountMinor: "250000",
      currency: "PLN",
      dueDate: "2026-09-15",
      notes: null,
      transactionId: null,
      version: 2,
      status: "upcoming",
      cancelledAt: null,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-02T00:00:00.000Z",
    });

    const response = await PATCH(
      new Request(`http://localhost/api/households/${validHousehold}/obligations/${validObligation}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: 1,
          title: "Updated Rent",
        }),
      }),
      { params: Promise.resolve({ householdId: validHousehold, obligationId: validObligation }) },
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.title).toBe("Updated Rent");
  });

  it("DELETE cancels obligation", async () => {
    vi.mocked(cancelHouseholdObligation).mockResolvedValue({
      id: validObligation,
      householdId: validHousehold,
      title: "Rent",
      amountMinor: "250000",
      currency: "PLN",
      dueDate: "2026-09-15",
      notes: null,
      transactionId: null,
      version: 2,
      status: "cancelled",
      cancelledAt: "2026-09-10T00:00:00.000Z",
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-10T00:00:00.000Z",
    });

    const response = await DELETE(
      new Request(`http://localhost/api/households/${validHousehold}/obligations/${validObligation}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: 1 }),
      }),
      { params: Promise.resolve({ householdId: validHousehold, obligationId: validObligation }) },
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.status).toBe("cancelled");
  });

  it("POST /match links obligation to active transaction", async () => {
    vi.mocked(matchHouseholdObligation).mockResolvedValue({
      id: validObligation,
      householdId: validHousehold,
      title: "Rent",
      amountMinor: "250000",
      currency: "PLN",
      dueDate: "2026-09-15",
      notes: null,
      transactionId: validTx,
      version: 2,
      status: "paid",
      cancelledAt: null,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-10T00:00:00.000Z",
    });

    const response = await matchPost(
      new Request(`http://localhost/api/households/${validHousehold}/obligations/${validObligation}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: 1,
          transactionId: validTx,
        }),
      }),
      { params: Promise.resolve({ householdId: validHousehold, obligationId: validObligation }) },
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.status).toBe("paid");
  });

  it("POST /unlink unlinks transaction from obligation", async () => {
    vi.mocked(unlinkHouseholdObligation).mockResolvedValue({
      id: validObligation,
      householdId: validHousehold,
      title: "Rent",
      amountMinor: "250000",
      currency: "PLN",
      dueDate: "2026-09-15",
      notes: null,
      transactionId: null,
      version: 3,
      status: "upcoming",
      cancelledAt: null,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-11T00:00:00.000Z",
    });

    const response = await unlinkPost(
      new Request(`http://localhost/api/households/${validHousehold}/obligations/${validObligation}/unlink`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: 2 }),
      }),
      { params: Promise.resolve({ householdId: validHousehold, obligationId: validObligation }) },
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.status).toBe("upcoming");
  });

  it("POST /cancel cancels obligation", async () => {
    vi.mocked(cancelHouseholdObligation).mockResolvedValue({
      id: validObligation,
      householdId: validHousehold,
      title: "Rent",
      amountMinor: "250000",
      currency: "PLN",
      dueDate: "2026-09-15",
      notes: null,
      transactionId: null,
      version: 2,
      status: "cancelled",
      cancelledAt: "2026-09-10T00:00:00.000Z",
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-10T00:00:00.000Z",
    });

    const response = await cancelPost(
      new Request(`http://localhost/api/households/${validHousehold}/obligations/${validObligation}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: 1 }),
      }),
      { params: Promise.resolve({ householdId: validHousehold, obligationId: validObligation }) },
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.status).toBe("cancelled");
  });
});
