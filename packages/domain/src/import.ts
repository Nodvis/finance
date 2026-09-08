import { createHash } from "node:crypto";
import { currencyCode } from "./money";

export const STATEMENT_IMPORT_BATCH_STATUSES = [
  "preview",
  "committed",
  "failed",
] as const;
export type StatementImportBatchStatus =
  (typeof STATEMENT_IMPORT_BATCH_STATUSES)[number];

export const STATEMENT_IMPORT_ROW_STATUSES = [
  "pending",
  "imported",
  "skipped",
  "duplicate",
  "error",
] as const;
export type StatementImportRowStatus =
  (typeof STATEMENT_IMPORT_ROW_STATUSES)[number];

export const STATEMENT_IMPORT_ROW_KINDS = ["expense", "income"] as const;
export type StatementImportRowKind = (typeof STATEMENT_IMPORT_ROW_KINDS)[number];

export const CSV_DELIMITERS = [",", ";", "\t", "|"] as const;
export type CsvDelimiter = (typeof CSV_DELIMITERS)[number];

export const CSV_ENCODINGS = [
  "utf-8",
  "windows-1250",
  "iso-8859-2",
  "ascii",
] as const;
export type CsvEncoding = (typeof CSV_ENCODINGS)[number];

export const AMOUNT_MAPPING_MODES = ["signed", "separate"] as const;
export type AmountMappingMode = (typeof AMOUNT_MAPPING_MODES)[number];

export const CURRENCY_MAPPING_MODES = ["account", "column", "fixed"] as const;
export type CurrencyMappingMode = (typeof CURRENCY_MAPPING_MODES)[number];

export const SUPPORTED_DATE_FORMATS = [
  "auto",
  "YYYY-MM-DD",
  "DD.MM.YYYY",
  "DD/MM/YYYY",
  "DD-MM-YYYY",
  "YYYY/MM/DD",
  "MM/DD/YYYY",
] as const;
export type SupportedDateFormat = (typeof SUPPORTED_DATE_FORMATS)[number];

/**
 * Currency fraction digits according to ISO 4217.
 * Standard default is 2 for ordinary fiat currencies.
 */
export const CURRENCY_FRACTION_DIGITS: Record<string, number> = {
  PLN: 2,
  EUR: 2,
  USD: 2,
  GBP: 2,
  CHF: 2,
  CAD: 2,
  AUD: 2,
  NOK: 2,
  SEK: 2,
  DKK: 2,
  CZK: 2,
  HUF: 2,
  RON: 2,
  BGN: 2,
  JPY: 0,
  KRW: 0,
  BHD: 3,
  KWD: 3,
  OMR: 3,
  TND: 3,
};

export function getCurrencyFractionDigits(currency: string): number {
  const norm = currency.trim().toUpperCase();
  if (norm in CURRENCY_FRACTION_DIGITS) {
    return CURRENCY_FRACTION_DIGITS[norm]!;
  }
  return 2;
}

export type StatementImportMappingConfig = Readonly<{
  dateColumn: string;
  dateFormat: SupportedDateFormat;
  timezone: string;
  amountMode: AmountMappingMode;
  amountColumn?: string | undefined;
  invertAmount?: boolean | undefined;
  debitColumn?: string | undefined;
  creditColumn?: string | undefined;
  currencyMode: CurrencyMappingMode;
  currencyColumn?: string | undefined;
  fixedCurrency?: string | undefined;
  descriptionColumn: string;
  sourceRowIdentityColumn?: string | undefined;
  delimiter: CsvDelimiter;
  hasHeader: boolean;
  headerRowIndex: number;
  skipLeadingRows: number;
}>;

export type NormalizedImportRow = Readonly<{
  rowIndex: number;
  sourceRowIdentity: string;
  dedupeHash: string;
  occurredOn: Date;
  kind: StatementImportRowKind;
  amountMinor: bigint;
  currency: string;
  payee: string | null;
  source: string | null;
  description: string;
  rawRowContent: string;
  rawValues: Record<string, string>;
}>;

export type ParsedImportRow = Readonly<{
  rowIndex: number;
  valid: boolean;
  status: StatementImportRowStatus;
  normalized?: NormalizedImportRow | undefined;
  errorCode?: string | undefined;
  errorMessage?: string | undefined;
  rawRowContent: string;
  rawValues: Record<string, string>;
}>;

