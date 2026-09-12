import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn((namespace: string) => {
    return (key: string, params?: Record<string, unknown>) => {
      if (params) {
        return `${namespace}.${key}:${JSON.stringify(params)}`;
      }
      return `${namespace}.${key}`;
    };
  }),
}));

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

vi.mock("@nodvis/finance-db", () => ({
  listAccountsByHousehold: vi.fn().mockResolvedValue([]),
  listLiabilitiesByHousehold: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/net-worth/service", () => ({
  getHouseholdNetWorthSummary: vi.fn(),
  listHouseholdBalanceHistory: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/net-worth/serialization", () => ({
  serializeNetWorthSummary: vi.fn((s) => s),
  serializeBalanceObservation: vi.fn((o) => o),
}));

vi.mock("./NetWorthView", () => ({
  NetWorthView: vi.fn(() => null),
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
  listAccountsByHousehold,
  listLiabilitiesByHousehold,
} from "@nodvis/finance-db";
import {
  getHouseholdNetWorthSummary,
  listHouseholdBalanceHistory,
} from "@/lib/net-worth/service";
import { NetWorthView } from "./NetWorthView";
import NetWorthPage from "./page";

describe("NetWorthPage Server Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls notFound() for invalid locale", async () => {
    await NetWorthPage({
      params: Promise.resolve({ locale: "fr" }),
    });

    expect(mockNotFound).toHaveBeenCalled();
  });

  it("renders sign-in card when unauthenticated", async () => {
    vi.mocked(getCurrentSession).mockResolvedValueOnce(null);

    const result = await NetWorthPage({
      params: Promise.resolve({ locale: "en" }),
    });

    expect(result).toBeDefined();
    expect(getCurrentSession).toHaveBeenCalled();
    expect(getCurrentUserHouseholdsStatus).not.toHaveBeenCalled();
  });

  it("renders NoHouseholdCard when user has no household", async () => {
    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: {
        id: "u-1",
        email: "alice@example.com",
        name: "Alice",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: {
        id: "s-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: "u-1",
        expiresAt: new Date(),
        token: "tok",
      },
    });
    vi.mocked(getCurrentUserHouseholdsStatus).mockResolvedValueOnce({
      status: "none",
    });

    const result = await NetWorthPage({
      params: Promise.resolve({ locale: "pl" }),
    });

    expect(result).toBeDefined();
    expect(getCurrentUserHouseholdsStatus).toHaveBeenCalled();
    expect(getHouseholdNetWorthSummary).not.toHaveBeenCalled();
  });

  it("renders HouseholdSelectionCard when multiple households require selection", async () => {
    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: {
        id: "u-1",
        email: "alice@example.com",
        name: "Alice",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: {
        id: "s-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: "u-1",
        expiresAt: new Date(),
        token: "tok",
      },
    });
    vi.mocked(getCurrentUserHouseholdsStatus).mockResolvedValueOnce({
      status: "multiple_needs_selection",
      households: [
        {
          householdId: "h-1",
          householdName: "Household A",
          personId: "p-1",
          personDisplayName: "Alice",
          defaultCurrency: "PLN",
        },
      ],
    });

    const result = await NetWorthPage({
      params: Promise.resolve({ locale: "en" }),
    });

    expect(result).toBeDefined();
    expect(getCurrentUserHouseholdsStatus).toHaveBeenCalled();
    expect(getHouseholdNetWorthSummary).not.toHaveBeenCalled();
  });

  it("renders NetWorthView with data when household is active", async () => {
    const activeContext = {
      authUserId: "u-1",
      householdId: "018f47a0-7762-7b9c-8d17-27f2f79e59a1" as any,
      householdName: "Alice Household",
      personId: "018f47a0-7762-7b9c-8d17-27f2f79e59a2" as any,
      personDisplayName: "Alice",
      defaultCurrency: "PLN",
    };

    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: {
        id: "u-1",
        email: "alice@example.com",
        name: "Alice",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: {
        id: "s-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: "u-1",
        expiresAt: new Date(),
        token: "tok",
      },
    });
    vi.mocked(getCurrentUserHouseholdsStatus).mockResolvedValueOnce({
      status: "single",
      activeContext,
    });

    const mockSummary = {
      byCurrency: [
        {
          currency: "PLN",
          currentNetWorthMinor: "500000",
          currentAssetsMinor: "600000",
          currentLiabilitiesMinor: "100000",
          currentConfidence: "complete" as const,
          currentIsComplete: true,
          missingSubjectNames: [],
          points: [],
        },
      ],
    };

    vi.mocked(getHouseholdNetWorthSummary).mockResolvedValueOnce(mockSummary as any);
    vi.mocked(listAccountsByHousehold).mockResolvedValueOnce([
      {
        id: "acc-1",
        householdId: activeContext.householdId,
        name: "Checking",
        type: "checking",
        currency: "PLN",
      } as any,
    ]);
    vi.mocked(listLiabilitiesByHousehold).mockResolvedValueOnce([
      {
        id: "liab-1",
        householdId: activeContext.householdId,
        name: "Car Loan",
        kind: "loan",
        currency: "PLN",
      } as any,
    ]);
    vi.mocked(listHouseholdBalanceHistory).mockResolvedValueOnce([
      {
        id: "obs-1",
        householdId: activeContext.householdId,
        subjectKind: "account" as const,
        subjectId: "acc-1",
        subjectName: "Checking",
        currency: "PLN",
        amountMinor: 600000n,
        observedAt: new Date("2026-03-01T12:00:00Z"),
        source: "manual" as const,
        note: "Monthly check",
        createdAt: new Date("2026-03-01T12:00:00Z"),
      } as any,
    ]);

    const result = await NetWorthPage({
      params: Promise.resolve({ locale: "pl" }),
    });

    expect(result).toBeDefined();
    expect(getHouseholdNetWorthSummary).toHaveBeenCalledWith(activeContext);
    expect(listAccountsByHousehold).toHaveBeenCalledWith(
      activeContext.householdId,
      { includeArchived: false },
    );
    expect(listLiabilitiesByHousehold).toHaveBeenCalledWith(
      activeContext.householdId,
      { includeArchived: false },
    );
    expect(listHouseholdBalanceHistory).toHaveBeenCalledWith(
      activeContext,
      { limit: 100 },
    );
    expect((result as any).props.children.type).toBe(NetWorthView);
    expect((result as any).props.children.props.householdId).toBe(activeContext.householdId);
    expect((result as any).props.children.props.summary).toBe(mockSummary);
    expect((result as any).props.children.props.accounts).toHaveLength(1);
    expect((result as any).props.children.props.liabilities).toHaveLength(1);
    expect((result as any).props.children.props.observations).toHaveLength(1);
  });
});
