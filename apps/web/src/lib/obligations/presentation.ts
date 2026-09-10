import { getCurrencyFractionDigits } from "@/lib/transactions/money-entry";

export function minorToNatural(amountMinor: string, currency: string): string {
  try {
    const fractionDigits = getCurrencyFractionDigits(currency);
    const minor = BigInt(amountMinor);
    const divisor = 10n ** BigInt(fractionDigits);
    const whole = minor / divisor;
    if (fractionDigits === 0) {
      return whole.toString();
    }
    const fraction = (minor % divisor)
      .toString()
      .padStart(fractionDigits, "0");
    return `${whole}.${fraction}`;
  } catch {
    return amountMinor;
  }
}
