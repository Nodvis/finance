import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { AuthorizedHouseholdUserContext } from "@/lib/authorization/household";
import type {
  SerializedReconciledTransfer,
  SerializedTransferCandidate,
  TransferCandidatesSummary,
} from "@/lib/transfers/service";
import { TransfersView } from "./TransfersView";

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

describe("TransfersView Component", () => {
  const mockContext: AuthorizedHouseholdUserContext = {
    authUserId: "u-1",
    householdId: "018f47a0-7762-7b9c-8d17-27f2f79e59a1" as any,
    personId: "018f47a0-7762-7b9c-8d17-27f2f79e59a2" as any,
    householdName: "Our Household",
    defaultCurrency: "PLN",
    personDisplayName: "Alice",
  };

  const mockCandidate: SerializedTransferCandidate = {
    id: "cand-1",
    confidence: "ready_auto",
    fromAccountId: "acc-1",
    toAccountId: "acc-2",
    fromAccountName: "Checking Account",
    toAccountName: "Savings Account",
    outflow: {
      transactionId: "tx-outflow-1",
      accountId: "acc-1",
      accountName: "Checking Account",
      amountMinor: "250000",
      currency: "PLN",
      occurredOn: "2026-09-05T12:00:00.000Z",
      kind: "expense",
      counterpartyText: "Przelew do PKO BP PL74109024020000000123456789",
      version: 1,
    },
    inflow: {
      transactionId: "tx-inflow-1",
      accountId: "acc-2",
      accountName: "Savings Account",
      amountMinor: "250000",
      currency: "PLN",
      occurredOn: "2026-09-05T14:30:00.000Z",
      kind: "income",
      counterpartyText: "Wpłata własna",
      version: 1,
    },
    amountMinor: "250000",
    currency: "PLN",
    evidence: {
      matchedIdentifier: "PL74109024020000000123456789",
      matchedRelationshipType: "known_account_identifier",
      dateDifferenceDays: 0,
      crossCurrency: false,
      uncertaintyReasons: [],
    },
  };

  const mockSummary: TransferCandidatesSummary = {
    candidates: [mockCandidate],
    counts: {
      readyAuto: 1,
      reviewOnly: 0,
      oneSidedPending: 0,
      ambiguous: 0,
      total: 1,
    },
  };

  const mockReconciled: SerializedReconciledTransfer[] = [
    {
      id: "rec-1",
      householdId: "018f47a0-7762-7b9c-8d17-27f2f79e59a1",
      transferTransactionId: "tx-reconciled-1",
      matchedTransactionId: "tx-voided-inflow-1",
      matchedIdentifier: "PL74109024020000000123456789",
      matchConfidence: "automatic",
      notes: null,
      createdAt: "2026-09-04T10:00:00.000Z",
    },
  ];

  it("renders transfer reconciliation view with tabs and ready candidate details", () => {
    const html = renderToStaticMarkup(
      <TransfersView
        householdContext={mockContext}
        allHouseholds={[]}
        initialSummary={mockSummary}
        initialReconciled={mockReconciled}
        locale="pl"
      />,
    );

    // Title and tabs
    expect(html).toContain("Transfers.title");
    expect(html).toContain("Transfers.tabs.readyAuto:{&quot;count&quot;:1}");
    expect(html).toContain("Transfers.tabs.reviewOnly:{&quot;count&quot;:0}");
    expect(html).toContain("Transfers.tabs.oneSidedPending:{&quot;count&quot;:0}");
    expect(html).toContain("Transfers.tabs.reconciled:{&quot;count&quot;:1}");

    // Candidate details
    expect(html).toContain("Checking Account");
    expect(html).toContain("Savings Account");
    expect(html).toContain("2500,00"); // 2500.00 PLN formatted in pl locale

    // Masked identifier displayed
    expect(html).toContain("PL74 •••• •••• •••• •••• •••• 6789");

    // Action buttons
    expect(html).toContain("Transfers.actions.autoMatchAll:{&quot;count&quot;:1}");
    expect(html).toContain("Transfers.actions.match");
  });
});
