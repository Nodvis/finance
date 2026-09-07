/**
 * Known currency fraction digits according to ISO 4217.
 * Standard default is 2 for ordinary household fiat currencies (PLN, EUR, USD, GBP, CHF).
 */
export const KNOWN_CURRENCY_FRACTION_DIGITS: Record<string, number> = {
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

/**
 * Returns the standard fraction digits (minor units per major unit = 10^fractionDigits)
 * for the provided currency code.
 */
export function getCurrencyFractionDigits(currency: string): number {
  const normalized = currency.trim().toUpperCase();
  if (normalized in KNOWN_CURRENCY_FRACTION_DIGITS) {
    return KNOWN_CURRENCY_FRACTION_DIGITS[normalized]!;
  }
  try {
    const formatter = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: normalized,
    });
    return formatter.resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

export type ParseAmountErrorCode =
  | "empty"
  | "invalid_format"
  | "too_many_decimals"
  | "must_be_positive";

export interface ParseAmountResult {
  success: boolean;
  amountMinor?: string;
  error?: ParseAmountErrorCode;
}

/**
 * Converts natural decimal input (PL comma `123,45` and EN dot `123.45`) exactly into
 * integer minor units as string.
 *
 * Rules:
 * 1. Strictly relies on BigInt arithmetic; NEVER uses JavaScript `Number` floating-point
 *    arithmetic for canonical money conversion.
 * 2. Accepts natural user input formats:
 *    - Polish style: "123,45", "123,4", ",45", "1 234,56", "1.234,56"
 *    - English style: "123.45", "123.4", ".45", "1,234.56"
 *    - Whole numbers: "123", "100"
 * 3. Enforces that transaction amounts must be positive integers (> 0n minor units).
 * 4. Checks fraction digits limit according to ISO 4217 currency specification.
 */
export function parseNaturalDecimalToMinor(
  input: string,
  currency: string = "PLN",
): ParseAmountResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { success: false, error: "empty" };
  }

  // Reject negative numbers for transaction amounts
  if (trimmed.startsWith("-")) {
    return { success: false, error: "must_be_positive" };
  }

  // Remove whitespace and non-breaking space grouping separators
  const sanitized = trimmed.replace(/[\s\u00A0]/g, "");

  // Must only contain digits, commas, and dots
  if (!/^[0-9,.]+$/.test(sanitized)) {
    return { success: false, error: "invalid_format" };
  }

  // Reject consecutive or leading/trailing separators in improper positions
  if (/[.,]{2,}/.test(sanitized)) {
    return { success: false, error: "invalid_format" };
  }

  const fractionDigits = getCurrencyFractionDigits(currency);

  let wholeStr = "";
  let fractionStr = "";

  const hasComma = sanitized.includes(",");
  const hasDot = sanitized.includes(".");

  if (hasComma && hasDot) {
    // Both comma and dot are present: identify thousands separator vs decimal separator
    const lastComma = sanitized.lastIndexOf(",");
    const lastDot = sanitized.lastIndexOf(".");

    if (lastComma > lastDot) {
      // European format: 1.234,56 (dot is thousands, comma is decimal)
      wholeStr = sanitized.substring(0, lastComma).replace(/\./g, "");
      fractionStr = sanitized.substring(lastComma + 1);
    } else {
      // US format: 1,234.56 (comma is thousands, dot is decimal)
      wholeStr = sanitized.substring(0, lastDot).replace(/,/g, "");
      fractionStr = sanitized.substring(lastDot + 1);
    }
  } else if (hasComma) {
    const commaCount = (sanitized.match(/,/g) || []).length;
    if (commaCount === 1) {
      // Single comma is decimal separator: "123,45" or ",45"
      const parts = sanitized.split(",");
      wholeStr = parts[0] ?? "";
      fractionStr = parts[1] ?? "";
    } else {
      // Multiple commas with no dot: thousands grouping without decimal, e.g. "1,000,000"
      wholeStr = sanitized.replace(/,/g, "");
      fractionStr = "";
    }
  } else if (hasDot) {
    const dotCount = (sanitized.match(/\./g) || []).length;
    if (dotCount === 1) {
      // Single dot is decimal separator: "123.45" or ".45"
      const parts = sanitized.split(".");
      wholeStr = parts[0] ?? "";
      fractionStr = parts[1] ?? "";
    } else {
      // Multiple dots: thousands grouping without decimal, e.g. "1.000.000"
      wholeStr = sanitized.replace(/\./g, "");
      fractionStr = "";
    }
  } else {
    // Pure integer with no separator: "123"
    wholeStr = sanitized;
    fractionStr = "";
  }

  // Normalize whole part: remove leading zeros except single zero
  wholeStr = wholeStr.replace(/^0+(?=\d)/, "");
  if (!wholeStr) {
    wholeStr = "0";
  }

  // Both parts must consist strictly of digits
  if (!/^\d+$/.test(wholeStr) || (fractionStr.length > 0 && !/^\d+$/.test(fractionStr))) {
    return { success: false, error: "invalid_format" };
  }

  // Check currency fraction digits limit
  if (fractionDigits === 0) {
    if (fractionStr.length > 0 && BigInt(fractionStr) > 0n) {
      return { success: false, error: "too_many_decimals" };
    }
    fractionStr = "";
  } else if (fractionStr.length > fractionDigits) {
    return { success: false, error: "too_many_decimals" };
  }

  // Pad fraction to expected fractionDigits (e.g. "4" -> "40" for 2 decimals)
  const paddedFraction = fractionStr.padEnd(fractionDigits, "0");

  try {
    const wholeBigInt = BigInt(wholeStr);
    const fractionBigInt = paddedFraction.length > 0 ? BigInt(paddedFraction) : 0n;
    const multiplier = 10n ** BigInt(fractionDigits);
    const totalMinor = wholeBigInt * multiplier + fractionBigInt;

    if (totalMinor <= 0n) {
      return { success: false, error: "must_be_positive" };
    }

    return {
      success: true,
      amountMinor: totalMinor.toString(),
    };
  } catch {
    return { success: false, error: "invalid_format" };
  }
}

