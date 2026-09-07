const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

declare const householdIdBrand: unique symbol;
declare const personIdBrand: unique symbol;
declare const accountIdBrand: unique symbol;
declare const transactionIdBrand: unique symbol;

export type HouseholdId = string & { readonly [householdIdBrand]: true };
export type PersonId = string & { readonly [personIdBrand]: true };
export type AccountId = string & { readonly [accountIdBrand]: true };
export type TransactionId = string & { readonly [transactionIdBrand]: true };

export function householdId(value: string): HouseholdId {
  return domainId(value, "household") as HouseholdId;
}

export function personId(value: string): PersonId {
  return domainId(value, "person") as PersonId;
}

export function accountId(value: string): AccountId {
  return domainId(value, "account") as AccountId;
}

export function transactionId(value: string): TransactionId {
  return domainId(value, "transaction") as TransactionId;
}

function domainId(value: string, kind: string): string {
  const normalized = value.trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    throw new Error(`Invalid ${kind} id: ${value}`);
  }
  return normalized;
}
