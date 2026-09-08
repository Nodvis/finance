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

vi.mock("@/lib/categories/service", () => ({
  listHouseholdCategories: vi.fn(),
}));

vi.mock("@/lib/categories/serialization", () => ({
  serializeCategory: vi.fn((c) => c),
}));

vi.mock("./CategoriesView", () => ({
  CategoriesView: vi.fn(() => null),
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
import { listHouseholdCategories } from "@/lib/categories/service";
import { householdId, personId } from "@nodvis/finance-domain";
import CategoriesPage from "./page";

describe("CategoriesPage Server Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls notFound() for invalid locale", async () => {
    await CategoriesPage({
      params: Promise.resolve({ locale: "de" }),
    });

    expect(mockNotFound).toHaveBeenCalled();
  });

  it("renders SignInCard when unauthenticated", async () => {
    vi.mocked(getCurrentSession).mockResolvedValueOnce(null);

    const result = await CategoriesPage({
      params: Promise.resolve({ locale: "pl" }),
    });

    expect(result).toBeDefined();
    expect(getCurrentSession).toHaveBeenCalled();
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

    const result = await CategoriesPage({
      params: Promise.resolve({ locale: "pl" }),
    });

    expect(result).toBeDefined();
    expect(listHouseholdCategories).not.toHaveBeenCalled();
  });

  it("renders HouseholdSelectionCard when user has multiple households and none selected", async () => {
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
      status: "multiple_needs_selection",
      households: [
        {
          householdId: "h-1",
          personId: "p-1",
          householdName: "Household 1",
          defaultCurrency: "PLN",
          personDisplayName: "Alice",
        },
        {
          householdId: "h-2",
          personId: "p-2",
          householdName: "Household 2",
          defaultCurrency: "EUR",
          personDisplayName: "Alice",
        },
      ],
    });

    const result = await CategoriesPage({
      params: Promise.resolve({ locale: "pl" }),
    });

    expect(result).toBeDefined();
    expect(listHouseholdCategories).not.toHaveBeenCalled();
  });

  it("renders CategoriesView when user has an active household context", async () => {
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
      activeContext: {
        authUserId: "u-1",
        householdId: householdId("018f47a0-7762-7b9c-8d17-27f2f79e59a1"),
        personId: personId("018f47a0-7762-7b9c-8d17-27f2f79e59a2"),
        householdName: "Our Home",
        personDisplayName: "Alice",
        defaultCurrency: "PLN",
      },
    });
    vi.mocked(listHouseholdCategories).mockResolvedValueOnce([
      {
        id: "cat-1",
        householdId: "018f47a0-7762-7b9c-8d17-27f2f79e59a1",
        name: "Groceries",
        applicability: "expense",
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await CategoriesPage({
      params: Promise.resolve({ locale: "pl" }),
    });

    expect(result).toBeDefined();
    expect(listHouseholdCategories).toHaveBeenCalledWith(
      expect.objectContaining({
        householdId: "018f47a0-7762-7b9c-8d17-27f2f79e59a1",
      }),
      { includeArchived: true },
    );
  });
});
