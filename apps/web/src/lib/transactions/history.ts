import "server-only";

import {
  findTransactionById,
  listAccountsByHousehold,
  listCategoriesByHousehold,
  listHouseholdMembers,
  listTransactionAuditEntries,
  TransactionNotFoundError,
} from "@nodvis/finance-db";
import type {
  TransactionAuditRow,
} from "@nodvis/finance-db";
import type {
  Transaction,
  TransactionAuditSnapshot,
} from "@nodvis/finance-domain";

import { minorUnitsToDecimalString } from "./presentation";
import type { AuthorizedHouseholdContext } from "./service";
export type {
  HistoryOperation,
  HistorySource,
  TransactionFieldChangeItem,
  TransactionHistoryActor,
  TransactionHistoryEntry,
  TransactionHistoryResult,
  TransactionHistorySummary,
} from "./history-types";
import type {
  HistoryOperation,
  HistorySource,
  TransactionFieldChangeItem,
  TransactionHistoryActor,
  TransactionHistoryEntry,
  TransactionHistoryResult,
  TransactionHistorySummary,
} from "./history-types";

function buildSummaryFromTransaction(
  tx: Transaction,
  accountMap: Map<string, string>,
  categoryMap: Map<string, string>,
  personMap: Map<string, string>,
): TransactionHistorySummary {
  const amountFormatted = `${minorUnitsToDecimalString(tx.amount.amountMinor, tx.amount.currency)} ${tx.amount.currency}`;
  const occurredOn = tx.occurredOn.toISOString().split("T")[0]!;
  const status = tx.voidedAt ? ("voided" as const) : ("active" as const);

  if (tx.kind === "expense") {
    return {
      kind: "expense",
      amountFormatted,
      occurredOn,
      accountName: accountMap.get(tx.accountId) ?? null,
      fromAccountName: null,
      toAccountName: null,
      categoryName: tx.categoryId ? (categoryMap.get(tx.categoryId) ?? null) : null,
      counterparty: tx.payee,
      personName: personMap.get(tx.paidByPersonId) ?? null,
      status,
    };
  }

  if (tx.kind === "income") {
    return {
      kind: "income",
      amountFormatted,
      occurredOn,
      accountName: accountMap.get(tx.accountId) ?? null,
      fromAccountName: null,
      toAccountName: null,
      categoryName: tx.categoryId ? (categoryMap.get(tx.categoryId) ?? null) : null,
      counterparty: tx.source,
      personName: personMap.get(tx.receivedByPersonId) ?? null,
      status,
    };
  }

  return {
    kind: "transfer",
    amountFormatted,
    occurredOn,
    accountName: null,
    fromAccountName: accountMap.get(tx.fromAccountId) ?? null,
    toAccountName: accountMap.get(tx.toAccountId) ?? null,
    categoryName: null,
    counterparty: null,
    personName: null,
    status,
  };
}

function buildSummaryFromSnapshot(
  snap: TransactionAuditSnapshot,
  accountMap: Map<string, string>,
  categoryMap: Map<string, string>,
  personMap: Map<string, string>,
): TransactionHistorySummary {
  const amountFormatted = `${minorUnitsToDecimalString(snap.amountMinor, snap.currency)} ${snap.currency}`;
  const occurredOn = snap.occurredOn.split("T")[0]!;
  const status = snap.voidedAt ? ("voided" as const) : ("active" as const);

  if (snap.kind === "expense") {
    return {
      kind: "expense",
      amountFormatted,
      occurredOn,
      accountName: snap.accountId ? (accountMap.get(snap.accountId) ?? null) : null,
      fromAccountName: null,
      toAccountName: null,
      categoryName: snap.categoryId ? (categoryMap.get(snap.categoryId) ?? null) : null,
      counterparty: snap.payee ?? null,
      personName: snap.paidByPersonId ? (personMap.get(snap.paidByPersonId) ?? null) : null,
      status,
    };
  }

  if (snap.kind === "income") {
    return {
      kind: "income",
      amountFormatted,
      occurredOn,
      accountName: snap.accountId ? (accountMap.get(snap.accountId) ?? null) : null,
      fromAccountName: null,
      toAccountName: null,
      categoryName: snap.categoryId ? (categoryMap.get(snap.categoryId) ?? null) : null,
      counterparty: snap.source ?? null,
      personName: snap.receivedByPersonId ? (personMap.get(snap.receivedByPersonId) ?? null) : null,
      status,
    };
  }

  return {
    kind: "transfer",
    amountFormatted,
    occurredOn,
    accountName: null,
    fromAccountName: snap.fromAccountId ? (accountMap.get(snap.fromAccountId) ?? null) : null,
    toAccountName: snap.toAccountId ? (accountMap.get(snap.toAccountId) ?? null) : null,
    categoryName: null,
    counterparty: null,
    personName: null,
    status,
  };
}