export type PossibleManualMatch = Readonly<{
  transactionId: string;
  description: string;
  occurredOn: string;
  amountMinor: string;
  currency: string;
  kind: string;
}>;

export type RowPreviewItem = Readonly<{
  rowIndex: number;
  valid: boolean;
  status: StatementImportRowStatus;
  errorCode?: string | undefined;
  errorMessage?: string | undefined;
  date: string | null;
  kind: StatementImportRowKind | null;
  amountMinor: string | null;
  currency: string | null;
  formattedAmount: string | null;
  description: string | null;
  rawRowContent: string;
  dedupeHash: string;
  sourceRowIdentity: string;
  possibleMatch: PossibleManualMatch | null;
  selected: boolean;
}>;

/**
 * Parses CSV text compliant with RFC 4180 with bounded limits.
 * Handles delimiters (,, ;, \t, |), quoted cells, escaped quotes (""), and multiline cells.
 */
export function parseCsvText(
  text: string,
  options?: {
    delimiter?: CsvDelimiter;
    maxRows?: number;
    maxCharsPerCell?: number;
  },
): string[][] {
  const delimiter = options?.delimiter ?? ",";
  const maxRows = options?.maxRows ?? 5000;
  const maxCharsPerCell = options?.maxCharsPerCell ?? 4000;

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let insideQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const char = text[i];

    if (insideQuotes) {
      if (char === '"') {
        if (i + 1 < len && text[i + 1] === '"') {
          currentCell += '"';
          i += 2;
          continue;
        } else {
          insideQuotes = false;
          i += 1;
          continue;
        }
      } else {
        if (currentCell.length < maxCharsPerCell) {
          currentCell += char;
        }
        i += 1;
        continue;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
        i += 1;
        continue;
      }

      if (char === delimiter) {
        currentRow.push(currentCell.trim());
        currentCell = "";
        i += 1;
        continue;
      }

      if (char === "\r") {
        if (i + 1 < len && text[i + 1] === "\n") {
          i += 1;
        }
        currentRow.push(currentCell.trim());
        currentCell = "";
        if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== "")) {
          rows.push(currentRow);
          if (rows.length >= maxRows) break;
        }
        currentRow = [];
        i += 1;
        continue;
      }

      if (char === "\n") {
        currentRow.push(currentCell.trim());
        currentCell = "";
        if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== "")) {
          rows.push(currentRow);
          if (rows.length >= maxRows) break;
        }
        currentRow = [];
        i += 1;
        continue;
      }

      if (currentCell.length < maxCharsPerCell) {
        currentCell += char;
      }
      i += 1;
    }
  }

  if (currentCell !== "" || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== "")) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Detects the most probable delimiter in sample CSV text.
 * Tests candidate delimiters (;, ,, \t, |) across sample rows.
 */
export function detectCsvDelimiter(sampleText: string): CsvDelimiter {
  const candidates: CsvDelimiter[] = [";", ",", "\t", "|"];
  const lines = sampleText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 15);

  if (lines.length === 0) {
    return ",";
  }

  let bestDelimiter: CsvDelimiter = ",";
  let bestScore = -1;

  for (const delim of candidates) {
    const counts: number[] = [];
    for (const line of lines) {
      let inside = false;
      let count = 0;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') {
          inside = !inside;
        } else if (line[i] === delim && !inside) {
          count++;
        }
      }
      counts.push(count);
    }

    const nonZeroCounts = counts.filter((c) => c > 0);
    if (nonZeroCounts.length === 0) continue;

    const firstCount = nonZeroCounts[0]!;
    const isConsistent = nonZeroCounts.every((c) => c === firstCount);
    const fractionConsistent =
      nonZeroCounts.filter((c) => c === firstCount).length / lines.length;

    let score = fractionConsistent * 100 + firstCount * 10;
    if (delim === ";" && isConsistent && firstCount >= 2) {
      score += 15;
    }

    if (score > bestScore) {
      bestScore = score;
      bestDelimiter = delim;
    }
  }

  return bestDelimiter;
}

/**
 * Detects whether buffer is UTF-8 or Windows-1250.
 * Windows-1250 is very common in Polish bank CSV exports.
 */
