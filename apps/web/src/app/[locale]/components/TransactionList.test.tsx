import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { HouseholdAccountSummary, HouseholdCategorySummary } from "@nodvis/finance-db";
import type { SerializedTransaction } from "@/lib/transactions/schema";

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

import { TransactionList } from "./TransactionList";

describe("TransactionList Component", () => {
  const mockAccounts: HouseholdAccountSummary[] = [
    {
      id: "account-1",
      householdId: "hh-1",
      name: "Checking Account",
      type: "checking",
      currency: "PLN",
      balanceSnapshotMinor: 150000n,
      balanceSnapshotAt: new Date("2026-09-01T00:00:00.000Z"),
      owners: [],
      ownerPersonIds: [],
      archivedAt: null,
    },
    {
      id: "account-2",
      householdId: "hh-1",
      name: "Savings Account",
      type: "savings",
      currency: "PLN",
      balanceSnapshotMinor: 500000n,
      balanceSnapshotAt: new Date("2026-09-01T00:00:00.000Z"),
      owners: [],
      ownerPersonIds: [],
      archivedAt: null,
    },
  ];

  const mockCategories: HouseholdCategorySummary[] = [
    {
      id: "cat-1",
      householdId: "hh-1",
      name: "Groceries",
      applicability: "expense",
      archivedAt: null,
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    },
    {
      id: "cat-2",
      householdId: "hh-1",
      name: "Salary",
      applicability: "income",
      archivedAt: null,
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    },
  ];

  const mockTransactions: SerializedTransaction[] = [
    {
      id: "tx-1",
      householdId: "hh-1",
      kind: "expense",
      accountId: "account-1",
      paidByPersonId: "person-1",
      amount: { amountMinor: "12550", currency: "PLN" },
      occurredOn: "2026-09-05T12:00:00.000Z",
      payee: "Local Market",
      categoryId: "cat-1",
      version: 1,
      voidedAt: null,
      voidReason: null,
    },
    {
      id: "tx-2",
      householdId: "hh-1",
      kind: "income",
      accountId: "account-1",
      receivedByPersonId: "person-1",
      amount: { amountMinor: "350000", currency: "PLN" },
      occurredOn: "2026-09-01T09:00:00.000Z",
      source: "Primary Employer",
      categoryId: "cat-2",
      version: 1,
      voidedAt: null,
      voidReason: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders transaction list, filter toolbar, and pagination controls", () => {
    const html = renderToStaticMarkup(
      <TransactionList
        transactions={mockTransactions}
        accounts={mockAccounts}
        categories={mockCategories}
        locale="en"
        householdId="hh-1"
      />,
    );

    // List title and accessibility
    expect(html).toContain("Transactions.list.title");
    expect(html).toContain("aria-label=\"Accessibility.transactionFilters\"");
    expect(html).toContain("aria-label=\"Accessibility.transactionPagination\"");

    // Filter controls
    expect(html).toContain('id="tx-filter-search"');
    expect(html).toContain('id="tx-filter-type"');
    expect(html).toContain('id="tx-filter-account"');
    expect(html).toContain('id="tx-filter-category"');
    expect(html).toContain('id="tx-filter-month"');
    expect(html).toContain('id="tx-filter-from"');
    expect(html).toContain('id="tx-filter-to"');
    expect(html).toContain('role="radiogroup"');

    // Filter options
    expect(html).toContain("Transactions.filters.typeAll");
    expect(html).toContain("Transactions.filters.typeExpense");
    expect(html).toContain("Transactions.filters.typeIncome");
    expect(html).toContain("Transactions.filters.typeTransfer");
    expect(html).toContain("Transactions.filters.accountAll");
    expect(html).toContain("Checking Account (PLN)");
    expect(html).toContain("Transactions.filters.categoryAll");
    expect(html).toContain("Transactions.filters.uncategorized");
    expect(html).toContain("Groceries");

    // CSV export link
    expect(html).toContain('aria-label="Accessibility.csvExport"');
    expect(html).toContain("/api/households/hh-1/transactions/export?");
    expect(html).toContain("status=active");
    expect(html).toContain("locale=en");
    expect(html).toContain("Transactions.filters.exportCsv");

    // Rendered transaction items
    expect(html).toContain("Local Market");
    expect(html).toContain("Primary Employer");
    expect(html).toContain("125.50");
    expect(html).toContain("3,500.00");

    // Pagination controls
    expect(html).toContain('id="tx-page-size"');
    expect(html).toContain("Transactions.filters.showingCount");
    expect(html).toContain("Transactions.filters.pageLabel");
    expect(html).toContain("Transactions.filters.prevPage");
    expect(html).toContain("Transactions.filters.nextPage");
  });

  it("renders default empty state when no transactions and no active filters", () => {
    const html = renderToStaticMarkup(
      <TransactionList
        transactions={[]}
        accounts={mockAccounts}
        categories={mockCategories}
        locale="en"
        householdId="hh-1"
      />,
    );

    expect(html).toContain("Transactions.list.emptyTitle");
    expect(html).toContain("Transactions.list.emptyDescription");
    // Should not show reset button when no filters are active
    expect(html).not.toContain("Transactions.filters.noResultsTitle");
  });

  it("renders voided status and badge when transaction is voided", () => {
    const voidedTx: SerializedTransaction = {
      ...mockTransactions[0]!,
      id: "tx-voided-1",
      voidedAt: "2026-09-06T10:00:00.000Z",
      voidReason: "Duplicate charge",
      version: 2,
    };

    const html = renderToStaticMarkup(
      <TransactionList
        transactions={[voidedTx]}
        accounts={mockAccounts}
        categories={mockCategories}
        locale="en"
        householdId="hh-1"
      />,
    );

    expect(html).toContain("Transactions.list.badgeVoided");
    expect(html).toContain("line-through");
  });
});
