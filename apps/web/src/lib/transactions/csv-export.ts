import type { Transaction } from "@nodvis/finance-domain";
import { minorUnitsToDecimalString } from "./presentation";

export type CsvAccountSummary = {
  id: string;
  name: string;
};

export type CsvCategorySummary = {
  id: string;
  name: string;
};

export type GenerateTransactionsCsvOptions = {
  transactions: readonly Transaction[];
  accounts: ReadonlyMap<string, CsvAccountSummary>;
  categories: ReadonlyMap<string, CsvCategorySummary>;
  locale?: string | undefined;
};

/**
 * Protects user-controlled text against spreadsheet formula injection (CWE-1236).
 * If the string starts with =, +, -, @, \t, \r, or |, prepends a single quote (').
 * Spreadsheet software (Excel, LibreOffice Calc, Google Sheets) interprets the
 * leading single quote as a text literal directive, preventing malicious formula execution.
 */
export function sanitizeCsvFormula(raw: string | null | undefined): string {
  if (!raw) return "";
  if (/^[\t\r\n]/.test(raw)) {
    return `'${raw}`;
  }
  const withoutLeadingSpaces = raw.replace(/^[ ]+/, "");
  if (/^[=+\-@|]/.test(withoutLeadingSpaces)) {
    return `'${raw}`;
  }
  return raw;
}

/**
 * Escapes a field according to RFC 4180 CSV standard:
 * - Double quotes (") are escaped as ("")
 * - If the value contains commas, quotes, newlines, or begins with a single quote (formula protection),
 *   the entire field is wrapped in double quotes.
 */
export function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  const needsQuotes =
    str.includes(",") ||
    str.includes('"') ||
    str.includes("\n") ||
    str.includes("\r") ||
    str.startsWith("'");

  if (needsQuotes) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates an RFC 4180 compliant, UTF-8 encoded CSV string for household transactions.
 * Uses exact BigInt decimal strings for monetary amounts (no IEEE-754 precision loss).
 * Sanitizes all user-controlled text fields to prevent CSV formula injection.
 */
export function generateTransactionsCsv(
  options: GenerateTransactionsCsvOptions,
): string {
  const isPl = options.locale === "pl";

  const headers = isPl
    ? [
        "Data",
        "Typ",
        "Kwota",
        "Waluta",
        "Konto",
        "Kategoria",
        "Opis",
        "Status",
        "Powód anulowania",
      ]
    : [
        "Date",
        "Type",
        "Amount",
        "Currency",
        "Account",
        "Category",
        "Description",
        "Status",
        "Void Reason",
      ];

  const headerLine = headers.map(escapeCsvField).join(",");
  const lines: string[] = [headerLine];

  for (const tx of options.transactions) {
    // 1. Date (YYYY-MM-DD in UTC)
    const dateStr = tx.occurredOn.toISOString().split("T")[0]!;

    // 2. Type
    let typeLabel: string;
    if (tx.kind === "expense") {
      typeLabel = isPl ? "Wydatek" : "Expense";
    } else if (tx.kind === "income") {
      typeLabel = isPl ? "Przychód" : "Income";
    } else {
      typeLabel = isPl ? "Transfer" : "Transfer";
    }

    // 3. Amount (exact decimal string via BigInt arithmetic)
    const amountStr = minorUnitsToDecimalString(
      tx.amount.amountMinor,
      tx.amount.currency,
    );

    // 4. Currency
    const currencyStr = tx.amount.currency;

    // 5. Account description
    let accountDescription = "";
    if (tx.kind === "expense" || tx.kind === "income") {
      const acc = options.accounts.get(tx.accountId);
      accountDescription = acc ? acc.name : tx.accountId;
    } else if (tx.kind === "transfer") {
      const fromAcc = options.accounts.get(tx.fromAccountId);
      const toAcc = options.accounts.get(tx.toAccountId);
      const fromName = fromAcc ? fromAcc.name : tx.fromAccountId;
      const toName = toAcc ? toAcc.name : tx.toAccountId;
      accountDescription = `${fromName} -> ${toName}`;
    }

    // 6. Category description
    let categoryDescription = "";
    if (tx.kind === "transfer") {
      categoryDescription = "";
    } else if (tx.categoryId) {
      const cat = options.categories.get(tx.categoryId);
      categoryDescription = cat ? cat.name : tx.categoryId;
    } else {
      categoryDescription = isPl ? "Bez kategorii" : "Uncategorized";
    }

    // 7. Description (payee or source)
    let description = "";
    if (tx.kind === "expense") {
      description = tx.payee;
    } else if (tx.kind === "income") {
      description = tx.source;
    }

    // 8. Status
    const statusLabel = tx.voidedAt
      ? isPl
        ? "Anulowana"
        : "Voided"
      : isPl
        ? "Aktywna"
        : "Active";

    // 9. Void reason
    const voidReason = tx.voidReason ?? "";

    const row = [
      escapeCsvField(dateStr),
      escapeCsvField(typeLabel),
      escapeCsvField(amountStr),
      escapeCsvField(currencyStr),
      escapeCsvField(sanitizeCsvFormula(accountDescription)),
      escapeCsvField(sanitizeCsvFormula(categoryDescription)),
      escapeCsvField(sanitizeCsvFormula(description)),
      escapeCsvField(statusLabel),
      escapeCsvField(sanitizeCsvFormula(voidReason)),
    ].join(",");

    lines.push(row);
  }

  // Prepend UTF-8 BOM so Excel automatically recognizes UTF-8 encoding
  const BOM = "\uFEFF";
  return BOM + lines.join("\r\n") + "\r\n";
}
