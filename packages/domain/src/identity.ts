const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

declare const householdIdBrand: unique symbol;
declare const personIdBrand: unique symbol;
declare const accountIdBrand: unique symbol;
declare const transactionIdBrand: unique symbol;
declare const categoryIdBrand: unique symbol;
declare const accountIdentifierIdBrand: unique symbol;
declare const statementImportProfileIdBrand: unique symbol;
declare const liabilityIdBrand: unique symbol;
declare const liabilityRepaymentIdBrand: unique symbol;
declare const creditFacilityIdBrand: unique symbol;
declare const bnplPurchaseIdBrand: unique symbol;
declare const obligationIdBrand: unique symbol;

export type HouseholdId = string & { readonly [householdIdBrand]: true };
export type PersonId = string & { readonly [personIdBrand]: true };
export type AccountId = string & { readonly [accountIdBrand]: true };
export type TransactionId = string & { readonly [transactionIdBrand]: true };
export type CategoryId = string & { readonly [categoryIdBrand]: true };
export type AccountIdentifierId = string & {
  readonly [accountIdentifierIdBrand]: true;
};
export type StatementImportProfileId = string & {
  readonly [statementImportProfileIdBrand]: true;
};
export type LiabilityId = string & {
  readonly [liabilityIdBrand]: true;
};
export type LiabilityRepaymentId = string & {
  readonly [liabilityRepaymentIdBrand]: true;
};
export type CreditFacilityId = string & {
  readonly [creditFacilityIdBrand]: true;
};
export type BnplPurchaseId = string & {
  readonly [bnplPurchaseIdBrand]: true;
};
export type ObligationId = string & {
  readonly [obligationIdBrand]: true;
};

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

export function categoryId(value: string): CategoryId {
  return domainId(value, "category") as CategoryId;
}

export function accountIdentifierId(value: string): AccountIdentifierId {
  return domainId(value, "account identifier") as AccountIdentifierId;
}

export function statementImportProfileId(value: string): StatementImportProfileId {
  return domainId(value, "statement import profile") as StatementImportProfileId;
}

export function liabilityId(value: string): LiabilityId {
  return domainId(value, "liability") as LiabilityId;
}

export function liabilityRepaymentId(value: string): LiabilityRepaymentId {
  return domainId(value, "liability repayment") as LiabilityRepaymentId;
}

export function creditFacilityId(value: string): CreditFacilityId {
  return domainId(value, "credit facility") as CreditFacilityId;
}

export function bnplPurchaseId(value: string): BnplPurchaseId {
  return domainId(value, "bnpl purchase") as BnplPurchaseId;
}

export function obligationId(value: string): ObligationId {
  return domainId(value, "obligation") as ObligationId;
}

function domainId(value: string, kind: string): string {
  const normalized = value.trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    throw new Error(`Invalid ${kind} id: ${value}`);
  }
  return normalized;
}
