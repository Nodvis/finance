import type {
  AccountId,
  AccountIdentifierId,
  HouseholdId,
} from "./identity";

export const ACCOUNT_IDENTIFIER_TYPES = ["iban", "domestic_nrb"] as const;
export type AccountIdentifierType = (typeof ACCOUNT_IDENTIFIER_TYPES)[number];

export type AccountIdentifier = Readonly<{
  id: AccountIdentifierId;
  householdId: HouseholdId;
  accountId: AccountId;
  identifierType: AccountIdentifierType;
  rawIdentifier: string;
  normalizedIdentifier: string;
  label: string | null;
  createdAt: Date;
  updatedAt: Date;
}>;

/**
 * Standard IBAN lengths per country code.
 */
const KNOWN_IBAN_LENGTHS: Record<string, number> = {
  PL: 28, // Poland
  DE: 22, // Germany
  FR: 27, // France
  GB: 22, // United Kingdom
  IT: 27, // Italy
  ES: 24, // Spain
  NL: 18, // Netherlands
  BE: 16, // Belgium
  AT: 20, // Austria
  CH: 21, // Switzerland
  CZ: 24, // Czech Republic
  SK: 24, // Slovakia
  SE: 24, // Sweden
  NO: 15, // Norway
  DK: 18, // Denmark
  FI: 18, // Finland
  IE: 22, // Ireland
  PT: 25, // Portugal
  LU: 20, // Luxembourg
  LT: 20, // Lithuania
  LV: 21, // Latvia
  EE: 20, // Estonia
  RO: 24, // Romania
  BG: 22, // Bulgaria
  HR: 21, // Croatia
  HU: 28, // Hungary
};

/**
 * Computes ISO 7064 MOD-97-10 checksum on an alphanumeric IBAN candidate.
 * Returns true if checksum remainder is exactly 1.
 */
function checkIbanMod97(iban: string): boolean {
  // Move first 4 characters to the end
  const rearranged = iban.slice(4) + iban.slice(0, 4);

  // Convert letters to two-digit numbers (A = 10, ..., Z = 35)
  let numericString = "";
  for (let i = 0; i < rearranged.length; i++) {
    const char = rearranged[i]!;
    const code = char.charCodeAt(0);
    if (code >= 48 && code <= 57) {
      // 0-9
      numericString += char;
    } else if (code >= 65 && code <= 90) {
      // A-Z
      numericString += (code - 55).toString();
    } else {
      return false;
    }
  }

  try {
    return BigInt(numericString) % 97n === 1n;
  } catch {
    return false;
  }
}

export type AccountIdentifierValidationResult =
  | {
      valid: true;
      type: AccountIdentifierType;
      normalized: string;
      formatted: string;
      masked: string;
    }
  | {
      valid: false;
      error: string;
    };

/**
 * Strips formatting characters (spaces, hyphens, dots, slashes) and normalizes to uppercase.
 */
export function cleanRawIdentifier(raw: string): string {
  return raw.replace(/[\s\-_./]/g, "").toUpperCase();
}

/**
 * Validates a Polish domestic account number (NRB) or international IBAN.
 *
 * Domain rules:
 * - Polish domestic NRB is 26 digits. It is validated via MOD-97 with the "PL" country code.
 * - Standard IBAN begins with 2 uppercase letters, 2 check digits, and country-specific length.
 * - Ownership is NOT invented: an identifier is strictly an account address / endpoint.
 */
