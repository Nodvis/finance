import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { SerializedHouseholdAccount } from "@/lib/accounts/serialization";
import type { StatementImportProfileDto } from "@/lib/statement-imports/service";
import { ImportView } from "./ImportView";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next-intl", () => ({
  useTranslations:
    (ns: string) =>
    (key: string, params?: Record<string, unknown>) => {
      if (params) {
        return `${ns}.${key}:${JSON.stringify(params)}`;
      }
      return `${ns}.${key}`;
    },
}));

describe("ImportView Component", () => {
  const mockAccounts: SerializedHouseholdAccount[] = [
    {
      id: "acc-1",
      householdId: "018f47a0-7762-7b9c-8d17-27f2f79e59a1",
      name: "Checking",
      type: "checking",
      currency: "PLN",
      balanceSnapshotMinor: "100000",
      balanceSnapshotAt: "2026-09-01T12:00:00.000Z",
      archivedAt: null,
      ownerPersonIds: [],
    },
  ];

  const mockProfiles: StatementImportProfileDto[] = [
    {
      id: "prof-1",
      householdId: "018f47a0-7762-7b9c-8d17-27f2f79e59a1",
      accountId: "acc-1",
      name: "mBank CSV",
      mappingConfig: {
        dateColumn: "Data operacji",
        dateFormat: "auto",
        timezone: "UTC",
        amountMode: "signed",
        amountColumn: "Kwota",
        invertAmount: false,
        currencyMode: "account",
        descriptionColumn: "Tytuł",
        delimiter: ";",
        hasHeader: true,
        headerRowIndex: 0,
        skipLeadingRows: 0,
      },
      autoProcessSafe: true,
      isDefault: true,
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z",
    },
  ];

  it("renders empty state when no accounts exist", () => {
    const html = renderToStaticMarkup(
      <ImportView
        householdId="018f47a0-7762-7b9c-8d17-27f2f79e59a1"
        accounts={[]}
      />,
    );

    expect(html).toContain("Imports.noAccountsTitle");
    expect(html).toContain("Imports.createAccountAction");
  });

  it("renders file upload step with target account selector", () => {
    const html = renderToStaticMarkup(
      <ImportView
        householdId="018f47a0-7762-7b9c-8d17-27f2f79e59a1"
        accounts={mockAccounts}
        initialProfiles={mockProfiles}
      />,
    );

    expect(html).toContain("Checking (PLN)");
    expect(html).toContain("Imports.dropzoneHint");
    expect(html).toContain("Imports.inspect");
  });
});
