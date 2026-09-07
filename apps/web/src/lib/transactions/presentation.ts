/**
 * Converts minor units (cents, grosze) to a two-decimal canonical fiat string representation
 * (e.g. "4500" -> "45.00", "5" -> "0.05", "-4500" -> "-45.00").
 * Uses BigInt integer arithmetic to prevent IEEE-754 floating-point precision loss
 * on arbitrarily large transaction amounts.
 */
export function minorUnitsToDecimalString(
  amountMinor: string | bigint,
): string {
  const minor =
    typeof amountMinor === "bigint" ? amountMinor : BigInt(amountMinor);
  const isNegative = minor < 0n;
  const abs = isNegative ? -minor : minor;
  const whole = abs / 100n;
  const fraction = (abs % 100n).toString().padStart(2, "0");
  return `${isNegative ? "-" : ""}${whole}.${fraction}`;
}

/**
 * Formats a project-supported two-decimal fiat currency amount for browser presentation.
 * Avoids converting canonical amounts through floating-point Number (e.g. Number(minor) / 100),
 * safely preserving exact precision for large minor-unit values.
 */
export function formatAmountPresentation(
  amountMinor: string | bigint,
  currency: string,
  locale: string,
): string {
  try {
    const minor =
      typeof amountMinor === "bigint" ? amountMinor : BigInt(amountMinor);
    const isNegative = minor < 0n;
    const abs = isNegative ? -minor : minor;
    const whole = abs / 100n;
    const fraction = (abs % 100n).toString().padStart(2, "0");

    const formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const dummyValue = isNegative ? (whole === 0n ? -1n : -whole) : whole;
    const parts = formatter.formatToParts(dummyValue);

    return parts
      .map((part) => {
        if (part.type === "integer" && whole === 0n) {
          return "0";
        }
        if (part.type === "fraction") {
          return fraction;
        }
        return part.value;
      })
      .join("");
  } catch {
    return `${amountMinor} ${currency}`;
  }
}
