import { extractAccountIdentifiersFromText } from "./account-identifier";
import type { AccountId, TransactionId } from "./identity";
import type { Transaction } from "./transaction";

export const TRANSFER_MATCH_CONFIDENCES = [
  "ready_auto",
  "review_only",
  "one_sided_pending",
  "ambiguous",
] as const;

export type TransferMatchConfidence =
  (typeof TRANSFER_MATCH_CONFIDENCES)[number];

export type TransferCandidateSide = Readonly<{
  transactionId: TransactionId;
  accountId: AccountId;
  accountName?: string | undefined;
  amountMinor: bigint;
  currency: string;
  occurredOn: Date;
  kind: "expense" | "income";
  counterpartyText: string;
  version: number;
}>;

export type TransferCandidateEvidence = Readonly<{
  matchedIdentifier?: string | undefined;
  matchedRelationshipType: "known_account_identifier" | "amount_date_heuristic";
  dateDifferenceDays: number;
  crossCurrency: boolean;
  uncertaintyReasons: readonly string[];
}>;

export type TransferCandidate = Readonly<{
  id: string; // Deterministic candidate ID
  confidence: TransferMatchConfidence;
  fromAccountId: AccountId;
  toAccountId: AccountId;
  fromAccountName?: string | undefined;
  toAccountName?: string | undefined;
  outflow: TransferCandidateSide | null;
  inflow: TransferCandidateSide | null;
  amountMinor: bigint;
  currency: string;
  evidence: TransferCandidateEvidence;
}>;

export type AccountInfo = Readonly<{
  id: AccountId;
  name: string;
  currency: string;
}>;

export type AccountIdentifierInfo = Readonly<{
  accountId: AccountId;
  normalizedIdentifier: string;
}>;

/**
 * Pure domain function to detect and classify transfer candidates across household transactions and known identifiers.
 */
