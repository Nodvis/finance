import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@nodvis/finance-db", () => ({
  ObligationNotFoundError: class ObligationNotFoundError extends Error {},
  ObligationVersionConflictError: class ObligationVersionConflictError extends Error {},
  ObligationValidationError: class ObligationValidationError extends Error {},
  ObligationMatchConflictError: class ObligationMatchConflictError extends Error {},
  isPersonInHousehold: vi.fn(),
  listObligationsByHousehold: vi.fn(),
  getObligationById: vi.fn(),
  createObligationInDb: vi.fn(),
  updateObligationInDb: vi.fn(),
  cancelObligationInDb: vi.fn(),
  matchObligationInDb: vi.fn(),
  unlinkObligationInDb: vi.fn(),
  listCandidateTransactionsForObligation: vi.fn(),
  getUpcomingObligationsSummary: vi.fn(),
  serializeObligation: vi.fn((row) => ({
    ...row,
    amountMinor: row.amountMinor.toString(),
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    matchedTransaction: row.matchedTransaction
      ? {
          ...row.matchedTransaction,
          amountMinor: row.matchedTransaction.amountMinor.toString(),
          occurredOn: row.matchedTransaction.occurredOn.toISOString(),
        }
      : null,
  })),
}));

import {
  isPersonInHousehold,
  listObligationsByHousehold,
  getObligationById,
  createObligationInDb,
  updateObligationInDb,
  cancelObligationInDb,
  matchObligationInDb,
  unlinkObligationInDb,
} from "@nodvis/finance-db";
import { householdId, personId } from "@nodvis/finance-domain";
import {
  createHouseholdObligation,
  getHouseholdObligation,
  HouseholdAccessDeniedError,
  listHouseholdObligations,
  matchHouseholdObligation,
  unlinkHouseholdObligation,
  updateHouseholdObligation,
  cancelHouseholdObligation,
} from "./service";

const validHousehold = householdId("018f47a0-7762-7b9c-8d17-27f2f79e59a1");
const validPerson = personId("018f47a0-7762-7b9c-8d17-27f2f79e59a2");

const testContext = {
  authUserId: "user-1",
  householdId: validHousehold,
  personId: validPerson,
  householdName: "Our Home",
  personDisplayName: "Eryk",
  defaultCurrency: "PLN",
};

describe("Obligations Web Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isPersonInHousehold).mockResolvedValue(true);
  });

  it("rejects operation if user is not a member of the household", async () => {
    vi.mocked(isPersonInHousehold).mockResolvedValue(false);

    await expect(listHouseholdObligations(testContext)).rejects.toThrow(
      HouseholdAccessDeniedError,
    );
  });

  it("lists household obligations and returns serialized rows", async () => {
    const mockRow = {
      id: "ob-1",
      householdId: validHousehold,
      title: "Rent",
      amountMinor: 250000n,
      currency: "PLN",
      dueDate: "2026-09-15",
      notes: null,
      transactionId: null,
      version: 1,
      status: "upcoming" as const,
      cancelledAt: null,
      createdAt: new Date("2026-09-01"),
      updatedAt: new Date("2026-09-01"),
    };
    vi.mocked(listObligationsByHousehold).mockResolvedValue([mockRow]);

    const result = await listHouseholdObligations(testContext);

    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe("Rent");
    expect(result[0]?.amountMinor).toBe("250000");
  });

  it("creates an obligation parsing natural decimal input via BigInt", async () => {
    const mockRow = {
      id: "ob-2",
      householdId: validHousehold,
      title: "Utility",
      amountMinor: 12345n,
      currency: "PLN",
      dueDate: "2026-09-20",
      notes: "Power",
      transactionId: null,
      version: 1,
      status: "upcoming" as const,
      cancelledAt: null,
      createdAt: new Date("2026-09-01"),
      updatedAt: new Date("2026-09-01"),
    };
    vi.mocked(createObligationInDb).mockResolvedValue(mockRow);

    const result = await createHouseholdObligation(testContext, {
      title: "Utility",
      amountNatural: "123.45",
      currency: "PLN",
      dueDate: "2026-09-20",
      notes: "Power",
    });

    expect(createObligationInDb).toHaveBeenCalledWith(validHousehold, {
      title: "Utility",
      amountMinor: 12345n,
      currency: "PLN",
      dueDate: "2026-09-20",
      notes: "Power",
    });
    expect(result.amountMinor).toBe("12345");
  });

  it("matches an obligation to an active transaction", async () => {
    const mockMatched = {
      id: "ob-1",
      householdId: validHousehold,
      title: "Rent",
      amountMinor: 250000n,
      currency: "PLN",
      dueDate: "2026-09-15",
      notes: null,
      transactionId: "tx-1",
      version: 2,
      status: "paid" as const,
      cancelledAt: null,
      createdAt: new Date("2026-09-01"),
      updatedAt: new Date("2026-09-10"),
      matchedTransaction: {
        id: "tx-1",
        payee: "Landlord",
        occurredOn: new Date("2026-09-10"),
        amountMinor: 250000n,
        currency: "PLN",
      },
    };
    vi.mocked(matchObligationInDb).mockResolvedValue(mockMatched);

    const result = await matchHouseholdObligation(testContext, "ob-1", {
      version: 1,
      transactionId: "tx-1",
    });

    expect(matchObligationInDb).toHaveBeenCalledWith(
      validHousehold,
      "ob-1",
      1,
      "tx-1",
    );
    expect(result.status).toBe("paid");
    expect(result.transactionId).toBe("tx-1");
  });

  it("unlinks an obligation from a transaction", async () => {
    const mockUnlinked = {
      id: "ob-1",
      householdId: validHousehold,
      title: "Rent",
      amountMinor: 250000n,
      currency: "PLN",
      dueDate: "2026-09-15",
      notes: null,
      transactionId: null,
      version: 3,
      status: "upcoming" as const,
      cancelledAt: null,
      createdAt: new Date("2026-09-01"),
      updatedAt: new Date("2026-09-11"),
    };
    vi.mocked(unlinkObligationInDb).mockResolvedValue(mockUnlinked);

    const result = await unlinkHouseholdObligation(testContext, "ob-1", {
      version: 2,
    });

    expect(unlinkObligationInDb).toHaveBeenCalledWith(
      validHousehold,
      "ob-1",
      2,
    );
    expect(result.transactionId).toBeNull();
    expect(result.status).toBe("upcoming");
  });

  it("cancels an obligation", async () => {
    const mockCancelled = {
      id: "ob-1",
      householdId: validHousehold,
      title: "Rent",
      amountMinor: 250000n,
      currency: "PLN",
      dueDate: "2026-09-15",
      notes: null,
      transactionId: null,
      version: 2,
      status: "cancelled" as const,
      cancelledAt: new Date("2026-09-10"),
      createdAt: new Date("2026-09-01"),
      updatedAt: new Date("2026-09-10"),
    };
    vi.mocked(cancelObligationInDb).mockResolvedValue(mockCancelled);

    const result = await cancelHouseholdObligation(testContext, "ob-1", {
      version: 1,
    });

    expect(cancelObligationInDb).toHaveBeenCalledWith(
      validHousehold,
      "ob-1",
      1,
    );
    expect(result.status).toBe("cancelled");
  });
});
