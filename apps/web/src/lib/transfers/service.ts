import "server-only";

import {
  executeTransferMatch as dbExecuteTransferMatch,
  listAccountIdentifiersByHousehold,
  listAccountsByHousehold,
  listTransactionsByHousehold,
  listTransferMatchesByHousehold,
  type TransferMatchRecord,
} from "@nodvis/finance-db";
import {
  findTransferCandidates,
  type TransferCandidate,
  type TransferMatchConfidence,
} from "@nodvis/finance-domain";

import type { HouseholdContext } from "@/lib/accounts/service";
import type { MatchTransferSchemaInput } from "./schema";

export type SerializedTransferCandidateSide = {
  transactionId: string;
  accountId: string;
  accountName?: string | undefined;
  amountMinor: string;
  currency: string;
  occurredOn: string;
  kind: "expense" | "income";
  counterpartyText: string;
  version: number;
};

export type SerializedTransferCandidate = {
  id: string;
  confidence: TransferMatchConfidence;
  fromAccountId: string;
  toAccountId: string;
  fromAccountName?: string | undefined;
  toAccountName?: string | undefined;
  outflow: SerializedTransferCandidateSide | null;
  inflow: SerializedTransferCandidateSide | null;
  amountMinor: string;
  currency: string;
  evidence: {
    matchedIdentifier?: string | undefined;
    matchedRelationshipType: "known_account_identifier" | "amount_date_heuristic";
    dateDifferenceDays: number;
    crossCurrency: boolean;
    uncertaintyReasons: readonly string[];
  };
};

export type TransferCandidatesSummary = {
  candidates: SerializedTransferCandidate[];
  counts: {
    readyAuto: number;
    reviewOnly: number;
    oneSidedPending: number;
    ambiguous: number;
    total: number;
  };
};

function serializeCandidate(c: TransferCandidate): SerializedTransferCandidate {
  return {
    id: c.id,
    confidence: c.confidence,
    fromAccountId: c.fromAccountId,
    toAccountId: c.toAccountId,
    fromAccountName: c.fromAccountName,
    toAccountName: c.toAccountName,
    outflow: c.outflow
      ? {
          transactionId: c.outflow.transactionId,
          accountId: c.outflow.accountId,
          accountName: c.outflow.accountName,
          amountMinor: c.outflow.amountMinor.toString(),
          currency: c.outflow.currency,
          occurredOn: c.outflow.occurredOn.toISOString(),
          kind: c.outflow.kind,
          counterpartyText: c.outflow.counterpartyText,
          version: c.outflow.version,
        }
      : null,
    inflow: c.inflow
      ? {
          transactionId: c.inflow.transactionId,
          accountId: c.inflow.accountId,
          accountName: c.inflow.accountName,
          amountMinor: c.inflow.amountMinor.toString(),
          currency: c.inflow.currency,
          occurredOn: c.inflow.occurredOn.toISOString(),
          kind: c.inflow.kind,
          counterpartyText: c.inflow.counterpartyText,
          version: c.inflow.version,
        }
      : null,
    amountMinor: c.amountMinor.toString(),
    currency: c.currency,
    evidence: {
      matchedIdentifier: c.evidence.matchedIdentifier,
      matchedRelationshipType: c.evidence.matchedRelationshipType,
      dateDifferenceDays: c.evidence.dateDifferenceDays,
      crossCurrency: c.evidence.crossCurrency,
      uncertaintyReasons: c.evidence.uncertaintyReasons,
    },
  };
}

export async function getHouseholdTransferCandidates(
  context: HouseholdContext,
): Promise<TransferCandidatesSummary> {
  const [accounts, identifiers, activeTransactions] = await Promise.all([
    listAccountsByHousehold(context.householdId, { includeArchived: false }),
    listAccountIdentifiersByHousehold(context.householdId),
    listTransactionsByHousehold({
      householdId: context.householdId,
      status: "active",
      limit: 1000,
    }),
  ]);

  const domainCandidates = findTransferCandidates({
    transactions: activeTransactions,
    accounts: accounts.map((a) => ({
      id: a.id as any,
      name: a.name,
      currency: a.currency,
    })),
    identifiers: identifiers.map((i) => ({
      accountId: i.accountId as any,
      normalizedIdentifier: i.normalizedIdentifier,
    })),
  });

  const serialized = domainCandidates.map(serializeCandidate);

  let readyAuto = 0;
  let reviewOnly = 0;
  let oneSidedPending = 0;
  let ambiguous = 0;

  for (const c of serialized) {
    switch (c.confidence) {
      case "ready_auto":
        readyAuto++;
        break;
      case "review_only":
        reviewOnly++;
        break;
      case "one_sided_pending":
        oneSidedPending++;
        break;
      case "ambiguous":
        ambiguous++;
        break;
    }
  }

  return {
    candidates: serialized,
    counts: {
      readyAuto,
      reviewOnly,
      oneSidedPending,
      ambiguous,
      total: serialized.length,
    },
  };
}

export async function matchTransferEntry(
  context: HouseholdContext,
  input: MatchTransferSchemaInput,
) {
  return await dbExecuteTransferMatch({
    householdId: context.householdId,
    outflowTransactionId: input.outflowTransactionId,
    expectedOutflowVersion: input.expectedOutflowVersion,
    inflowTransactionId: input.inflowTransactionId,
    expectedInflowVersion: input.expectedInflowVersion,
    matchedIdentifier: input.matchedIdentifier,
    matchConfidence: input.matchConfidence,
    notes: input.notes,
  });
}

export async function autoMatchAllConfirmedReady(
  context: HouseholdContext,
): Promise<{ matchedCount: number; errors: string[] }> {
  const summary = await getHouseholdTransferCandidates(context);
  const readyList = summary.candidates.filter(
    (c) => c.confidence === "ready_auto" && c.outflow && c.inflow,
  );

  let matchedCount = 0;
  const errors: string[] = [];

  for (const candidate of readyList) {
    if (!candidate.outflow || !candidate.inflow) continue;

    try {
      await dbExecuteTransferMatch({
        householdId: context.householdId,
        outflowTransactionId: candidate.outflow.transactionId,
        expectedOutflowVersion: candidate.outflow.version,
        inflowTransactionId: candidate.inflow.transactionId,
        expectedInflowVersion: candidate.inflow.version,
        matchedIdentifier: candidate.evidence.matchedIdentifier,
        matchConfidence: "automatic",
      });
      matchedCount++;
    } catch (err) {
      errors.push(
        `Failed to match candidate ${candidate.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return { matchedCount, errors };
}

export type SerializedReconciledTransfer = {
  id: string;
  householdId: string;
  transferTransactionId: string;
  matchedTransactionId: string;
  matchedIdentifier: string | null;
  matchConfidence: string;
  notes: string | null;
  createdAt: string;
};

export function serializeReconciledTransfer(
  record: TransferMatchRecord,
): SerializedReconciledTransfer {
  return {
    id: record.id,
    householdId: record.householdId,
    transferTransactionId: record.transferTransactionId,
    matchedTransactionId: record.matchedTransactionId,
    matchedIdentifier: record.matchedIdentifier,
    matchConfidence: record.matchConfidence,
    notes: record.notes,
    createdAt: record.createdAt.toISOString(),
  };
}

export async function listReconciledTransfers(
  context: HouseholdContext,
  options?: { limit?: number },
): Promise<TransferMatchRecord[]> {
  return await listTransferMatchesByHousehold(context.householdId, options);
}