export function validateAccountIdentifier(
  raw: string,
): AccountIdentifierValidationResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: false, error: "Account identifier cannot be empty" };
  }

  const cleaned = cleanRawIdentifier(trimmed);

  if (cleaned.length < 15 || cleaned.length > 34) {
    return {
      valid: false,
      error: `Invalid identifier length: expected between 15 and 34 characters, got ${cleaned.length}`,
    };
  }

  // Check for allowed characters (only uppercase ASCII letters and digits)
  if (!/^[A-Z0-9]+$/.test(cleaned)) {
    return {
      valid: false,
      error: "Account identifier contains invalid characters",
    };
  }

  // Case 1: Polish Domestic NRB (26 digits)
  if (/^\d{26}$/.test(cleaned)) {
    const asIban = `PL${cleaned}`;
    if (!checkIbanMod97(asIban)) {
      return {
        valid: false,
        error: "Invalid Polish account number checksum (MOD-97 failed)",
      };
    }

    return {
      valid: true,
      type: "domestic_nrb",
      normalized: asIban, // Canonical normalized form is the PL IBAN
      formatted: formatAccountIdentifier(asIban),
      masked: maskAccountIdentifier(asIban),
    };
  }

  // Case 2: IBAN format (starts with 2 letters and 2 digits)
  const countryCode = cleaned.slice(0, 2);
  const checkDigits = cleaned.slice(2, 4);

  if (!/^[A-Z]{2}$/.test(countryCode) || !/^\d{2}$/.test(checkDigits)) {
    return {
      valid: false,
      error:
        "Invalid format: expected 26 digits (Polish domestic) or IBAN starting with 2-letter country code and 2 check digits",
    };
  }

  // If country code has a known expected length, verify it
  const expectedLength = KNOWN_IBAN_LENGTHS[countryCode];
  if (expectedLength !== undefined && cleaned.length !== expectedLength) {
    return {
      valid: false,
      error: `Invalid length for ${countryCode} IBAN: expected ${expectedLength} characters, got ${cleaned.length}`,
    };
  }

  // For Polish IBAN (PL + 26 digits), ensure the rest are digits
  if (countryCode === "PL") {
    if (!/^PL\d{26}$/.test(cleaned)) {
      return {
        valid: false,
        error: "Polish IBAN must consist of 'PL' followed by 26 digits",
      };
    }
  }

  if (!checkIbanMod97(cleaned)) {
    return {
      valid: false,
      error: `Invalid IBAN checksum for ${countryCode} (MOD-97 failed)`,
    };
  }

  return {
    valid: true,
    type: "iban",
    normalized: cleaned,
    formatted: formatAccountIdentifier(cleaned),
    masked: maskAccountIdentifier(cleaned),
  };
}

/**
 * Normalizes an account identifier string into its canonical representation.
 * Throws an Error if invalid.
 */
export function normalizeAccountIdentifier(raw: string): string {
  const result = validateAccountIdentifier(raw);
  if (!result.valid) {
    throw new Error(result.error);
  }
  return result.normalized;
}

/**
 * Masks an account identifier at ordinary UI boundaries.
 * Preserves initial prefix (country + check digits) and final 4 characters.
 * Replaces middle digits with bullet dots grouped in 4-character chunks.
 *
 * Example:
 *   PL27109024020000000123456789 -> PL27 •••• •••• •••• •••• •••• 6789
 */
export function maskAccountIdentifier(normalized: string): string {
  const clean = cleanRawIdentifier(normalized);
  if (clean.length < 10) {
    return clean;
  }

  const prefix = clean.slice(0, 4);
  const suffix = clean.slice(-4);
  const middleLength = clean.length - 8;

  // Group middle into 4-bullet chunks
  const chunkCount = Math.ceil(middleLength / 4);
  const maskedChunks: string[] = [];
  for (let i = 0; i < chunkCount; i++) {
    maskedChunks.push("••••");
  }

  return `${prefix} ${maskedChunks.join(" ")} ${suffix}`;
}

/**
 * Formats a normalized account identifier into standard 4-character blocks for readability.
 *
 * Example:
 *   PL27109024020000000123456789 -> PL27 1090 2402 0000 0001 2345 6789
 */
export function formatAccountIdentifier(normalized: string): string {
  const clean = cleanRawIdentifier(normalized);
  const chunks: string[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    chunks.push(clean.slice(i, i + 4));
  }
  return chunks.join(" ");
}

/**
 * Extracts candidate Polish domestic account numbers or IBANs embedded inside free text (e.g. transaction descriptions).
 * Returns array of deduplicated normalized identifiers that passed checksum validation.
 */
export function extractAccountIdentifiersFromText(text: string): string[] {
  if (!text || typeof text !== "string") {
    return [];
  }

  const found = new Set<string>();

  // Pattern 1: Polish IBAN: PL followed by 26 digits with optional spaces or dashes
  const plIbanRegex = /\bPL[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d\b/gi;
  const plMatches = text.match(plIbanRegex) || [];
  for (const match of plMatches) {
    const val = validateAccountIdentifier(match);
    if (val.valid) {
      found.add(val.normalized);
    }
  }

  // Pattern 2: 26-digit Polish domestic numbers with optional spaces
  // Look for sequences of digits (with optional spaces) totaling 26 digits
  const tokens = text.split(/[^a-zA-Z0-9\s-]/);
  for (const token of tokens) {
    const digitsOnly = token.replace(/[\s-]/g, "");
    if (/^\d{26}$/.test(digitsOnly)) {
      const val = validateAccountIdentifier(digitsOnly);
      if (val.valid) {
        found.add(val.normalized);
      }
    }
  }

  // Pattern 3: Standard international IBAN format: 2 letters followed by 13-32 alphanumeric chars
  const ibanRegex = /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/gi;
  const generalMatches = text.match(ibanRegex) || [];
  for (const match of generalMatches) {
    const val = validateAccountIdentifier(match);
    if (val.valid) {
      found.add(val.normalized);
    }
  }

  return Array.from(found);
}
