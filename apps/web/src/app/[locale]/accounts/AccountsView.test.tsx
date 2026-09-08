import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { SerializedHouseholdAccount } from "@/lib/accounts/serialization";
import type { SerializedAccountIdentifier } from "@/lib/account-identifiers/service";
import type { AuthorizedHouseholdUserContext } from "@/lib/authorization/household";
import { AccountsView } from "./AccountsView";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string, params?: Record<string, unknown>) => {
    if (params) {
      return `${ns}.${key}:${JSON.stringify(params)}`;
    }
    return `${ns}.${key}`;
  },
}));

describe("AccountsView Component", () => {
  const mockContext: AuthorizedHouseholdUserContext = {
    authUserId: "u-1",
    householdId: "018f47a0-7762-7b9c-8d17-27f2f79e59a1" as any,
    personId: "018f47a0-7762-7b9c-8d17-27f2f79e59a2" as any,
    householdName: "Our Household",
    defaultCurrency: "PLN",
    personDisplayName: "Alice",
  };

  const mockAccounts: SerializedHouseholdAccount[] = [
    {
      id: "acc-1",
      householdId: "018f47a0-7762-7b9c-8d17-27f2f79e59a1",
      name: "Main Checking",
      type: "checking",
      currency: "PLN",
      balanceSnapshotMinor: "125000",
      balanceSnapshotAt: "2026-09-01T12:00:00.000Z",
      archivedAt: null,
      ownerPersonIds: ["018f47a0-7762-7b9c-8d17-27f2f79e59a2"],
    },
    {
      id: "acc-2",
      householdId: "018f47a0-7762-7b9c-8d17-27f2f79e59a1",
      name: "Savings Wallet",
      type: "savings",
      currency: "EUR",
      balanceSnapshotMinor: null,
      balanceSnapshotAt: null,
      archivedAt: null,
      ownerPersonIds: ["018f47a0-7762-7b9c-8d17-27f2f79e59a2"],
    },
  ];

  const mockIdentifiers: SerializedAccountIdentifier[] = [
    {
      id: "iden-1",
      householdId: "018f47a0-7762-7b9c-8d17-27f2f79e59a1",
      accountId: "acc-1",
      identifierType: "iban",
      formattedIdentifier: "PL 74 1090 2402 0000 0001 2345 6789",
      maskedIdentifier: "PL74 •••• •••• •••• •••• •••• 6789",
      label: "Główne konto rozliczeniowe",
      createdAt: "2026-09-01T12:00:00.000Z",
      updatedAt: "2026-09-01T12:00:00.000Z",
    },
  ];

  const mockMembers = [
    {
      personId: "018f47a0-7762-7b9c-8d17-27f2f79e59a2",
      displayName: "Alice",
    },
  ];

  it("renders active accounts with masked identifiers and manage buttons", () => {
    const html = renderToStaticMarkup(
      <AccountsView
        householdContext={mockContext}
        allHouseholds={[]}
        initialAccounts={mockAccounts}
        initialIdentifiers={mockIdentifiers}
        members={mockMembers}
        locale="pl"
      />,
    );

    expect(html).toContain("Main Checking");
    expect(html).toContain("Savings Wallet");

    // Masked identifier displayed for acc-1
    expect(html).toContain("PL74 •••• •••• •••• •••• •••• 6789");
    expect(html).toContain("Główne konto rozliczeniowe");

    // Empty state for acc-2 which has no identifiers
    expect(html).toContain("Accounts.noIdentifiers");

    // Manage identifiers action button present
    expect(html).toContain("Accounts.actions.manageIdentifiers");
    expect(html).toContain("Accounts.actions.addIdentifier");

    // Ensure raw unmasked number is NEVER rendered on cards
    expect(html).not.toContain("PL74109024020000000123456789");
    expect(html).not.toContain("74109024020000000123456789");
  });
});