export interface ParseAccountBalanceResult {
  success: boolean;
  amountMinor: bigint | null;
  error?: "invalid_format" | "too_many_decimals";
}

/**
 * Converts natural decimal input into integer minor units as bigint.
 * Supports negative numbers (e.g. credit-card debt or overdraft).
 * If input is empty/null/undefined, returns success: true with amountMinor: null (preserving unknown balance as unknown).
 * Strictly relies on BigInt; NEVER uses JavaScript Number for money.
 */
export function parseAccountBalanceToMinor(
  input: string | null | undefined,
  currency: string = "PLN",
): ParseAccountBalanceResult {
  if (input === null || input === undefined) {
    return { success: true, amountMinor: null };
  }
  const trimmed = input.trim();
  if (trimmed === "") {
    return { success: true, amountMinor: null };
  }

  let isNegative = false;
  let clean = trimmed;
  if (clean.startsWith("-")) {
    isNegative = true;
    clean = clean.slice(1).trim();
  } else if (clean.startsWith("+")) {
    clean = clean.slice(1).trim();
  }

  const sanitized = clean.replace(/[\s\u00A0]/g, "");

  if (!/^[0-9,.]+$/.test(sanitized) || /[.,]{2,}/.test(sanitized)) {
    return { success: false, amountMinor: null, error: "invalid_format" };
  }

  const fractionDigits = getCurrencyFractionDigits(currency);

  const lastDot = sanitized.lastIndexOf(".");
  const lastComma = sanitized.lastIndexOf(",");
  const separatorIndex = Math.max(lastDot, lastComma);

  let wholeStr: string;
  let fractionStr: string;

  if (separatorIndex === -1) {
    wholeStr = sanitized;
    fractionStr = "";
  } else {
    const rawIntegerPart = sanitized.slice(0, separatorIndex);
    wholeStr = rawIntegerPart.replace(/[.,]/g, "");
    fractionStr = sanitized.slice(separatorIndex + 1);
  }

  wholeStr = wholeStr.replace(/^0+(?=\d)/, "");
  if (!wholeStr) {
    wholeStr = "0";
  }

  if (
    !/^\d+$/.test(wholeStr) ||
    (fractionStr.length > 0 && !/^\d+$/.test(fractionStr))
  ) {
    return { success: false, amountMinor: null, error: "invalid_format" };
  }

  if (fractionDigits === 0) {
    if (fractionStr.length > 0 && BigInt(fractionStr) > 0n) {
      return { success: false, amountMinor: null, error: "too_many_decimals" };
    }
    fractionStr = "";
  } else if (fractionStr.length > fractionDigits) {
    return { success: false, amountMinor: null, error: "too_many_decimals" };
  }

  const paddedFraction = fractionStr.padEnd(fractionDigits, "0");

  try {
    const wholeBigInt = BigInt(wholeStr);
    const fractionBigInt =
      paddedFraction.length > 0 ? BigInt(paddedFraction) : 0n;
    const multiplier = 10n ** BigInt(fractionDigits);
    const absMinor = wholeBigInt * multiplier + fractionBigInt;
    const finalMinor = isNegative ? -absMinor : absMinor;

    return {
      success: true,
      amountMinor: finalMinor,
    };
  } catch {
    return { success: false, amountMinor: null, error: "invalid_format" };
  }
}