export function detectCsvEncoding(bytes: Uint8Array): CsvEncoding {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return "utf-8";
  }

  let isValidUtf8 = true;
  let hasPolishWindows1250Bytes = false;
  let i = 0;
  const len = Math.min(bytes.length, 32768);

  const windows1250PolishChars = new Set([
    0xb9, // ą
    0xe6, // ć
    0xea, // ę
    0xb3, // ł
    0xf1, // ń
    0xf3, // ó
    0x9c, // ś
    0x9f, // ź
    0xbf, // ż
    0xa5, // Ą
    0xc6, // Ć
    0xca, // Ę
    0xa3, // Ł
    0xd1, // Ń
    0xd3, // Ó
    0x8c, // Ś
    0x8f, // Ź
    0xaf, // Ż
  ]);

  while (i < len) {
    const byte = bytes[i]!;

    if (byte <= 0x7f) {
      i++;
      continue;
    }

    if (windows1250PolishChars.has(byte)) {
      if (i + 1 < len && (bytes[i + 1]! < 0x80 || bytes[i + 1]! > 0xbf)) {
        hasPolishWindows1250Bytes = true;
      }
    }

    if ((byte & 0xe0) === 0xc0) {
      if (i + 1 >= len || (bytes[i + 1]! & 0xc0) !== 0x80) {
        isValidUtf8 = false;
        break;
      }
      i += 2;
    } else if ((byte & 0xf0) === 0xe0) {
      if (
        i + 2 >= len ||
        (bytes[i + 1]! & 0xc0) !== 0x80 ||
        (bytes[i + 2]! & 0xc0) !== 0x80
      ) {
        isValidUtf8 = false;
        break;
      }
      i += 3;
    } else if ((byte & 0xf8) === 0xf0) {
      if (
        i + 3 >= len ||
        (bytes[i + 1]! & 0xc0) !== 0x80 ||
        (bytes[i + 2]! & 0xc0) !== 0x80 ||
        (bytes[i + 3]! & 0xc0) !== 0x80
      ) {
        isValidUtf8 = false;
        break;
      }
      i += 4;
    } else {
      isValidUtf8 = false;
      break;
    }
  }

  if (!isValidUtf8 || hasPolishWindows1250Bytes) {
    return "windows-1250";
  }

  return "utf-8";
}

/**
 * Decodes a binary CSV buffer into string using the specified or detected encoding.
 */
export function decodeCsvBuffer(bytes: Uint8Array, encoding?: CsvEncoding): string {
  const enc = encoding ?? detectCsvEncoding(bytes);
  const decoder = new TextDecoder(enc, { fatal: false });
  let decoded = decoder.decode(bytes);

  if (decoded.charCodeAt(0) === 0xfeff) {
    decoded = decoded.slice(1);
  }

  return decoded;
}

/**
 * Computes SHA-256 of file content bytes or string.
 */
export function computeFileSha256(content: Uint8Array | string): string {
  const hash = createHash("sha256");
  hash.update(content);
  return hash.digest("hex");
}

/**
 * Parses date string in the specified format and timezone into a canonical UTC Date.
 */