function computeDiff(
  before: TransactionAuditSnapshot | null,
  after: TransactionAuditSnapshot,
  accountMap: Map<string, string>,
  categoryMap: Map<string, string>,
  personMap: Map<string, string>,
): TransactionFieldChangeItem[] {
  const changes: TransactionFieldChangeItem[] = [];

  if (!before) {
    // Initial creation: list initial fields
    changes.push({
      field: "amount",
      fieldLabelKey: "fieldAmount",
      before: null,
      after: `${minorUnitsToDecimalString(after.amountMinor, after.currency)} ${after.currency}`,
    });
    changes.push({
      field: "date",
      fieldLabelKey: "fieldDate",
      before: null,
      after: after.occurredOn.split("T")[0]!,
    });

    if (after.kind === "expense") {
      if (after.accountId) {
        changes.push({
          field: "account",
          fieldLabelKey: "fieldAccount",
          before: null,
          after: accountMap.get(after.accountId) ?? "—",
        });
      }
      if (after.payee) {
        changes.push({
          field: "payee",
          fieldLabelKey: "fieldPayee",
          before: null,
          after: after.payee,
        });
      }
      if (after.categoryId) {
        changes.push({
          field: "category",
          fieldLabelKey: "fieldCategory",
          before: null,
          after: categoryMap.get(after.categoryId) ?? "—",
        });
      }
      if (after.paidByPersonId) {
        changes.push({
          field: "person",
          fieldLabelKey: "fieldPayer",
          before: null,
          after: personMap.get(after.paidByPersonId) ?? "—",
        });
      }
    } else if (after.kind === "income") {
      if (after.accountId) {
        changes.push({
          field: "account",
          fieldLabelKey: "fieldAccount",
          before: null,
          after: accountMap.get(after.accountId) ?? "—",
        });
      }
      if (after.source) {
        changes.push({
          field: "source",
          fieldLabelKey: "fieldSource",
          before: null,
          after: after.source,
        });
      }
      if (after.categoryId) {
        changes.push({
          field: "category",
          fieldLabelKey: "fieldCategory",
          before: null,
          after: categoryMap.get(after.categoryId) ?? "—",
        });
      }
      if (after.receivedByPersonId) {
        changes.push({
          field: "person",
          fieldLabelKey: "fieldBeneficiary",
          before: null,
          after: personMap.get(after.receivedByPersonId) ?? "—",
        });
      }
    } else if (after.kind === "transfer") {
      if (after.fromAccountId) {
        changes.push({
          field: "fromAccount",
          fieldLabelKey: "fieldFromAccount",
          before: null,
          after: accountMap.get(after.fromAccountId) ?? "—",
        });
      }
      if (after.toAccountId) {
        changes.push({
          field: "toAccount",
          fieldLabelKey: "fieldToAccount",
          before: null,
          after: accountMap.get(after.toAccountId) ?? "—",
        });
      }
    }

    return changes;
  }

  // Correction or void: compute differences between before and after
  if (before.amountMinor !== after.amountMinor || before.currency !== after.currency) {
    changes.push({
      field: "amount",
      fieldLabelKey: "fieldAmount",
      before: `${minorUnitsToDecimalString(before.amountMinor, before.currency)} ${before.currency}`,
      after: `${minorUnitsToDecimalString(after.amountMinor, after.currency)} ${after.currency}`,
    });
  }

  const beforeDate = before.occurredOn.split("T")[0]!;
  const afterDate = after.occurredOn.split("T")[0]!;
  if (beforeDate !== afterDate) {
    changes.push({
      field: "date",
      fieldLabelKey: "fieldDate",
      before: beforeDate,
      after: afterDate,
    });
  }

  if (before.accountId !== after.accountId) {
    changes.push({
      field: "account",
      fieldLabelKey: "fieldAccount",
      before: before.accountId ? (accountMap.get(before.accountId) ?? "—") : "—",
      after: after.accountId ? (accountMap.get(after.accountId) ?? "—") : "—",
    });
  }

  if (before.fromAccountId !== after.fromAccountId) {
    changes.push({
      field: "fromAccount",
      fieldLabelKey: "fieldFromAccount",
      before: before.fromAccountId ? (accountMap.get(before.fromAccountId) ?? "—") : "—",
      after: after.fromAccountId ? (accountMap.get(after.fromAccountId) ?? "—") : "—",
    });
  }

  if (before.toAccountId !== after.toAccountId) {
    changes.push({
      field: "toAccount",
      fieldLabelKey: "fieldToAccount",
      before: before.toAccountId ? (accountMap.get(before.toAccountId) ?? "—") : "—",
      after: after.toAccountId ? (accountMap.get(after.toAccountId) ?? "—") : "—",
    });
  }

  if (before.categoryId !== after.categoryId) {
    changes.push({
      field: "category",
      fieldLabelKey: "fieldCategory",
      before: before.categoryId ? (categoryMap.get(before.categoryId) ?? "—") : "—",
      after: after.categoryId ? (categoryMap.get(after.categoryId) ?? "—") : "—",
    });
  }

  if (before.payee !== after.payee) {
    changes.push({
      field: "payee",
      fieldLabelKey: "fieldPayee",
      before: before.payee ?? "—",
      after: after.payee ?? "—",
    });
  }

  if (before.source !== after.source) {
    changes.push({
      field: "source",
      fieldLabelKey: "fieldSource",
      before: before.source ?? "—",
      after: after.source ?? "—",
    });
  }

  const beforePersonId = before.paidByPersonId ?? before.receivedByPersonId;
  const afterPersonId = after.paidByPersonId ?? after.receivedByPersonId;
  if (beforePersonId !== afterPersonId) {
    changes.push({
      field: "person",
      fieldLabelKey: after.kind === "income" ? "fieldBeneficiary" : "fieldPayer",
      before: beforePersonId ? (personMap.get(beforePersonId) ?? "—") : "—",
      after: afterPersonId ? (personMap.get(afterPersonId) ?? "—") : "—",
    });
  }

  const beforeVoided = Boolean(before.voidedAt);
  const afterVoided = Boolean(after.voidedAt);
  if (beforeVoided !== afterVoided) {
    changes.push({
      field: "status",
      fieldLabelKey: "fieldStatus",
      before: beforeVoided ? "voided" : "active",
      after: afterVoided ? "voided" : "active",
    });
  }

  if (after.voidReason && before.voidReason !== after.voidReason) {
    changes.push({
      field: "voidReason",
      fieldLabelKey: "fieldVoidReason",
      before: before.voidReason ?? null,
      after: after.voidReason,
    });
  }

  return changes;
}

