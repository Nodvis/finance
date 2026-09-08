import type {
  AccountId,
  CategoryId,
  PersonId,
  TransactionId,
} from "./identity";
import type { Money } from "./money";
import type { Transaction, TransactionKind } from "./transaction";

export const TRANSACTION_AUDIT_OPERATIONS = [
  "create",
  "correction",
  "void",
] as const;
export type TransactionAuditOperation =
  (typeof TRANSACTION_AUDIT_OPERATIONS)[number];

export const TRANSACTION_AUDIT_SOURCES = [
  "manual",
  "system",
  "import",
] as const;
export type TransactionAuditSource =
  (typeof TRANSACTION_AUDIT_SOURCES)[number];

export type TransactionAuditSnapshot = Readonly<{
  kind: TransactionKind;
  amountMinor: string;
  currency: string;
  occurredOn: string;
  accountId: string | null;
  categoryId: string | null;
  payee: string | null;
  paidByPersonId: string | null;
  source: string | null;
  receivedByPersonId: string | null;
  fromAccountId: string | null;
  toAccountId: string | null;
  version: number;
  voidedAt: string | null;
  voidReason: string | null;
}>;

export type TransactionAuditFieldDiff = Readonly<{
  field:
    | "kind"
    | "amount"
    | "occurredOn"
    | "accountId"
    | "categoryId"
    | "payee"
    | "paidByPersonId"
    | "source"
    | "receivedByPersonId"
    | "fromAccountId"
    | "toAccountId"
    | "status"
    | "voidReason";
  before: string | null;
  after: string | null;
}>;

export function createTransactionAuditSnapshot(
  tx: Transaction,
): TransactionAuditSnapshot {
  const base = {
    kind: tx.kind,
    amountMinor: tx.amount.amountMinor.toString(),
    currency: tx.amount.currency,
    occurredOn: tx.occurredOn.toISOString(),
    version: tx.version,
    voidedAt: tx.voidedAt ? tx.voidedAt.toISOString() : null,
    voidReason: tx.voidReason ?? null,
  };

  if (tx.kind === "expense") {
    return Object.freeze({
      ...base,
      accountId: tx.accountId,
      categoryId: tx.categoryId ?? null,
      payee: tx.payee,
      paidByPersonId: tx.paidByPersonId,
      source: null,
      receivedByPersonId: null,
      fromAccountId: null,
      toAccountId: null,
    });
  }

  if (tx.kind === "income") {
    return Object.freeze({
      ...base,
      accountId: tx.accountId,
      categoryId: tx.categoryId ?? null,
      source: tx.source,
      receivedByPersonId: tx.receivedByPersonId,
      payee: null,
      paidByPersonId: null,
      fromAccountId: null,
      toAccountId: null,
    });
  }

  return Object.freeze({
    ...base,
    accountId: null,
    categoryId: null,
    payee: null,
    paidByPersonId: null,
    source: null,
    receivedByPersonId: null,
    fromAccountId: tx.fromAccountId,
    toAccountId: tx.toAccountId,
  });
}

export function diffTransactionAuditSnapshots(
  before: TransactionAuditSnapshot | null,
  after: TransactionAuditSnapshot,
): TransactionAuditFieldDiff[] {
  const diffs: TransactionAuditFieldDiff[] = [];

  if (!before) {
    diffs.push({
      field: "amount",
      before: null,
      after: `${after.amountMinor} ${after.currency}`,
    });
    diffs.push({
      field: "occurredOn",
      before: null,
      after: after.occurredOn,
    });
    if (after.accountId) {
      diffs.push({
        field: "accountId",
        before: null,
        after: after.accountId,
      });
    }
    if (after.fromAccountId) {
      diffs.push({
        field: "fromAccountId",
        before: null,
        after: after.fromAccountId,
      });
    }
    if (after.toAccountId) {
      diffs.push({
        field: "toAccountId",
        before: null,
        after: after.toAccountId,
      });
    }
    if (after.categoryId) {
      diffs.push({
        field: "categoryId",
        before: null,
        after: after.categoryId,
      });
    }
    if (after.payee) {
      diffs.push({
        field: "payee",
        before: null,
        after: after.payee,
      });
    }
    if (after.source) {
      diffs.push({
        field: "source",
        before: null,
        after: after.source,
      });
    }
    if (after.paidByPersonId) {
      diffs.push({
        field: "paidByPersonId",
        before: null,
        after: after.paidByPersonId,
      });
    }
    if (after.receivedByPersonId) {
      diffs.push({
        field: "receivedByPersonId",
        before: null,
        after: after.receivedByPersonId,
      });
    }
    return diffs;
  }

  if (
    before.amountMinor !== after.amountMinor ||
    before.currency !== after.currency
  ) {
    diffs.push({
      field: "amount",
      before: `${before.amountMinor} ${before.currency}`,
      after: `${after.amountMinor} ${after.currency}`,
    });
  }

  if (before.occurredOn !== after.occurredOn) {
    diffs.push({
      field: "occurredOn",
      before: before.occurredOn,
      after: after.occurredOn,
    });
  }

  if (before.accountId !== after.accountId) {
    diffs.push({
      field: "accountId",
      before: before.accountId,
      after: after.accountId,
    });
  }

  if (before.fromAccountId !== after.fromAccountId) {
    diffs.push({
      field: "fromAccountId",
      before: before.fromAccountId,
      after: after.fromAccountId,
    });
  }

  if (before.toAccountId !== after.toAccountId) {
    diffs.push({
      field: "toAccountId",
      before: before.toAccountId,
      after: after.toAccountId,
    });
  }

  if (before.categoryId !== after.categoryId) {
    diffs.push({
      field: "categoryId",
      before: before.categoryId,
      after: after.categoryId,
    });
  }

  if (before.payee !== after.payee) {
    diffs.push({
      field: "payee",
      before: before.payee,
      after: after.payee,
    });
  }

  if (before.source !== after.source) {
    diffs.push({
      field: "source",
      before: before.source,
      after: after.source,
    });
  }

  if (before.paidByPersonId !== after.paidByPersonId) {
    diffs.push({
      field: "paidByPersonId",
      before: before.paidByPersonId,
      after: after.paidByPersonId,
    });
  }

  if (before.receivedByPersonId !== after.receivedByPersonId) {
    diffs.push({
      field: "receivedByPersonId",
      before: before.receivedByPersonId,
      after: after.receivedByPersonId,
    });
  }

  const beforeVoided = Boolean(before.voidedAt);
  const afterVoided = Boolean(after.voidedAt);
  if (beforeVoided !== afterVoided) {
    diffs.push({
      field: "status",
      before: beforeVoided ? "voided" : "active",
      after: afterVoided ? "voided" : "active",
    });
  }

  if (before.voidReason !== after.voidReason && (before.voidReason || after.voidReason)) {
    diffs.push({
      field: "voidReason",
      before: before.voidReason,
      after: after.voidReason,
    });
  }

  return diffs;
}