export function parseImportDate(
  raw: string,
  format: SupportedDateFormat,
  timezone: string = "UTC",
): { success: boolean; date?: Date; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { success: false, error: "Empty date value" };
  }

  let datePart = trimmed;
  let timePart = "00:00:00";

  if (trimmed.includes("T")) {
    const parts = trimmed.split("T");
    datePart = parts[0] ?? trimmed;
    timePart = (parts[1] ?? "00:00:00").replace(/Z|([+-]\d{2}:?\d{2})/, "");
  } else if (trimmed.includes(" ")) {
    const parts = trimmed.split(/\s+/);
    datePart = parts[0] ?? trimmed;
    timePart = parts[1] ?? "00:00:00";
  }

  const timeMatch = timePart.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  let hour = 0;
  let minute = 0;
  let second = 0;
  if (timeMatch) {
    hour = parseInt(timeMatch[1]!, 10);
    minute = parseInt(timeMatch[2]!, 10);
    second = timeMatch[3] ? parseInt(timeMatch[3]!, 10) : 0;
  }

  let year: number | null = null;
  let month: number | null = null;
  let day: number | null = null;

  const tryMatch = (fmt: string): boolean => {
    if (fmt === "YYYY-MM-DD") {
      const m = datePart.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
      if (m) {
        year = parseInt(m[1]!, 10);
        month = parseInt(m[2]!, 10);
        day = parseInt(m[3]!, 10);
        return true;
      }
    } else if (fmt === "DD.MM.YYYY" || fmt === "DD-MM-YYYY" || fmt === "DD/MM/YYYY") {
      const m = datePart.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
      if (m) {
        day = parseInt(m[1]!, 10);
        month = parseInt(m[2]!, 10);
        year = parseInt(m[3]!, 10);
        return true;
      }
    } else if (fmt === "MM/DD/YYYY") {
      const m = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m) {
        month = parseInt(m[1]!, 10);
        day = parseInt(m[2]!, 10);
        year = parseInt(m[3]!, 10);
        return true;
      }
    } else if (fmt === "YYYY/MM/DD") {
      const m = datePart.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
      if (m) {
        year = parseInt(m[1]!, 10);
        month = parseInt(m[2]!, 10);
        day = parseInt(m[3]!, 10);
        return true;
      }
    }
    return false;
  };

  if (format !== "auto") {
    if (!tryMatch(format)) {
      return {
        success: false,
        error: `Date "${trimmed}" does not match specified format ${format}`,
      };
    }
  } else {
    const candidates = [
      "YYYY-MM-DD",
      "DD.MM.YYYY",
      "DD/MM/YYYY",
      "DD-MM-YYYY",
      "YYYY/MM/DD",
      "MM/DD/YYYY",
    ];
    let matched = false;
    for (const cand of candidates) {
      if (tryMatch(cand)) {
        matched = true;
        break;
      }
    }
    if (!matched) {
      return {
        success: false,
        error: `Could not parse date "${trimmed}" with auto-detection`,
      };
    }
  }

  if (
    year === null ||
    month === null ||
    day === null ||
    year < 1970 ||
    year > 2100 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return { success: false, error: `Invalid date values in "${trimmed}"` };
  }

  const y: number = year;
  const m: number = month;
  const d: number = day;

  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d > daysInMonth) {
    return {
      success: false,
      error: `Invalid day ${d} for month ${m} in "${trimmed}"`,
    };
  }

  try {
    const isoString = `${y.toString().padStart(4, "0")}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}T${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}:${second.toString().padStart(2, "0")}`;

    if (!timezone || timezone.toUpperCase() === "UTC") {
      const utcDate = new Date(`${isoString}Z`);
      if (isNaN(utcDate.getTime())) {
        return { success: false, error: `Invalid date: ${trimmed}` };
      }
      return { success: true, date: utcDate };
    }

    const targetDate = new Date(`${isoString}Z`);
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(targetDate);
    const getPart = (type: string) =>
      parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);
    const tzYear = getPart("year");
    const tzMonth = getPart("month");
    const tzDay = getPart("day");
    let tzHour = getPart("hour");
    if (tzHour === 24) tzHour = 0;
    const tzMinute = getPart("minute");

    const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
    const asTz = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute, second);
    const offsetMs = asTz - asUtc;

    const adjustedDate = new Date(asUtc - offsetMs);
    if (isNaN(adjustedDate.getTime())) {
      return { success: false, error: `Invalid date with timezone: ${trimmed}` };
    }
    return { success: true, date: adjustedDate };
  } catch (err) {
    return {
      success: false,
      error: `Timezone conversion failed for "${timezone}": ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Parses amount string into exact BigInt minor units.
 * Supports Polish comma formats (123,45, 1 234,56, 1.234,56) and English dot formats (123.45, 1,234.56).
 * NEVER uses JavaScript floating-point numbers.
 */
export function parseImportAmount(
  raw: string,
  currency: string = "PLN",
): {
  success: boolean;
  amountMinor?: bigint;
  isNegative?: boolean;
  error?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { success: false, error: "Empty amount" };
  }

  let isNegative = false;
  let clean = trimmed;

  if (clean.startsWith("-")) {
    isNegative = true;
    clean = clean.slice(1).trim();
  } else if (clean.endsWith("-")) {
    isNegative = true;
    clean = clean.slice(0, -1).trim();
  } else if (clean.startsWith("(") && clean.endsWith(")")) {
    isNegative = true;
    clean = clean.slice(1, -1).trim();
  } else if (clean.startsWith("+")) {
    clean = clean.slice(1).trim();
  }

  clean = clean
    .replace(/[zł$€£\s\u00A0]/gi, "")
    .replace(new RegExp(`\\b${currency}\\b`, "gi"), "")
    .trim();

  if (!clean) {
    return { success: false, error: "No numeric value found in amount" };
  }

  if (!/^[0-9,.]+$/.test(clean) || /[.,]{2,}/.test(clean)) {
    return { success: false, error: `Invalid amount format: "${raw}"` };
  }

  const fractionDigits = getCurrencyFractionDigits(currency);

  const lastDot = clean.lastIndexOf(".");
  const lastComma = clean.lastIndexOf(",");
  let wholeStr = "";
  let fractionStr = "";

  if (lastDot !== -1 && lastComma !== -1) {
    if (lastComma > lastDot) {
      wholeStr = clean.slice(0, lastComma).replace(/\./g, "");
      fractionStr = clean.slice(lastComma + 1);
    } else {
      wholeStr = clean.slice(0, lastDot).replace(/,/g, "");
      fractionStr = clean.slice(lastDot + 1);
    }
  } else if (lastComma !== -1) {
    const commaCount = (clean.match(/,/g) || []).length;
    if (commaCount === 1) {
      const parts = clean.split(",");
      wholeStr = parts[0] ?? "";
      fractionStr = parts[1] ?? "";
    } else {
      const parts = clean.split(",");
      const validGrouping = parts.slice(1).every((p) => p.length === 3);
      if (!validGrouping) {
        return { success: false, error: `Invalid amount format: "${raw}"` };
      }
      wholeStr = clean.replace(/,/g, "");
      fractionStr = "";
    }
  } else if (lastDot !== -1) {
    const dotCount = (clean.match(/\./g) || []).length;
    if (dotCount === 1) {
      const parts = clean.split(".");
      wholeStr = parts[0] ?? "";
      fractionStr = parts[1] ?? "";
    } else {
      // Check if valid thousands grouping, e.g. 1.000.000 or 12.000.000
      const parts = clean.split(".");
      const validGrouping = parts.slice(1).every((p) => p.length === 3);
      if (!validGrouping) {
        return { success: false, error: `Invalid amount format: "${raw}"` };
      }
      wholeStr = clean.replace(/\./g, "");
      fractionStr = "";
    }
  } else {
    wholeStr = clean;
    fractionStr = "";
  }

  wholeStr = wholeStr.replace(/^0+(?=\d)/, "");
  if (!wholeStr) {
    wholeStr = "0";
  }

  if (
    !/^\d+$/.test(wholeStr) ||
    (fractionStr.length > 0 && !/^\d+$/.test(fractionStr))
  ) {
    return { success: false, error: `Invalid amount format: "${raw}"` };
  }

  if (fractionDigits === 0) {
    if (fractionStr.length > 0 && BigInt(fractionStr) > 0n) {
      return {
        success: false,
        error: `Currency ${currency} does not support fractional units`,
      };
    }
    fractionStr = "";
  } else if (fractionStr.length > fractionDigits) {
    return {
      success: false,
      error: `Too many decimal places for currency ${currency} (max ${fractionDigits})`,
    };
  }

  const paddedFraction = fractionStr.padEnd(fractionDigits, "0");

  try {
    const wholeBigInt = BigInt(wholeStr);
    const fractionBigInt =
      paddedFraction.length > 0 ? BigInt(paddedFraction) : 0n;
    const multiplier = 10n ** BigInt(fractionDigits);
    const totalMinor = wholeBigInt * multiplier + fractionBigInt;

    if (totalMinor === 0n) {
      return { success: false, error: "Amount cannot be zero" };
    }

    return {
      success: true,
      amountMinor: totalMinor,
      isNegative,
    };
  } catch {
    return { success: false, error: `Failed to parse amount "${raw}"` };
  }
}

/**
 * Computes deterministic deduplication hash for an import row.
 */
export function computeRowDedupeHash(params: {
  accountId: string;
  sourceRowIdentity?: string | null;
  occurredOnDate: string;
  amountMinor: bigint;
  currency: string;
  kind: StatementImportRowKind;
  normalizedDescription: string;
  occurrenceIndex: number;
}): string {
  const hash = createHash("sha256");
  const normalizedDesc = params.normalizedDescription.trim().toLowerCase();

  if (params.sourceRowIdentity && params.sourceRowIdentity.trim().length > 0) {
    hash.update(
      `id:${params.accountId}:${params.sourceRowIdentity.trim()}:${params.amountMinor}:${params.currency}`,
    );
  } else {
    hash.update(
      `row:${params.accountId}:${params.occurredOnDate}:${params.amountMinor}:${params.currency}:${params.kind}:${normalizedDesc}:${params.occurrenceIndex}`,
    );
  }

  return hash.digest("hex");
}

/**
 * Normalizes a single raw CSV row using the provided mapping config.
 */
export function normalizeImportRow(params: {
  rowIndex: number;
  rawCells: string[];
  headers: string[];
  mapping: StatementImportMappingConfig;
  targetAccountCurrency: string;
  accountId: string;
  fileHash: string;
  occurrenceCounter: Map<string, number>;
}): ParsedImportRow {
  const {
    rowIndex,
    rawCells,
    headers,
    mapping,
    targetAccountCurrency,
    accountId,
    fileHash,
    occurrenceCounter,
  } = params;

  const rawValues: Record<string, string> = {};
  for (let i = 0; i < rawCells.length; i++) {
    const key = headers[i] ?? `col_${i}`;
    rawValues[key] = rawCells[i] ?? "";
  }
  const rawRowContent = rawCells.join(mapping.delimiter).slice(0, 2000);

  const getVal = (colNameOrIdx: string | undefined): string => {
    if (!colNameOrIdx) return "";
    if (colNameOrIdx in rawValues) {
      return rawValues[colNameOrIdx] ?? "";
    }
    const idx = parseInt(colNameOrIdx, 10);
    if (!isNaN(idx) && idx >= 0 && idx < rawCells.length) {
      return rawCells[idx] ?? "";
    }
    return "";
  };

  // 1. Date
  const rawDate = getVal(mapping.dateColumn);
  if (!rawDate) {
    return {
      rowIndex,
      valid: false,
      status: "error",
      errorCode: "MISSING_DATE",
      errorMessage: "Missing date value in row",
      rawRowContent,
      rawValues,
    };
  }

  const dateResult = parseImportDate(
    rawDate,
    mapping.dateFormat,
    mapping.timezone,
  );
  if (!dateResult.success || !dateResult.date) {
    return {
      rowIndex,
      valid: false,
      status: "error",
      errorCode: "INVALID_DATE",
      errorMessage: dateResult.error ?? "Invalid date format",
      rawRowContent,
      rawValues,
    };
  }
  const occurredOn = dateResult.date;

  // 2. Currency
  let rowCurrency = targetAccountCurrency;
  if (mapping.currencyMode === "column") {
    const rawCur = getVal(mapping.currencyColumn);
    if (rawCur) {
      try {
        rowCurrency = currencyCode(rawCur);
      } catch {
        return {
          rowIndex,
          valid: false,
          status: "error",
          errorCode: "INVALID_CURRENCY",
          errorMessage: `Invalid currency code: "${rawCur}"`,
          rawRowContent,
          rawValues,
        };
      }
    }
  } else if (mapping.currencyMode === "fixed" && mapping.fixedCurrency) {
    try {
      rowCurrency = currencyCode(mapping.fixedCurrency);
    } catch {
      return {
        rowIndex,
        valid: false,
        status: "error",
        errorCode: "INVALID_CURRENCY",
        errorMessage: `Invalid fixed currency code: "${mapping.fixedCurrency}"`,
        rawRowContent,
        rawValues,
      };
    }
  }

  if (rowCurrency !== targetAccountCurrency) {
    return {
      rowIndex,
      valid: false,
      status: "error",
      errorCode: "CURRENCY_MISMATCH",
      errorMessage: `Row currency (${rowCurrency}) does not match target account currency (${targetAccountCurrency})`,
      rawRowContent,
      rawValues,
    };
  }

  // 3. Amount & Kind
  let kind: StatementImportRowKind;
  let amountMinor: bigint;

  if (mapping.amountMode === "signed") {
    const rawAmount = getVal(mapping.amountColumn);
    if (!rawAmount) {
      return {
        rowIndex,
        valid: false,
        status: "error",
        errorCode: "MISSING_AMOUNT",
        errorMessage: "Missing amount value in row",
        rawRowContent,
        rawValues,
      };
    }

    const parsedAmount = parseImportAmount(rawAmount, rowCurrency);
    if (!parsedAmount.success || parsedAmount.amountMinor === undefined) {
      return {
        rowIndex,
        valid: false,
        status: "error",
        errorCode: "INVALID_AMOUNT",
        errorMessage: parsedAmount.error ?? "Invalid amount",
        rawRowContent,
        rawValues,
      };
    }

    amountMinor = parsedAmount.amountMinor;
    let isNeg = parsedAmount.isNegative ?? false;
    if (mapping.invertAmount) {
      isNeg = !isNeg;
    }

    kind = isNeg ? "expense" : "income";
  } else {
    // Separate debit/credit columns
    const rawDebit = getVal(mapping.debitColumn);
    const rawCredit = getVal(mapping.creditColumn);

    const hasDebit = rawDebit && rawDebit.trim().length > 0;
    const hasCredit = rawCredit && rawCredit.trim().length > 0;

    if (!hasDebit && !hasCredit) {
      return {
        rowIndex,
        valid: false,
        status: "error",
        errorCode: "MISSING_AMOUNT",
        errorMessage: "Neither debit nor credit column has an amount",
        rawRowContent,
        rawValues,
      };
    }

    if (hasDebit && hasCredit) {
      const debitParsed = parseImportAmount(rawDebit, rowCurrency);
      const creditParsed = parseImportAmount(rawCredit, rowCurrency);

      if (debitParsed.success && creditParsed.success) {
        return {
          rowIndex,
          valid: false,
          status: "error",
          errorCode: "AMBIGUOUS_AMOUNT",
          errorMessage: "Both debit and credit columns have values in this row",
          rawRowContent,
          rawValues,
        };
      } else if (debitParsed.success) {
        kind = "expense";
        amountMinor = debitParsed.amountMinor!;
      } else if (creditParsed.success) {
        kind = "income";
        amountMinor = creditParsed.amountMinor!;
      } else {
        return {
          rowIndex,
          valid: false,
          status: "error",
          errorCode: "INVALID_AMOUNT",
          errorMessage: "Could not parse debit or credit amount",
          rawRowContent,
          rawValues,
        };
      }
    } else if (hasDebit) {
      const debitParsed = parseImportAmount(rawDebit, rowCurrency);
      if (!debitParsed.success || debitParsed.amountMinor === undefined) {
        return {
          rowIndex,
          valid: false,
          status: "error",
          errorCode: "INVALID_AMOUNT",
          errorMessage: debitParsed.error ?? "Invalid debit amount",
          rawRowContent,
          rawValues,
        };
      }
      kind = "expense";
      amountMinor = debitParsed.amountMinor;
    } else {
      const creditParsed = parseImportAmount(rawCredit!, rowCurrency);
      if (!creditParsed.success || creditParsed.amountMinor === undefined) {
        return {
          rowIndex,
          valid: false,
          status: "error",
          errorCode: "INVALID_AMOUNT",
          errorMessage: creditParsed.error ?? "Invalid credit amount",
          rawRowContent,
          rawValues,
        };
      }
      kind = "income";
      amountMinor = creditParsed.amountMinor;
    }
  }

  // 4. Description / Payee / Source
  let rawDesc = getVal(mapping.descriptionColumn);
  if (!rawDesc || rawDesc.trim().length === 0) {
    rawDesc = "Imported transaction";
  }
  const description = rawDesc.trim().slice(0, 160);
  const payee = kind === "expense" ? description : null;
  const source = kind === "income" ? description : null;

  // 5. Source Row Identity
  const rawSourceIdentity = getVal(mapping.sourceRowIdentityColumn);
  const sourceRowIdentity =
    rawSourceIdentity && rawSourceIdentity.trim().length > 0
      ? rawSourceIdentity.trim().slice(0, 255)
      : `${fileHash.slice(0, 16)}:${rowIndex}`;

  // 6. Dedupe Hash calculation
  const dateKey = occurredOn.toISOString().slice(0, 10);
  const occurrenceKey = `${dateKey}:${amountMinor}:${kind}:${description.toLowerCase()}`;
  const currentOccCount = occurrenceCounter.get(occurrenceKey) ?? 0;
  occurrenceCounter.set(occurrenceKey, currentOccCount + 1);

  const dedupeHash = computeRowDedupeHash({
    accountId,
    sourceRowIdentity: rawSourceIdentity ? sourceRowIdentity : null,
    occurredOnDate: dateKey,
    amountMinor,
    currency: rowCurrency,
    kind,
    normalizedDescription: description,
    occurrenceIndex: currentOccCount,
  });

  return {
    rowIndex,
    valid: true,
    status: "pending",
    normalized: {
      rowIndex,
      sourceRowIdentity,
      dedupeHash,
      occurredOn,
      kind,
      amountMinor,
      currency: rowCurrency,
      payee,
      source,
      description,
      rawRowContent,
      rawValues,
    },
    rawRowContent,
    rawValues,
  };
}