export async function getTransactionHistory(
  context: AuthorizedHouseholdContext,
  transactionId: string,
): Promise<TransactionHistoryResult> {
  const tx = await findTransactionById(context.householdId, transactionId);
  if (!tx) {
    throw new TransactionNotFoundError(
      `Transaction ${transactionId} not found in household`,
    );
  }

  const [auditRows, accountsList, categoriesList, membersList] =
    await Promise.all([
      listTransactionAuditEntries(context.householdId, transactionId),
      listAccountsByHousehold(context.householdId, { includeArchived: true }),
      listCategoriesByHousehold(context.householdId, { includeArchived: true }),
      listHouseholdMembers(context.householdId),
    ]);

  const accountMap = new Map<string, string>();
  for (const a of accountsList) {
    accountMap.set(a.id, `${a.name} (${a.currency})`);
  }

  const categoryMap = new Map<string, string>();
  for (const c of categoriesList) {
    categoryMap.set(c.id, c.name);
  }

  const personMap = new Map<string, string>();
  for (const m of membersList) {
    personMap.set(m.personId, m.displayName);
  }

  // Case 1: No audit entries exist (transaction predates change tracking)
  // We do NOT fabricate legacy events; we use an explicit baseline state.
  if (auditRows.length === 0) {
    const baselineSummary = buildSummaryFromTransaction(
      tx,
      accountMap,
      categoryMap,
      personMap,
    );

    const baselineEntry: TransactionHistoryEntry = {
      id: `baseline-${tx.id}`,
      revision: tx.version,
      operation: "baseline",
      source: "legacy",
      recordedAt: tx.occurredOn.toISOString(),
      actor: null,
      voidReason: tx.voidReason ?? null,
      isBaseline: true,
      changes: [],
      summary: baselineSummary,
    };

    return {
      transactionId: tx.id,
      history: [baselineEntry],
    };
  }

  const history: TransactionHistoryEntry[] = [];

  // Case 2: Audit rows exist, but first recorded audit revision > 1
  // (e.g. transaction was created before change tracking, then edited)
  const firstAudit = auditRows[0]!;
  if (firstAudit.revision > 1 && firstAudit.beforeState) {
    const baselineSummary = buildSummaryFromSnapshot(
      firstAudit.beforeState,
      accountMap,
      categoryMap,
      personMap,
    );

    history.push({
      id: `baseline-${tx.id}`,
      revision: 1,
      operation: "baseline",
      source: "legacy",
      recordedAt: firstAudit.beforeState.occurredOn,
      actor: null,
      voidReason: null,
      isBaseline: true,
      changes: [],
      summary: baselineSummary,
    });
  }

  for (const row of auditRows) {
    const afterState = row.afterState;
    const beforeState = row.beforeState;

    const actorDisplayName = row.personId
      ? (personMap.get(row.personId) ?? null)
      : null;

    const summary = buildSummaryFromSnapshot(
      afterState,
      accountMap,
      categoryMap,
      personMap,
    );

    const changes = computeDiff(
      beforeState,
      afterState,
      accountMap,
      categoryMap,
      personMap,
    );

    history.push({
      id: row.id,
      revision: row.revision,
      operation: row.operation,
      source: row.source,
      recordedAt: row.recordedAt.toISOString(),
      actor: row.authUserId || row.personId
        ? {
            authUserId: row.authUserId ?? null,
            personId: row.personId ?? null,
            displayName: actorDisplayName,
          }
        : null,
      voidReason: row.voidReason ?? afterState.voidReason ?? null,
      isBaseline: false,
      changes,
      summary,
    });
  }

  return {
    transactionId: tx.id,
    history,
  };
}
