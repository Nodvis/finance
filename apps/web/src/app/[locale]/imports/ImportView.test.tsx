import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { SerializedHouseholdAccount } from "@/lib/accounts/serialization";
import type { StatementImportProfileDto } from "@/lib/statement-imports/service";
import {
  getImportRowStatusKey,
  isImportRowSelectable,
  markAutoCommittedRows,
  ImportView,
  buildImportMappingConfig,
} from "./ImportView";

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
  useLocale: () => "pl",
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
  it.each([
    ["authoritative", "AMBIGUOUS_AUTHORITATIVE_MATCH"],
    ["fallback", "AMBIGUOUS_FALLBACK_MATCH"],
    ["voided", "MATCHES_VOIDED_TRANSACTION"],
  ])("keeps %s ambiguous rows out of selection and Pending UI", (_kind, errorCode) => {
    const row = {
      valid: true,
      status: "pending",
      possibleMatch: null,
      ambiguityState: "ambiguous",
      errorCode,
    } as any;

    expect(isImportRowSelectable(row)).toBe(false);
    expect(getImportRowStatusKey(row)).toBe("review");
  });

  it("keeps unambiguous pending rows selectable", () => {
    const row = {
      valid: true,
      status: "pending",
      possibleMatch: null,
      ambiguityState: "unambiguous",
    } as any;

    expect(isImportRowSelectable(row)).toBe(true);
    expect(getImportRowStatusKey(row)).toBe("pending");
  });

  it("builds a separate debit/credit mapping and preserves its columns", () => {
    expect(buildImportMappingConfig({
      dateColumn: "Date",
      descriptionColumn: "Description",
      amountMode: "separate",
      amountColumn: "",
      debitColumn: "Debit",
      creditColumn: "Credit",
      inspect: {
        suggestedMapping: { dateFallbackColumn: "Booking date" },
        detectedDelimiter: ",",
        detectedEncoding: "utf-8",
        headerRowIndex: 0,
        headerSignature: "a".repeat(64),
      } as any,
    })).toMatchObject({
      amountMode: "separate",
      debitColumn: "Debit",
      creditColumn: "Credit",
    });
  });

  it("preserves saved profile mapping semantics when building the request config", () => {
    expect(buildImportMappingConfig({
      dateColumn: "Booked",
      dateFallbackColumn: "Value Date",
      descriptionColumn: "Memo",
      amountMode: "separate",
      amountColumn: "",
      debitColumn: "Out",
      creditColumn: "In",
      mappingConfig: {
        dateFormat: "DD.MM.YYYY",
        timezone: "Europe/Warsaw",
        invertAmount: true,
        currencyMode: "fixed",
        fixedCurrency: "PLN",
        currencyColumn: "Currency",
        authoritativeIdColumn: "Bank ID",
        sourceNamespace: "bank",
        sourceAccountId: "acct",
        sourceAccountIdColumn: "Account",
        sourceRowIdentityColumn: "Row ID",
      },
      inspect: {
        suggestedMapping: {},
        detectedDelimiter: ",",
        detectedEncoding: "utf-8",
        headerRowIndex: 0,
        headerSignature: "a".repeat(64),
      } as any,
    })).toMatchObject({
      dateFormat: "DD.MM.YYYY",
      timezone: "Europe/Warsaw",
      invertAmount: true,
      currencyMode: "fixed",
      fixedCurrency: "PLN",
      currencyColumn: "Currency",
      authoritativeIdColumn: "Bank ID",
      sourceNamespace: "bank",
      sourceAccountId: "acct",
      sourceAccountIdColumn: "Account",
      sourceRowIdentityColumn: "Row ID",
    });
  });

  it("preserves the discovered source account column in custom mapping payloads", () => {
    expect(buildImportMappingConfig({
      dateColumn: "Date",
      descriptionColumn: "Description",
      amountMode: "signed",
      amountColumn: "Amount",
      debitColumn: "",
      creditColumn: "",
      inspect: {
        suggestedMapping: { sourceAccountIdColumn: "Account" },
        detectedDelimiter: ",",
        detectedEncoding: "utf-8",
        headerRowIndex: 0,
        headerSignature: "a".repeat(64),
      } as any,
    })).toMatchObject({ sourceAccountIdColumn: "Account" });
  });

  it("does not allow auto-committed rows to be selected again", () => {
    const result = markAutoCommittedRows({
      batchId: "batch-1",
      totalRowCount: 2,
      validRowCount: 2,
      invalidRowCount: 0,
      duplicateRowCount: 0,
      safeToCommitCount: 1,
      attentionRowCount: 1,
      autoCommitted: { batchId: "batch-1", importedCount: 1, skippedCount: 0, committedTransactionIds: ["tx-1"] },
      rows: [
        { rowIndex: 0, valid: true, status: "pending", selected: true, ambiguityState: "unambiguous" },
        { rowIndex: 1, valid: true, status: "pending", selected: false, ambiguityState: "ambiguous" },
      ],
    });

    expect(result.rows[0]).toMatchObject({ status: "imported", selected: false });
    expect(result.rows[1]).toMatchObject({ status: "pending", selected: false });
    expect(isImportRowSelectable(result.rows[0]!)).toBe(false);
  });

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
