import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockNotFound = vi.fn();
vi.mock("next/navigation", () => ({
  notFound: () => mockNotFound(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: vi.fn(),
}));

vi.mock("@/lib/authorization/household", () => ({
  getCurrentUserHouseholdsStatus: vi.fn(),
}));

vi.mock("@/lib/accounts/service", () => ({
  listHouseholdAccountsSummary: vi.fn(),
  listMembersInHousehold: vi.fn(),
}));

vi.mock("@/lib/accounts/serialization", () => ({
  serializeAccount: vi.fn((a) => a),
}));

vi.mock("@/lib/account-identifiers/service", () => ({
  listHouseholdAccountIdentifiers: vi.fn().mockResolvedValue([]),
  serializeAccountIdentifier: vi.fn((a) => a),
}));

vi.mock("@nodvis/finance-db", () => ({
  listCreditFacilitiesByHousehold: vi.fn().mockResolvedValue([]),
  serializeCreditFacility: vi.fn((facility) => facility),
}));

vi.mock("./AccountsView", () => ({
  AccountsView: vi.fn(() => null),
}));

vi.mock("../components/NoHouseholdCard", () => ({
  NoHouseholdCard: vi.fn(() => null),
}));

vi.mock("../components/HouseholdSelectionCard", () => ({
  HouseholdSelectionCard: vi.fn(() => null),
}));

vi.mock("../components/SignInCard", () => ({
  SignInCard: vi.fn(() => null),
}));

import { notFound } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { getCurrentUserHouseholdsStatus } from "@/lib/authorization/household";
import {
  listHouseholdAccountsSummary,
  listMembersInHousehold,
} from "@/lib/accounts/service";
import AccountsPage from "./page";

describe("AccountsPage Server Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls notFound() for invalid locale", async () => {
    await AccountsPage({
      params: Promise.resolve({ locale: "de" }),
    });

    expect(mockNotFound).toHaveBeenCalled();
  });

  it("renders sign-in card when unauthenticated", async () => {
    vi.mocked(getCurrentSession).mockResolvedValueOnce(null);

    const result = await AccountsPage({
      params: Promise.resolve({ locale: "pl" }),
    });

    expect(result).toBeDefined();
    expect(getCurrentSession).toHaveBeenCalled();
    expect(getCurrentUserHouseholdsStatus).not.toHaveBeenCalled();
  });

  it("renders NoHouseholdCard when user has no households", async () => {
    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "u-1", email: "alice@example.com", name: "Alice", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
      session: { id: "s-1", createdAt: new Date(), updatedAt: new Date(), userId: "u-1", expiresAt: new Date(), token: "t" },
    });
    vi.mocked(getCurrentUserHouseholdsStatus).mockResolvedValueOnce({
      status: "none",
    });

    const result = await AccountsPage({
      params: Promise.resolve({ locale: "en" }),
    });

    expect(result).toBeDefined();
    expect(getCurrentUserHouseholdsStatus).toHaveBeenCalled();
    expect(listHouseholdAccountsSummary).not.toHaveBeenCalled();
  });

  it("renders HouseholdSelectionCard when multiple households require selection", async () => {
    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "u-1", email: "alice@example.com", name: "Alice", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
      session: { id: "s-1", createdAt: new Date(), updatedAt: new Date(), userId: "u-1", expiresAt: new Date(), token: "t" },
    });
    vi.mocked(getCurrentUserHouseholdsStatus).mockResolvedValueOnce({
      status: "multiple_needs_selection",
      households: [
        {
          householdId: "h-1",
          householdName: "Household 1",
          personId: "p-1",
          personDisplayName: "Alice",
          defaultCurrency: "PLN",
        },
        {
          householdId: "h-2",
          householdName: "Household 2",
          personId: "p-2",
          personDisplayName: "Alice",
          defaultCurrency: "EUR",
        },
      ],
    });

    const result = await AccountsPage({
      params: Promise.resolve({ locale: "pl" }),
    });

    expect(result).toBeDefined();
    expect(getCurrentUserHouseholdsStatus).toHaveBeenCalled();
    expect(listHouseholdAccountsSummary).not.toHaveBeenCalled();
  });

  it("renders AccountsView with accounts and members when household is active", async () => {
    const activeContext = {
      authUserId: "u-1",
      householdId: "018f47a0-7762-7b9c-8d17-27f2f79e59a1" as any,
      householdName: "Alice Household",
      personId: "018f47a0-7762-7b9c-8d17-27f2f79e59a2" as any,
      personDisplayName: "Alice",
      defaultCurrency: "PLN",
    };

    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "u-1", email: "alice@example.com", name: "Alice", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
      session: { id: "s-1", createdAt: new Date(), updatedAt: new Date(), userId: "u-1", expiresAt: new Date(), token: "t" },
    });
    vi.mocked(getCurrentUserHouseholdsStatus).mockResolvedValueOnce({
      status: "single",
      activeContext,
    });
    vi.mocked(listHouseholdAccountsSummary).mockResolvedValueOnce([
      {
        id: "acc-1",
        householdId: "018f47a0-7762-7b9c-8d17-27f2f79e59a1",
        name: "Main Checking",
        type: "checking",
        currency: "PLN",
        balanceSnapshotMinor: 100000n,
        balanceSnapshotAt: new Date(),
        archivedAt: null,
        ownerPersonIds: ["018f47a0-7762-7b9c-8d17-27f2f79e59a2"],
      },
    ]);
    vi.mocked(listMembersInHousehold).mockResolvedValueOnce([
      {
        personId: "018f47a0-7762-7b9c-8d17-27f2f79e59a2",
        displayName: "Alice",
        joinedAt: new Date(),
      },
    ]);

    const result = await AccountsPage({
      params: Promise.resolve({ locale: "pl" }),
    });

    expect(result).toBeDefined();
    expect(listHouseholdAccountsSummary).toHaveBeenCalledWith(activeContext);
    expect(listMembersInHousehold).toHaveBeenCalledWith(activeContext);
  });
});
