const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

declare const currencyCodeBrand: unique symbol;

export type CurrencyCode = string & {
  readonly [currencyCodeBrand]: true;
};

export type Money = Readonly<{
  amountMinor: bigint;
  currency: CurrencyCode;
}>;

export function currencyCode(value: string): CurrencyCode {
  const normalized = value.trim().toUpperCase();

  if (!CURRENCY_CODE_PATTERN.test(normalized)) {
    throw new Error(`Invalid currency code: ${value}`);
  }

  return normalized as CurrencyCode;
}

export function money(amountMinor: bigint, currency: CurrencyCode | string): Money {
  return Object.freeze({
    amountMinor,
    currency: typeof currency === "string" ? currencyCode(currency) : currency,
  });
}

export function addMoney(left: Money, right: Money): Money {
  assertSameCurrency(left, right);
  return money(left.amountMinor + right.amountMinor, left.currency);
}

export function subtractMoney(left: Money, right: Money): Money {
  assertSameCurrency(left, right);
  return money(left.amountMinor - right.amountMinor, left.currency);
}

export function negateMoney(value: Money): Money {
  return money(-value.amountMinor, value.currency);
}

export function isZeroMoney(value: Money): boolean {
  return value.amountMinor === 0n;
}

function assertSameCurrency(left: Money, right: Money): void {
  if (left.currency !== right.currency) {
    throw new Error(
      `Currency mismatch: cannot combine ${left.currency} and ${right.currency}`,
    );
  }
}