export function findTransferCandidates(params: {
  transactions: readonly Transaction[];
  accounts: readonly AccountInfo[];
  identifiers: readonly AccountIdentifierInfo[];
  maxDateDifferenceDays?: number;
}): TransferCandidate[] {
  const maxDateDiffDays = params.maxDateDifferenceDays ?? 4;
  const accountsById = new Map<string, AccountInfo>();
  for (const acc of params.accounts) {
    accountsById.set(acc.id, acc);
  }

  // Map normalized identifier -> accountId
  const identifierToAccountId = new Map<string, AccountId>();
  for (const iden of params.identifiers) {
    identifierToAccountId.set(iden.normalizedIdentifier, iden.accountId);
  }

  // Filter out voided transactions and existing transfers
  const activeExpenses: TransferCandidateSide[] = [];
  const activeIncomes: TransferCandidateSide[] = [];

  for (const tx of params.transactions) {
    if (tx.voidedAt !== null) continue;

    if (tx.kind === "expense") {
      const acc = accountsById.get(tx.accountId);
      activeExpenses.push({
        transactionId: tx.id,
        accountId: tx.accountId,
        accountName: acc?.name,
        amountMinor: tx.amount.amountMinor,
        currency: tx.amount.currency,
        occurredOn: tx.occurredOn,
        kind: "expense",
        counterpartyText: tx.payee,
        version: tx.version,
      });
    } else if (tx.kind === "income") {
      const acc = accountsById.get(tx.accountId);
      activeIncomes.push({
        transactionId: tx.id,
        accountId: tx.accountId,
        accountName: acc?.name,
        amountMinor: tx.amount.amountMinor,
        currency: tx.amount.currency,
        occurredOn: tx.occurredOn,
        kind: "income",
        counterpartyText: tx.source,
        version: tx.version,
      });
    }
  }

  const candidates: TransferCandidate[] = [];
  const pairedExpenseTxIds = new Set<string>();
  const pairedIncomeTxIds = new Set<string>();

  // Helper to extract known target account from text via registered identifiers
  const findTargetAccountIdFromText = (
    text: string,
    currentAccountId: string,
  ): { targetAccountId: AccountId; matchedIdentifier: string } | null => {
    const extracted = extractAccountIdentifiersFromText(text);
    for (const iden of extracted) {
      const targetAccId = identifierToAccountId.get(iden);
      if (targetAccId && targetAccId !== currentAccountId) {
        return { targetAccountId: targetAccId, matchedIdentifier: iden };
      }
    }
    return null;
  };

  // 1. First pass: Match expenses that have confirmed account identifiers
  for (const exp of activeExpenses) {
    const target = findTargetAccountIdFromText(
      exp.counterpartyText,
      exp.accountId,
    );

    if (target) {
      // Confirmed relationship targeting target.targetAccountId
      const targetAcc = accountsById.get(target.targetAccountId);
      const isCrossCurrencyAccount =
        targetAcc && targetAcc.currency !== exp.currency;

      // Find compatible counterpart incomes on the target account
      const matchingIncomes = activeIncomes.filter((inc) => {
        if (inc.accountId !== target.targetAccountId) return false;
        if (pairedIncomeTxIds.has(inc.transactionId)) return false;

        // Date check: income usually occurs same day or a few days after expense (or within window)
        const dateDiffDays =
          Math.abs(inc.occurredOn.getTime() - exp.occurredOn.getTime()) /
          (1000 * 60 * 60 * 24);
        if (dateDiffDays > maxDateDiffDays) return false;

        // Amount check
        if (!isCrossCurrencyAccount && inc.amountMinor !== exp.amountMinor) {
          return false;
        }

        return true;
      });

      if (matchingIncomes.length === 1) {
        const inc = matchingIncomes[0]!;
        pairedExpenseTxIds.add(exp.transactionId);
        pairedIncomeTxIds.add(inc.transactionId);

        const dateDiff =
          Math.abs(inc.occurredOn.getTime() - exp.occurredOn.getTime()) /
          (1000 * 60 * 60 * 24);

        const crossCur = inc.currency !== exp.currency;
        const confidence: TransferMatchConfidence = crossCur
          ? "ambiguous"
          : "ready_auto";

        candidates.push({
          id: `match:${exp.transactionId}:${inc.transactionId}`,
          confidence,
          fromAccountId: exp.accountId,
          toAccountId: inc.accountId,
          fromAccountName: exp.accountName,
          toAccountName: inc.accountName,
          outflow: exp,
          inflow: inc,
          amountMinor: exp.amountMinor,
          currency: exp.currency,
          evidence: {
            matchedIdentifier: target.matchedIdentifier,
            matchedRelationshipType: "known_account_identifier",
            dateDifferenceDays: Math.round(dateDiff * 10) / 10,
            crossCurrency: crossCur,
            uncertaintyReasons: crossCur ? ["CROSS_CURRENCY_UNCERTAINTY"] : [],
          },
        });
      } else if (matchingIncomes.length > 1) {
        pairedExpenseTxIds.add(exp.transactionId);
        candidates.push({
          id: `ambiguous:exp:${exp.transactionId}`,
          confidence: "ambiguous",
          fromAccountId: exp.accountId,
          toAccountId: target.targetAccountId,
          fromAccountName: exp.accountName,
          toAccountName: targetAcc?.name,
          outflow: exp,
          inflow: null,
          amountMinor: exp.amountMinor,
          currency: exp.currency,
          evidence: {
            matchedIdentifier: target.matchedIdentifier,
            matchedRelationshipType: "known_account_identifier",
            dateDifferenceDays: 0,
            crossCurrency: !!isCrossCurrencyAccount,
            uncertaintyReasons: ["MULTIPLE_COUNTERPARTS_FOUND"],
          },
        });
      } else {
        // No counterpart income found yet -> One-sided pending transfer candidate!
        pairedExpenseTxIds.add(exp.transactionId);
        candidates.push({
          id: `pending:exp:${exp.transactionId}`,
          confidence: "one_sided_pending",
          fromAccountId: exp.accountId,
          toAccountId: target.targetAccountId,
          fromAccountName: exp.accountName,
          toAccountName: targetAcc?.name,
          outflow: exp,
          inflow: null,
          amountMinor: exp.amountMinor,
          currency: exp.currency,
          evidence: {
            matchedIdentifier: target.matchedIdentifier,
            matchedRelationshipType: "known_account_identifier",
            dateDifferenceDays: 0,
            crossCurrency: !!isCrossCurrencyAccount,
            uncertaintyReasons: ["AWAITING_COUNTERPART_INFLOW"],
          },
        });
      }
    }
  }

  // 2. Second pass: Check incomes that have confirmed account identifiers but were not paired
  for (const inc of activeIncomes) {
    if (pairedIncomeTxIds.has(inc.transactionId)) continue;

    const source = findTargetAccountIdFromText(
      inc.counterpartyText,
      inc.accountId,
    );

    if (source) {
      // Confirmed relationship from source.targetAccountId
      const sourceAcc = accountsById.get(source.targetAccountId);

      // Check if there's an unpaired expense on the source account
      const matchingExpenses = activeExpenses.filter((exp) => {
        if (exp.accountId !== source.targetAccountId) return false;
        if (pairedExpenseTxIds.has(exp.transactionId)) return false;

        const dateDiffDays =
          Math.abs(inc.occurredOn.getTime() - exp.occurredOn.getTime()) /
          (1000 * 60 * 60 * 24);
        if (dateDiffDays > maxDateDiffDays) return false;

        if (exp.amountMinor !== inc.amountMinor) return false;
        return true;
      });

      if (matchingExpenses.length === 1) {
        const exp = matchingExpenses[0]!;
        pairedExpenseTxIds.add(exp.transactionId);
        pairedIncomeTxIds.add(inc.transactionId);

        const dateDiff =
          Math.abs(inc.occurredOn.getTime() - exp.occurredOn.getTime()) /
          (1000 * 60 * 60 * 24);
        const crossCur = inc.currency !== exp.currency;

        candidates.push({
          id: `match:${exp.transactionId}:${inc.transactionId}`,
          confidence: crossCur ? "ambiguous" : "ready_auto",
          fromAccountId: exp.accountId,
          toAccountId: inc.accountId,
          fromAccountName: exp.accountName,
          toAccountName: inc.accountName,
          outflow: exp,
          inflow: inc,
          amountMinor: exp.amountMinor,
          currency: exp.currency,
          evidence: {
            matchedIdentifier: source.matchedIdentifier,
            matchedRelationshipType: "known_account_identifier",
            dateDifferenceDays: Math.round(dateDiff * 10) / 10,
            crossCurrency: crossCur,
            uncertaintyReasons: crossCur ? ["CROSS_CURRENCY_UNCERTAINTY"] : [],
          },
        });
      } else if (matchingExpenses.length > 1) {
        pairedIncomeTxIds.add(inc.transactionId);
        candidates.push({
          id: `ambiguous:inc:${inc.transactionId}`,
          confidence: "ambiguous",
          fromAccountId: source.targetAccountId,
          toAccountId: inc.accountId,
          fromAccountName: sourceAcc?.name,
          toAccountName: inc.accountName,
          outflow: null,
          inflow: inc,
          amountMinor: inc.amountMinor,
          currency: inc.currency,
          evidence: {
            matchedIdentifier: source.matchedIdentifier,
            matchedRelationshipType: "known_account_identifier",
            dateDifferenceDays: 0,
            crossCurrency: false,
            uncertaintyReasons: ["MULTIPLE_COUNTERPARTS_FOUND"],
          },
        });
      } else {
        // One-sided pending inflow!
        pairedIncomeTxIds.add(inc.transactionId);
        candidates.push({
          id: `pending:inc:${inc.transactionId}`,
          confidence: "one_sided_pending",
          fromAccountId: source.targetAccountId,
          toAccountId: inc.accountId,
          fromAccountName: sourceAcc?.name,
          toAccountName: inc.accountName,
          outflow: null,
          inflow: inc,
          amountMinor: inc.amountMinor,
          currency: inc.currency,
          evidence: {
            matchedIdentifier: source.matchedIdentifier,
            matchedRelationshipType: "known_account_identifier",
            dateDifferenceDays: 0,
            crossCurrency: false,
            uncertaintyReasons: ["AWAITING_COUNTERPART_OUTFLOW"],
          },
        });
      }
    }
  }

  // 3. Third pass: Heuristic candidates based on same amount, same currency, close date between different household accounts
  // "similar amount/date alone is review-only."
  for (const exp of activeExpenses) {
    if (pairedExpenseTxIds.has(exp.transactionId)) continue;

    for (const inc of activeIncomes) {
      if (pairedIncomeTxIds.has(inc.transactionId)) continue;
      if (exp.accountId === inc.accountId) continue; // Same account is not transfer

      if (
        exp.currency === inc.currency &&
        exp.amountMinor === inc.amountMinor
      ) {
        const dateDiffDays =
          Math.abs(inc.occurredOn.getTime() - exp.occurredOn.getTime()) /
          (1000 * 60 * 60 * 24);

        if (dateDiffDays <= maxDateDiffDays) {
          // Heuristic match without confirmed identifier: ALWAYS review_only!
          candidates.push({
            id: `heuristic:${exp.transactionId}:${inc.transactionId}`,
            confidence: "review_only",
            fromAccountId: exp.accountId,
            toAccountId: inc.accountId,
            fromAccountName: exp.accountName,
            toAccountName: inc.accountName,
            outflow: exp,
            inflow: inc,
            amountMinor: exp.amountMinor,
            currency: exp.currency,
            evidence: {
              matchedRelationshipType: "amount_date_heuristic",
              dateDifferenceDays: Math.round(dateDiffDays * 10) / 10,
              crossCurrency: false,
              uncertaintyReasons: ["SIMILAR_AMOUNT_DATE_NO_IDENTIFIER"],
            },
          });
        }
      }
    }
  }

  return candidates;
}

/**
 * Validates whether a candidate can be safely executed as a transfer match.
 */
export function validateTransferMatch(candidate: TransferCandidate): {
  valid: boolean;
  error?: string;
} {
  if (!candidate.outflow || !candidate.inflow) {
    return {
      valid: false,
      error: "Cannot execute match: both outflow and inflow sides are required",
    };
  }

  if (candidate.fromAccountId === candidate.toAccountId) {
    return {
      valid: false,
      error: "Cannot match transfer between identical accounts",
    };
  }

  if (candidate.outflow.amountMinor <= 0n || candidate.inflow.amountMinor <= 0n) {
    return {
      valid: false,
      error: "Transfer amounts must be strictly positive",
    };
  }

  if (
    !candidate.evidence.crossCurrency &&
    candidate.outflow.amountMinor !== candidate.inflow.amountMinor
  ) {
    return {
      valid: false,
      error: "Transfer outflow and inflow amounts must match exactly",
    };
  }

  return { valid: true };
}
