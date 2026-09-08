import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@nodvis/finance-db", () => ({
  listAccountsByHousehold: vi.fn(),
  listAccountIdentifiersByHousehold: vi.fn(),
  listTransactionsByHousehold: vi.fn(),
  executeTransferMatch: vi.fn(),
  listTransferMatchesByHousehold: vi.fn(),
}));

import {
  executeTransferMatch,
  listAccountIdentifiersByHousehold,
  listAccountsByHousehold,
  listTransactionsByHousehold,
} from "@nodvis/finance-db";
import {
  autoMatchAllConfirmedReady,
  getHouseholdTransferCandidates,
  matchTransferEntry,
} from "./service";

const mockContext = {
  authUserId: "auth-1",
  householdId: "018f47a0-7762-7b9c-8d17-27f2f79e59a1" as any,
  personId: "018f47a0-7762-7b9c-8d17-27f2f79e59a2" as any,
  householdName: "Family",
  personDisplayName: "Anna",
  defaultCurrency: "PLN",
};

describe("transfers service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calculates transfer candidates and groups them by confidence", async () => {
    const acc1 = { id: "acc-1", name: "Checking", currency: "PLN" };
    const acc2 = { id: "acc-2", name: "Savings", currency: "PLN" };
    const idenSavings = {
      id: "id-1",
      accountId: "acc-2",
      normalizedIdentifier: "PL74109024020000000123456789",
    };

    const expTx = {
      id: "tx-1",
      householdId: mockContext.householdId,
      kind: "expense",
      accountId: "acc-1",
      amount: { amountMinor: 50000n, currency: "PLN" },
      payee: "Transfer PL74109024020000000123456789",
      occurredOn: new Date("2026-09-08T10:00:00Z"),
      version: 1,
      voidedAt: null,
    };
    const incTx = {
      id: "tx-2",
      householdId: mockContext.householdId,
      kind: "income",
      accountId: "acc-2",
      amount: { amountMinor: 50000n, currency: "PLN" },
      source: "Deposit",
      occurredOn: new Date("2026-09-08T11:00:00Z"),
      version: 1,
      voidedAt: null,
    };

    vi.mocked(listAccountsByHousehold).mockResolvedValue([acc1, acc2] as any);
    vi.mocked(listAccountIdentifiersByHousehold).mockResolvedValue([
      idenSavings,
    ] as any);
    vi.mocked(listTransactionsByHousehold).mockResolvedValue([
      expTx,
      incTx,
    ] as any);

    const summary = await getHouseholdTransferCandidates(mockContext);

    expect(summary.candidates).toHaveLength(1);
    expect(summary.candidates[0]!.confidence).toBe("ready_auto");
    expect(summary.candidates[0]!.amountMinor).toBe("50000");
    expect(summary.counts.readyAuto).toBe(1);
    expect(summary.counts.total).toBe(1);
  });

  it("executes transfer match delegating to db access", async () => {
    const mockResult = {
      transfer: {
        id: "tx-1",
        kind: "transfer",
        amount: { amountMinor: 50000n, currency: "PLN" },
      },
      match: {
        id: "match-1",
        transferTransactionId: "tx-1",
        matchedTransactionId: "tx-2",
        matchConfidence: "automatic",
      },
    };
    vi.mocked(executeTransferMatch).mockResolvedValue(mockResult as any);

    const result = await matchTransferEntry(mockContext, {
      outflowTransactionId: "tx-1",
      expectedOutflowVersion: 1,
      inflowTransactionId: "tx-2",
      expectedInflowVersion: 1,
      matchConfidence: "automatic",
    });

    expect(executeTransferMatch).toHaveBeenCalledWith({
      householdId: mockContext.householdId,
      outflowTransactionId: "tx-1",
      expectedOutflowVersion: 1,
      inflowTransactionId: "tx-2",
      expectedInflowVersion: 1,
      matchConfidence: "automatic",
      matchedIdentifier: undefined,
      notes: undefined,
    });
    expect(result).toEqual(mockResult);
  });

  it("auto-matches confirmed ready candidates", async () => {
    const acc1 = { id: "acc-1", name: "Checking", currency: "PLN" };
    const acc2 = { id: "acc-2", name: "Savings", currency: "PLN" };
    const idenSavings = {
      id: "id-1",
      accountId: "acc-2",
      normalizedIdentifier: "PL74109024020000000123456789",
    };
    const expTx = {
      id: "tx-1",
      householdId: mockContext.householdId,
      kind: "expense",
      accountId: "acc-1",
      amount: { amountMinor: 50000n, currency: "PLN" },
      payee: "Transfer PL74109024020000000123456789",
      occurredOn: new Date("2026-09-08T10:00:00Z"),
      version: 1,
      voidedAt: null,
    };
    const incTx = {
      id: "tx-2",
      householdId: mockContext.householdId,
      kind: "income",
      accountId: "acc-2",
      amount: { amountMinor: 50000n, currency: "PLN" },
      source: "Deposit",
      occurredOn: new Date("2026-09-08T11:00:00Z"),
      version: 1,
      voidedAt: null,
    };

    vi.mocked(listAccountsByHousehold).mockResolvedValue([acc1, acc2] as any);
    vi.mocked(listAccountIdentifiersByHousehold).mockResolvedValue([
      idenSavings,
    ] as any);
    vi.mocked(listTransactionsByHousehold).mockResolvedValue([
      expTx,
      incTx,
    ] as any);
    vi.mocked(executeTransferMatch).mockResolvedValue({} as any);

    const autoResult = await autoMatchAllConfirmedReady(mockContext);
    expect(autoResult.matchedCount).toBe(1);
    expect(autoResult.errors).toHaveLength(0);
    expect(executeTransferMatch).toHaveBeenCalled();
  });
});
