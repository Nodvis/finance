import { describe, expect, it } from "vitest";

import {
  getCurrencyFractionDigits,
  parseNaturalDecimalToMinor,
} from "./money-entry";

describe("getCurrencyFractionDigits", () => {
  it("returns 2 for standard fiat currencies", () => {
    expect(getCurrencyFractionDigits("PLN")).toBe(2);
    expect(getCurrencyFractionDigits("EUR")).toBe(2);
    expect(getCurrencyFractionDigits("USD")).toBe(2);
    expect(getCurrencyFractionDigits("GBP")).toBe(2);
  });

  it("returns 0 for zero-decimal currencies like JPY", () => {
    expect(getCurrencyFractionDigits("JPY")).toBe(0);
    expect(getCurrencyFractionDigits("KRW")).toBe(0);
  });

  it("returns 3 for 3-decimal currencies like KWD and BHD", () => {
    expect(getCurrencyFractionDigits("KWD")).toBe(3);
    expect(getCurrencyFractionDigits("BHD")).toBe(3);
  });
});

describe("parseNaturalDecimalToMinor", () => {
  it("parses Polish decimal format with comma", () => {
    expect(parseNaturalDecimalToMinor("123,45", "PLN")).toEqual({
      success: true,
      amountMinor: "12345",
    });
    expect(parseNaturalDecimalToMinor("67,89", "PLN")).toEqual({
      success: true,
      amountMinor: "6789",
    });
  });

  it("parses English decimal format with dot", () => {
    expect(parseNaturalDecimalToMinor("123.45", "PLN")).toEqual({
      success: true,
      amountMinor: "12345",
    });
    expect(parseNaturalDecimalToMinor("67.89", "EUR")).toEqual({
      success: true,
      amountMinor: "6789",
    });
  });

  it("parses single decimal fraction digit with proper zero padding", () => {
    expect(parseNaturalDecimalToMinor("123,4", "PLN")).toEqual({
      success: true,
      amountMinor: "12340",
    });
    expect(parseNaturalDecimalToMinor("123.4", "USD")).toEqual({
      success: true,
      amountMinor: "12340",
    });
  });

  it("parses whole integer numbers without decimals", () => {
    expect(parseNaturalDecimalToMinor("123", "PLN")).toEqual({
      success: true,
      amountMinor: "12300",
    });
    expect(parseNaturalDecimalToMinor("1", "EUR")).toEqual({
      success: true,
      amountMinor: "100",
    });
  });

  it("parses decimal amounts less than 1 with or without leading zero", () => {
    expect(parseNaturalDecimalToMinor("0,05", "PLN")).toEqual({
      success: true,
      amountMinor: "5",
    });
    expect(parseNaturalDecimalToMinor(",05", "PLN")).toEqual({
      success: true,
      amountMinor: "5",
    });
    expect(parseNaturalDecimalToMinor("0.50", "USD")).toEqual({
      success: true,
      amountMinor: "50",
    });
    expect(parseNaturalDecimalToMinor(".5", "USD")).toEqual({
      success: true,
      amountMinor: "50",
    });
  });

  it("handles whitespace and grouping separators gracefully", () => {
    expect(parseNaturalDecimalToMinor("  123,45  ", "PLN")).toEqual({
      success: true,
      amountMinor: "12345",
    });
    expect(parseNaturalDecimalToMinor("1 234,56", "PLN")).toEqual({
      success: true,
      amountMinor: "123456",
    });
    expect(parseNaturalDecimalToMinor("1,234.56", "USD")).toEqual({
      success: true,
      amountMinor: "123456",
    });
    expect(parseNaturalDecimalToMinor("1.234,56", "EUR")).toEqual({
      success: true,
      amountMinor: "123456",
    });
  });

  it("preserves exact precision for values exceeding Number.MAX_SAFE_INTEGER without float coercion", () => {
    const hugeInput = "9007199254740991,99";
    const result = parseNaturalDecimalToMinor(hugeInput, "PLN");
    expect(result).toEqual({
      success: true,
      amountMinor: "900719925474099199",
    });
  });

  it("supports zero-decimal currencies like JPY", () => {
    expect(parseNaturalDecimalToMinor("1500", "JPY")).toEqual({
      success: true,
      amountMinor: "1500",
    });
    expect(parseNaturalDecimalToMinor("1500.5", "JPY")).toEqual({
      success: false,
      error: "too_many_decimals",
    });
  });

  it("supports 3-decimal currencies like KWD", () => {
    expect(parseNaturalDecimalToMinor("12.345", "KWD")).toEqual({
      success: true,
      amountMinor: "12345",
    });
    expect(parseNaturalDecimalToMinor("12,3", "KWD")).toEqual({
      success: true,
      amountMinor: "12300",
    });
  });

  it("rejects zero or negative amounts", () => {
    expect(parseNaturalDecimalToMinor("0", "PLN")).toEqual({
      success: false,
      error: "must_be_positive",
    });
    expect(parseNaturalDecimalToMinor("0,00", "PLN")).toEqual({
      success: false,
      error: "must_be_positive",
    });
    expect(parseNaturalDecimalToMinor("-50,00", "PLN")).toEqual({
      success: false,
      error: "must_be_positive",
    });
  });

  it("rejects inputs with too many decimal places", () => {
    expect(parseNaturalDecimalToMinor("12,345", "PLN")).toEqual({
      success: false,
      error: "too_many_decimals",
    });
    expect(parseNaturalDecimalToMinor("12.345", "USD")).toEqual({
      success: false,
      error: "too_many_decimals",
    });
  });

  it("rejects empty or invalid string formats", () => {
    expect(parseNaturalDecimalToMinor("", "PLN")).toEqual({
      success: false,
      error: "empty",
    });
    expect(parseNaturalDecimalToMinor("   ", "PLN")).toEqual({
      success: false,
      error: "empty",
    });
    expect(parseNaturalDecimalToMinor("abc", "PLN")).toEqual({
      success: false,
      error: "invalid_format",
    });
    expect(parseNaturalDecimalToMinor("12a45", "PLN")).toEqual({
      success: false,
      error: "invalid_format",
    });
    expect(parseNaturalDecimalToMinor("12..34", "PLN")).toEqual({
      success: false,
      error: "invalid_format",
    });
  });
});
