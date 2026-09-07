import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@nodvis/finance-db", () => ({
  AccountInvalidOwnerError: class AccountInvalidOwnerError extends Error {
    constructor(message: string = "Account owner must be a member of the household") {
      super(message);
      this.name = "AccountInvalidOwnerError";
    }
  },
  AccountNotFoundError: class AccountNotFoundError extends Error {
    constructor(message: string = "Account not found in household") {
      super(message);
      this.name = "AccountNotFoundError";
    }
  },
  archiveHouseholdAccount: vi.fn(),
  createHouseholdAccount: vi.fn(),
  findAccountInHousehold: vi.fn(),
  listAccountsByHousehold: vi.fn(),
  listHouseholdMembers: vi.fn(),
  unarchiveHouseholdAccount: vi.fn(),
  updateHouseholdAccountMetadata: vi.fn(),
}));

import {
  archiveHouseholdAccount,
  createHouseholdAccount,
  findAccountInHousehold,
  listAccountsByHousehold,
  listHouseholdMembers,
  unarchiveHouseholdAccount,
  updateHouseholdAccountMetadata,
} from "@nodvis/finance-db";
import {
  archiveAccount,
  createHouseholdAccountEntry,
  getHouseholdAccount,
  listHouseholdAccountsSummary,
  listMembersInHousehold,
  unarchiveAccount,
  updateHouseholdAccountMetadataEntry,
} from "./service";

const validHousehold = "018f47a0-7762-7b9c-8d17-27f2f79e59a1" as any;
const validPerson = "018f47a0-7762-7b9c-8d17-27f2f79e59a2" as any;
const validAccount = "018f47a0-7762-7b9c-8d17-27f2f79e59a3";

const testContext = {
  authUserId: "user-1",
  householdId: validHousehold,
  personId: validPerson,
  householdName: "Our Home",
  personDisplayName: "Eryk",
  defaultCurrency: "PLN",
};

