import { describe, expect, it } from "vitest";

import {
  cleanRawIdentifier,
  extractAccountIdentifiersFromText,
  formatAccountIdentifier,
  maskAccountIdentifier,
  normalizeAccountIdentifier,
  validateAccountIdentifier,
} from "./account-identifier";

describe("account-identifier domain validation", () => {
  const VALID_PL_IBAN = "PL74109024020000000123456789";
  const VALID_PL_DOMESTIC = "74109024020000000123456789";
  const VALID_PL_FORMATTED = "74 1090 2402 0000 0001 2345 6789";
  const VALID_DE_IBAN = "DE89370400440532013000";

  describe("validateAccountIdentifier", () => {
    it("validates and normalizes valid Polish domestic 26-digit NRB", () => {
      const result = validateAccountIdentifier(VALID_PL_DOMESTIC);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.type).toBe("domestic_nrb");
        expect(result.normalized).toBe(VALID_PL_IBAN);
        expect(result.formatted).toBe("PL74 1090 2402 0000 0001 2345 6789");
        expect(result.masked).toBe("PL74 •••••••• •••• •••• •••• 6789".replace("••••••••", "•••• ••••"));
      }
    });

    it("validates Polish domestic NRB with spaces and dashes", () => {
      const result = validateAccountIdentifier(VALID_PL_FORMATTED);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.normalized).toBe(VALID_PL_IBAN);
      }
    });

    it("validates Polish international IBAN with PL prefix", () => {
      const result = validateAccountIdentifier("pl 74 1090 2402 0000 0001 2345 6789");
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.type).toBe("iban");
        expect(result.normalized).toBe(VALID_PL_IBAN);
      }
    });

    it("validates international German IBAN", () => {
      const result = validateAccountIdentifier("DE 89 3704 0044 0532 0130 00");
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.type).toBe("iban");
        expect(result.normalized).toBe(VALID_DE_IBAN);
      }
    });

    it("rejects empty or whitespace identifier", () => {
      const result = validateAccountIdentifier("   ");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("cannot be empty");
      }
    });

    it("rejects invalid checksum for Polish NRB", () => {
      // Change one digit in check digits: 74 -> 75
      const invalidChecksum = "75109024020000000123456789";
      const result = validateAccountIdentifier(invalidChecksum);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("MOD-97 failed");
      }
    });

    it("rejects invalid characters", () => {
      const result = validateAccountIdentifier("7410902402000000012345678#");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("invalid characters");
      }
    });

    it("rejects wrong length for Polish IBAN", () => {
      // 25 digits instead of 26
      const result = validateAccountIdentifier("PL741090240200000001234567");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("Invalid length");
      }
    });

    it("rejects wrong length for German IBAN", () => {
      // DE must be 22
      const result = validateAccountIdentifier("DE8937040044053201300");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("Invalid length for DE IBAN");
      }
    });
  });

  describe("maskAccountIdentifier", () => {
    it("masks internal characters at UI boundaries, preserving prefix and last 4", () => {
      const masked = maskAccountIdentifier(VALID_PL_IBAN);
      expect(masked.startsWith("PL74")).toBe(true);
      expect(masked.endsWith("6789")).toBe(true);
      expect(masked).toContain("••••");
      // Must not contain full unmasked number
      expect(masked).not.toContain("10902402000000012345");
    });
  });

  describe("formatAccountIdentifier", () => {
    it("formats into 4-character blocks", () => {
      const formatted = formatAccountIdentifier(VALID_PL_IBAN);
      expect(formatted).toBe("PL74 1090 2402 0000 0001 2345 6789");
    });
  });

  describe("normalizeAccountIdentifier", () => {
    it("returns canonical string when valid", () => {
      expect(normalizeAccountIdentifier(VALID_PL_DOMESTIC)).toBe(VALID_PL_IBAN);
    });

    it("throws an error when invalid", () => {
      expect(() => normalizeAccountIdentifier("invalid")).toThrow();
    });
  });

  describe("extractAccountIdentifiersFromText", () => {
    it("extracts valid Polish IBAN embedded in bank transaction description", () => {
      const text = "PRZELEW WEWNETRZNY NA RACHUNEK PL74 1090 2402 0000 0001 2345 6789 TYTULEM ZASILENIE";
      const extracted = extractAccountIdentifiersFromText(text);
      expect(extracted).toEqual([VALID_PL_IBAN]);
    });

    it("extracts valid 26-digit domestic NRB embedded in description", () => {
      const text = "Przelew srodkow: 74109024020000000123456789, ref 99881";
      const extracted = extractAccountIdentifiersFromText(text);
      expect(extracted).toEqual([VALID_PL_IBAN]);
    });

    it("ignores invalid or non-checksum numbers", () => {
      const text = "PESEL: 90010112345 or invoice 12345678901234567890123456";
      const extracted = extractAccountIdentifiersFromText(text);
      expect(extracted).toEqual([]);
    });
  });
});
