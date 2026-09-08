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

vi.mock("@/lib/transfers/service", () => ({
  getHouseholdTransferCandidates: vi.fn(),
  listReconciledTransfers: vi.fn(),
  serializeReconciledTransfer: vi.fn((r) => r),
}));

vi.mock("./TransfersView", () => ({
  TransfersView: vi.fn(() => null),
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
  getHouseholdTransferCandidates,
  listReconciledTransfers,
} from "@/lib/transfers/service";
import TransfersPage from "./page";

describe("TransfersPage Server Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls notFound() for invalid locale", async () => {
    await TransfersPage({
      params: Promise.resolve({ locale: "de" }),
    });
    expect(mockNotFound).toHaveBeenCalled();
  });

  it("renders SignInCard when session is null", async () => {
    vi.mocked(getCurrentSession).mockResolvedValueOnce(null);

    const result = await TransfersPage({
      params: Promise.resolve({ locale: "en" }),
    });

    expect(result).toBeDefined();
    expect(getCurrentUserHouseholdsStatus).not.toHaveBeenCalled();
  });

  it("renders NoHouseholdCard when user has no households", async () => {
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
        token: "t",
      },
    });
    vi.mocked(getCurrentUserHouseholdsStatus).mockResolvedValueOnce({
      status: "none",
    });

    const result = await TransfersPage({
      params: Promise.resolve({ locale: "en" }),
    });

    expect(result).toBeDefined();
  });

  it("renders TransfersView with candidates and reconciled records when household is active", async () => {
    const activeContext = {
      authUserId: "u-1",
      householdId: "018f47a0-7762-7b9c-8d17-27f2f79e59a1" as any,
      personId: "018f47a0-7762-7b9c-8d17-27f2f79e59a2" as any,
      householdName: "Our Household",
      defaultCurrency: "PLN",
      personDisplayName: "Alice",
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
        token: "t",
      },
    });
    vi.mocked(getCurrentUserHouseholdsStatus).mockResolvedValueOnce({
      status: "single",
      activeContext,
    });
    vi.mocked(getHouseholdTransferCandidates).mockResolvedValueOnce({
      candidates: [],
      counts: {
        readyAuto: 0,
        reviewOnly: 0,
        oneSidedPending: 0,
        ambiguous: 0,
        total: 0,
      },
    });
    vi.mocked(listReconciledTransfers).mockResolvedValueOnce([]);

    const result = await TransfersPage({
      params: Promise.resolve({ locale: "pl" }),
    });

    expect(result).toBeDefined();
    expect(getHouseholdTransferCandidates).toHaveBeenCalledWith(activeContext);
    expect(listReconciledTransfers).toHaveBeenCalledWith(activeContext, {
      limit: 100,
    });
  });
});