describe("Accounts Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createHouseholdAccountEntry", () => {
    it("creates an account with unknown balance when no initial balance is provided", async () => {
      vi.mocked(createHouseholdAccount).mockResolvedValueOnce({
        id: validAccount,
        householdId: validHousehold,
        name: "Main checking",
        type: "checking",
        currency: "PLN",
        balanceSnapshotMinor: null,
        balanceSnapshotAt: null,
        archivedAt: null,
        ownerPersonIds: [validPerson],
      });

      const res = await createHouseholdAccountEntry(testContext, {
        name: "Main checking",
        type: "checking",
        currency: "PLN",
        ownerPersonIds: [validPerson],
      });

      expect(res.name).toBe("Main checking");
      expect(createHouseholdAccount).toHaveBeenCalledWith({
        householdId: validHousehold,
        name: "Main checking",
        type: "checking",
        currency: "PLN",
        ownerPersonIds: [validPerson],
        balanceSnapshotMinor: null,
        balanceSnapshotAt: null,
      });
    });

    it("parses natural money input into exact bigint minor units for positive balance", async () => {
      const fixedDate = new Date("2026-09-07T12:00:00Z");
      vi.mocked(createHouseholdAccount).mockResolvedValueOnce({
        id: validAccount,
        householdId: validHousehold,
        name: "Savings",
        type: "savings",
        currency: "PLN",
        balanceSnapshotMinor: 125050n,
        balanceSnapshotAt: fixedDate,
        archivedAt: null,
        ownerPersonIds: [validPerson],
      });

      await createHouseholdAccountEntry(testContext, {
        name: "Savings",
        type: "savings",
        currency: "PLN",
        ownerPersonIds: [validPerson],
        initialBalance: {
          amountNatural: "1250,50",
          capturedAt: fixedDate,
        },
      });

      expect(createHouseholdAccount).toHaveBeenCalledWith({
        householdId: validHousehold,
        name: "Savings",
        type: "savings",
        currency: "PLN",
        ownerPersonIds: [validPerson],
        balanceSnapshotMinor: 125050n,
        balanceSnapshotAt: fixedDate,
      });
    });

    it("parses negative balance for credit cards into exact negative bigint minor units", async () => {
      const fixedDate = new Date("2026-09-07T12:00:00Z");
      vi.mocked(createHouseholdAccount).mockResolvedValueOnce({
        id: validAccount,
        householdId: validHousehold,
        name: "Visa Card",
        type: "credit_card",
        currency: "PLN",
        balanceSnapshotMinor: -45000n,
        balanceSnapshotAt: fixedDate,
        archivedAt: null,
        ownerPersonIds: [validPerson],
      });

      await createHouseholdAccountEntry(testContext, {
        name: "Visa Card",
        type: "credit_card",
        currency: "PLN",
        ownerPersonIds: [validPerson],
        initialBalance: {
          amountNatural: "-450.00",
          capturedAt: fixedDate,
        },
      });

      expect(createHouseholdAccount).toHaveBeenCalledWith({
        householdId: validHousehold,
        name: "Visa Card",
        type: "credit_card",
        currency: "PLN",
        ownerPersonIds: [validPerson],
        balanceSnapshotMinor: -45000n,
        balanceSnapshotAt: fixedDate,
      });
    });
  });

  describe("updateHouseholdAccountMetadataEntry", () => {
    it("updates account name and owners", async () => {
      vi.mocked(updateHouseholdAccountMetadata).mockResolvedValueOnce({
        id: validAccount,
        householdId: validHousehold,
        name: "Renamed account",
        type: "checking",
        currency: "PLN",
        balanceSnapshotMinor: null,
        balanceSnapshotAt: null,
        archivedAt: null,
        ownerPersonIds: [validPerson],
      });

      const res = await updateHouseholdAccountMetadataEntry(testContext, validAccount, {
        name: "Renamed account",
      });

      expect(res.name).toBe("Renamed account");
      expect(updateHouseholdAccountMetadata).toHaveBeenCalledWith({
        householdId: validHousehold,
        accountId: validAccount,
        name: "Renamed account",
        ownerPersonIds: undefined,
      });
    });
  });

  describe("archive and unarchive", () => {
    it("delegates archive without deleting the account", async () => {
      const archiveDate = new Date("2026-09-07T14:00:00Z");
      vi.mocked(archiveHouseholdAccount).mockResolvedValueOnce({
        id: validAccount,
        householdId: validHousehold,
        name: "Old Account",
        type: "checking",
        currency: "PLN",
        balanceSnapshotMinor: null,
        balanceSnapshotAt: null,
        archivedAt: archiveDate,
        ownerPersonIds: [validPerson],
      });

      const res = await archiveAccount(testContext, validAccount);
      expect(res.archivedAt).toEqual(archiveDate);
      expect(archiveHouseholdAccount).toHaveBeenCalledWith(validHousehold, validAccount);
    });

    it("delegates unarchive to restore account", async () => {
      vi.mocked(unarchiveHouseholdAccount).mockResolvedValueOnce({
        id: validAccount,
        householdId: validHousehold,
        name: "Restored Account",
        type: "checking",
        currency: "PLN",
        balanceSnapshotMinor: null,
        balanceSnapshotAt: null,
        archivedAt: null,
        ownerPersonIds: [validPerson],
      });

      const res = await unarchiveAccount(testContext, validAccount);
      expect(res.archivedAt).toBeNull();
      expect(unarchiveHouseholdAccount).toHaveBeenCalledWith(validHousehold, validAccount);
    });
  });

  describe("listHouseholdAccountsSummary & listMembersInHousehold", () => {
    it("lists accounts for the authorized household", async () => {
      vi.mocked(listAccountsByHousehold).mockResolvedValueOnce([]);
      await listHouseholdAccountsSummary(testContext);
      expect(listAccountsByHousehold).toHaveBeenCalledWith(validHousehold, undefined);
    });

    it("lists members for the authorized household", async () => {
      vi.mocked(listHouseholdMembers).mockResolvedValueOnce([]);
      await listMembersInHousehold(testContext);
      expect(listHouseholdMembers).toHaveBeenCalledWith(validHousehold);
    });
  });
});
