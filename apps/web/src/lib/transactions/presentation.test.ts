import { describe, expect, it } from "vitest";

import {
  formatAmountPresentation,
  minorUnitsToDecimalString,
} from "./presentation";

describe("minorUnitsToDecimalString", () => {
  it("converts zero minor units to 0.00", () => {
    expect(minorUnitsToDecimalString("0")).toBe("0.00");
    expect(minorUnitsToDecimalString(0n)).toBe("0.00");
  });

  it("converts single-digit minor units with proper zero-padding", () => {
    expect(minorUnitsToDecimalString("5")).toBe("0.05");
    expect(minorUnitsToDecimalString(5n)).toBe("0.05");
  });

  it("converts two-digit minor units less than one major unit", () => {
    expect(minorUnitsToDecimalString("50")).toBe("0.50");
    expect(minorUnitsToDecimalString(50n)).toBe("0.50");
  });

  it("converts whole currency units", () => {
    expect(minorUnitsToDecimalString("100")).toBe("1.00");
    expect(minorUnitsToDecimalString("4500")).toBe("45.00");
    expect(minorUnitsToDecimalString(4500n)).toBe("45.00");
  });

  it("handles negative amounts correctly", () => {
    expect(minorUnitsToDecimalString("-5")).toBe("-0.05");
    expect(minorUnitsToDecimalString(-5n)).toBe("-0.05");
    expect(minorUnitsToDecimalString("-4500")).toBe("-45.00");
    expect(minorUnitsToDecimalString(-4500n)).toBe("-45.00");
  });

  it("preserves exact precision for values exceeding Number.MAX_SAFE_INTEGER", () => {
    const largeMinor = "900719925474099199";

    // Standard floating-point division loses precision:
    // Number(900719925474099199) / 100 === 9007199254740992
    expect(String(Number(largeMinor) / 100)).toBe("9007199254740992");

    // minorUnitsToDecimalString preserves precision completely:
    expect(minorUnitsToDecimalString(largeMinor)).toBe("9007199254740991.99");
    expect(minorUnitsToDecimalString(BigInt(largeMinor))).toBe(
      "9007199254740991.99",
    );
  });

  it("handles arbitrary length integer strings", () => {
    const hugeMinor = "123456789012345678901234567890";
    expect(minorUnitsToDecimalString(hugeMinor)).toBe(
      "1234567890123456789012345678.90",
    );
  });
});

describe("formatAmountPresentation", () => {
  it("formats standard amounts using locale and currency without precision loss", () => {
    const formattedPl = formatAmountPresentation("4500", "PLN", "pl");
    // In Polish, standard formatting produces non-breaking space and zł symbol
    expect(formattedPl).toMatch(/45,00/);
    expect(formattedPl).toMatch(/zł/);

    const formattedEn = formatAmountPresentation("4500", "PLN", "en");
    expect(formattedEn).toMatch(/PLN/);
    expect(formattedEn).toMatch(/45.00/);
  });

  it("formats small amounts (< 1 major unit)", () => {
    const formatted = formatAmountPresentation("5", "USD", "en");
    expect(formatted).toBe("$0.05");
  });

  it("formats small negative amounts (< 1 major unit)", () => {
    const formatted = formatAmountPresentation("-5", "USD", "en");
    expect(formatted).toBe("-$0.05");
  });

  it("preserves exact minor units for values exceeding Number.MAX_SAFE_INTEGER", () => {
    const largeMinor = "900719925474099199";
    const formatted = formatAmountPresentation(largeMinor, "PLN", "en");

    // Must preserve the .99 cents rather than rounding to .00
    expect(formatted).toMatch(/99/);
    expect(formatted).not.toMatch(/9007199254740992.00/);
  });

  it("retains exact whole and fraction in formatted output for huge amounts exceeding safe float precision", () => {
    const hugeMinor = "123456789012345678901234567890";
    const formattedUsd = formatAmountPresentation(hugeMinor, "USD", "en");
    expect(formattedUsd).toBe("$1,234,567,890,123,456,789,012,345,678.90");

    const formattedNegUsd = formatAmountPresentation(
      `-${hugeMinor}`,
      "USD",
      "en",
    );
    expect(formattedNegUsd).toBe("-$1,234,567,890,123,456,789,012,345,678.90");

    const formattedPln = formatAmountPresentation(hugeMinor, "PLN", "en");
    expect(formattedPln).toContain("1,234,567,890,123,456,789,012,345,678.90");
    // Coercing to float Number loses precision and produces rounded zeros
    expect(formattedPln).not.toMatch(/900,000,000,000\.00/);
  });

  it("falls back gracefully when currency is invalid", () => {
    const fallback = formatAmountPresentation("4500", "INVALID_CURRENCY", "en");
    expect(fallback).toBe("4500 INVALID_CURRENCY");
  });
});
