import type { HouseholdId, PersonId } from "./identity";
import type { CurrencyCode } from "./money";
import { currencyCode } from "./money";

const MAX_NAME_LENGTH = 160;

export type Household = Readonly<{
  id: HouseholdId;
  name: string;
  defaultCurrency: CurrencyCode;
}>;

export type Person = Readonly<{
  id: PersonId;
  displayName: string;
}>;

export type HouseholdMembership = Readonly<{
  householdId: HouseholdId;
  personId: PersonId;
}>;

export function createHousehold(input: {
  id: HouseholdId;
  name: string;
  defaultCurrency: CurrencyCode | string;
}): Household {
  return Object.freeze({
    id: input.id,
    name: domainName(input.name, "household"),
    defaultCurrency:
      typeof input.defaultCurrency === "string"
        ? currencyCode(input.defaultCurrency)
        : input.defaultCurrency,
  });
}

export function createPerson(input: {
  id: PersonId;
  displayName: string;
}): Person {
  return Object.freeze({
    id: input.id,
    displayName: domainName(input.displayName, "person"),
  });
}

export function householdMembership(
  householdId: HouseholdId,
  personId: PersonId,
): HouseholdMembership {
  return Object.freeze({ householdId, personId });
}

function domainName(value: string, kind: string): string {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > MAX_NAME_LENGTH) {
    throw new Error(`Invalid ${kind} name`);
  }
  return normalized;
}
