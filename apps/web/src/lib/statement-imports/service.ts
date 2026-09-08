import "server-only";

import {
  AmbiguousImportRowCommitError,
  DuplicateImportRowError,
  ImportBatchAlreadyCommittedError,
  ImportBatchNotFoundError,
  commitStatementImportBatchInDb,
  createStatementImportBatchInDb,
  findAccountInHousehold,
  findExistingAuthoritativeRecordsInDb,
  findExistingFallbackRecordsInDb,
  findExistingImportDedupeHashes,
  findPossibleManualMatchesInDb,
  findStatementImportBatchById,
  listStatementImportBatchesByAccount,
  listStatementImportRowsByBatch,
  type ExistingAuthoritativeRecord,
  type ExistingFallbackRecord,
  type NewStatementImportRowRecord,
  type StatementImportBatchRow,
  type StatementImportRowRecord,
} from "@nodvis/finance-db";
import {
  computeFileSha256,
  decodeCsvBuffer,
  detectCsvDelimiter,
  detectCsvEncoding,
  getCurrencyFractionDigits,
  normalizeImportRow,
  parseCsvText,
  type CsvDelimiter,
  type CsvEncoding,
  type PossibleManualMatch,
  type RowPreviewItem,
  type StatementImportAmbiguityState,
  type StatementImportMappingConfig,
} from "@nodvis/finance-domain";

import type { AuthorizedHouseholdContext } from "@/lib/transactions/service";
import { TransactionAccountNotFoundError } from "@/lib/transactions/service";

export {
  AmbiguousImportRowCommitError,
  DuplicateImportRowError,
  ImportBatchAlreadyCommittedError,
  ImportBatchNotFoundError,
};

export class FileTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`File exceeds maximum allowed size of ${Math.round(maxBytes / 1024 / 1024)}MB`);
    this.name = "FileTooLargeError";
  }
}

export class EmptyCsvError extends Error {
  constructor(message: string = "CSV file is empty") {
    super(message);
    this.name = "EmptyCsvError";
  }
}

export type CsvInspectionResult = Readonly<{
  headers: string[];
  sampleRows: string[][];
  detectedDelimiter: CsvDelimiter;
  detectedEncoding: CsvEncoding;
  totalRowCount: number;
  fileHash: string;
}>;

export type StatementImportPreviewResult = Readonly<{
  batchId: string;
  sourceFilename: string;
  fileHash: string;
  totalRowCount: number;
  validRowCount: number;
  invalidRowCount: number;
  duplicateRowCount: number;
  rows: RowPreviewItem[];
}>;

export type CommitStatementImportResult = Readonly<{
  batchId: string;
  importedCount: number;
  skippedCount: number;
  committedTransactionIds: string[];
}>;

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB bounded upload limit
const MAX_ROWS = 5000;

function formatImportAmount(amountMinor: bigint, currency: string): string {
  const fractionDigits = getCurrencyFractionDigits(currency);
  const negative = amountMinor < 0n;
  const absolute = negative ? -amountMinor : amountMinor;
  const divisor = 10n ** BigInt(fractionDigits);
  const whole = absolute / divisor;
  const fraction = fractionDigits > 0
    ? (absolute % divisor).toString().padStart(fractionDigits, "0")
    : "";
  return `${negative ? "-" : ""}${whole.toString()}${fractionDigits > 0 ? `.${fraction}` : ""} ${currency}`;
}

export async function inspectCsvFile(params: {
  householdId: string;
  accountId: string;
  fileBytes: Uint8Array;
  encoding?: CsvEncoding;
  delimiter?: CsvDelimiter;
}): Promise<CsvInspectionResult> {
  const { householdId, accountId, fileBytes, encoding, delimiter } = params;

  if (fileBytes.length === 0) {
    throw new EmptyCsvError();
  }

  if (fileBytes.length > MAX_FILE_BYTES) {
    throw new FileTooLargeError(MAX_FILE_BYTES);
  }

  const account = await findAccountInHousehold(householdId, accountId);
  if (!account) {
    throw new TransactionAccountNotFoundError(
      `Account ${accountId} not found in household`,
    );
  }

  const detectedEncoding = encoding ?? detectCsvEncoding(fileBytes);
  const text = decodeCsvBuffer(fileBytes, detectedEncoding);
  const detectedDelimiter = delimiter ?? detectCsvDelimiter(text);

  const parsed = parseCsvText(text, { delimiter: detectedDelimiter, maxRows: MAX_ROWS });
  if (parsed.length === 0) {
    throw new EmptyCsvError();
  }

  const fileHash = computeFileSha256(fileBytes);
  const headers = parsed[0] ?? [];
  const sampleRows = parsed.slice(1, 4);

  return {
    headers,
    sampleRows,
    detectedDelimiter,
    detectedEncoding,
    totalRowCount: parsed.length - 1,
    fileHash,
  };
}

export async function parseAndPreviewStatementImport(params: {
  context: AuthorizedHouseholdContext;
  accountId: string;
  sourceFilename: string;
  fileBytes: Uint8Array;
  mapping: StatementImportMappingConfig;
}): Promise<StatementImportPreviewResult> {
  const { context, accountId, sourceFilename, fileBytes, mapping } = params;

  if (fileBytes.length === 0) {
    throw new EmptyCsvError();
  }

  if (fileBytes.length > MAX_FILE_BYTES) {
    throw new FileTooLargeError(MAX_FILE_BYTES);
  }

  const account = await findAccountInHousehold(context.householdId, accountId);
  if (!account) {
    throw new TransactionAccountNotFoundError(
      `Account ${accountId} not found in household`,
    );
  }

  const fileHash = computeFileSha256(fileBytes);
  const decodedText = decodeCsvBuffer(fileBytes);
  const rawRows = parseCsvText(decodedText, {
    delimiter: mapping.delimiter,
    maxRows: MAX_ROWS,
  });

  if (rawRows.length === 0) {
    throw new EmptyCsvError();
  }

  const headerIdx = mapping.hasHeader ? mapping.headerRowIndex : -1;
  const headers: string[] =
    headerIdx >= 0 && headerIdx < rawRows.length
      ? rawRows[headerIdx]!
      : (rawRows[0]?.map((_, i) => `Col ${i + 1}`) ?? []);

  const dataStartIndex = Math.max(
    mapping.hasHeader ? headerIdx + 1 : 0,
    mapping.skipLeadingRows,
  );

  const dataRows = rawRows.slice(dataStartIndex);
  if (dataRows.length === 0) {
    throw new EmptyCsvError("No data rows found in CSV after header/skip rows");
  }

  const occurrenceCounter = new Map<string, number>();
  const parsedRows = dataRows.map((rawCells, idx) =>
    normalizeImportRow({
      rowIndex: idx,
      rawCells,
      headers,
      mapping,
      targetAccountCurrency: account.currency,
      accountId,
      fileHash,
      occurrenceCounter,
    }),
  );

  const sourceNamespace = mapping.sourceNamespace?.trim() || "generic_csv";
  const sourceAccountId = mapping.sourceAccountId?.trim() || null;

  // 1. Authoritative IDs lookup
  const authIds = parsedRows
    .filter((r) => r.valid && r.normalized?.authoritativeId)
    .map((r) => r.normalized!.authoritativeId!);

  const authoritativeRecords: Map<string, ExistingAuthoritativeRecord> =
    authIds.length > 0
      ? await findExistingAuthoritativeRecordsInDb({
          householdId: context.householdId,
          accountId,
          sourceNamespace,
          sourceAccountId,
          authoritativeIds: authIds,
        })
      : new Map();

  // 2. Fallback Identifiers lookup
  const fallbackIds = parsedRows
    .filter((r) => r.valid && r.normalized?.fallbackIdentifier)
    .map((r) => r.normalized!.fallbackIdentifier);

  const fallbackRecords: Map<string, ExistingFallbackRecord[]> =
    fallbackIds.length > 0
      ? await findExistingFallbackRecordsInDb({
          householdId: context.householdId,
          accountId,
          fallbackIdentifiers: fallbackIds,
        })
      : new Map();

  // 3. Check DB for existing dedupe hashes for this account (backward compatibility & defense-in-depth)
  const validDedupeHashes = parsedRows
    .filter((r) => r.valid && r.normalized?.dedupeHash)
    .map((r) => r.normalized!.dedupeHash);

  const existingHashes = await findExistingImportDedupeHashes(
    accountId,
    validDedupeHashes,
  );

  // 4. Query possible manual matches
  const matchCandidates = parsedRows
    .filter((r) => r.valid && r.normalized)
    .map((r) => ({
      rowIndex: r.rowIndex,
      occurredOn: r.normalized!.occurredOn,
      amountMinor: r.normalized!.amountMinor,
      currency: r.normalized!.currency,
      kind: r.normalized!.kind,
    }));

  const possibleMatches = await findPossibleManualMatchesInDb({
    householdId: context.householdId,
    accountId,
    candidates: matchCandidates,
  });

  // Track counts
  let validRowCount = 0;
  let invalidRowCount = 0;
  let duplicateRowCount = 0;

  const dbRowsToInsert: NewStatementImportRowRecord[] = [];
  const previewItems: RowPreviewItem[] = [];
  const seenAuthoritativeInFile = new Set<string>();

  for (const pr of parsedRows) {
    const norm = pr.normalized;
    let status = pr.status;
    let errorCode = pr.errorCode;
    let errorMessage = pr.errorMessage;
    let ambiguityState: StatementImportAmbiguityState = "unambiguous";
    let canonicalTransactionId: string | null = null;
    let matchedImportRowId: string | null = null;
    const possibleMatch = possibleMatches.get(pr.rowIndex) ?? null;

    if (pr.valid && norm) {
      if (norm.identityType === "authoritative" && norm.authoritativeId) {
        const existingAuth = authoritativeRecords.get(norm.authoritativeId);
        if (existingAuth) {
          canonicalTransactionId = existingAuth.transaction.id;
          matchedImportRowId = existingAuth.importRow?.id ?? null;
          if (existingAuth.transaction.voidedAt !== null) {
            ambiguityState = "ambiguous";
            errorCode = "MATCHES_VOIDED_TRANSACTION";
            errorMessage = "Matches a voided transaction in this account";
          } else {
            status = "duplicate";
            errorCode = "AUTHORITATIVE_DUPLICATE";
            errorMessage = "Authoritative transaction already imported for this account";
          }
        } else if (seenAuthoritativeInFile.has(norm.authoritativeId)) {
          status = "duplicate";
          errorCode = "DUPLICATE_AUTHORITATIVE_ID_IN_FILE";
          errorMessage = "Duplicate authoritative transaction ID within this file";
        } else {
          seenAuthoritativeInFile.add(norm.authoritativeId);
        }
      } else {
        const existingFallbackList = fallbackRecords.get(norm.fallbackIdentifier) ?? [];
        const activeDbOccurrences = existingFallbackList.filter((r) => !r.voidedAt);
        const voidedDbOccurrences = existingFallbackList.filter((r) => r.voidedAt !== null);

        if (norm.occurrenceIndex < activeDbOccurrences.length) {
          const matched = activeDbOccurrences[norm.occurrenceIndex]!;
          status = "duplicate";
          errorCode = "FALLBACK_DUPLICATE";
          errorMessage = "Already imported for this account (fallback match)";
          canonicalTransactionId = matched.canonicalTransactionId;
          matchedImportRowId = matched.importRowId;
        } else if (existingHashes.has(norm.dedupeHash)) {
          status = "duplicate";
          errorCode = "DUPLICATE_ROW";
          errorMessage = "Already imported for this account";
        } else if (voidedDbOccurrences.length > 0) {
          ambiguityState = "ambiguous";
          errorCode = "MATCHES_VOIDED_TRANSACTION";
          errorMessage = "Matches a voided transaction with identical details in this account";
        }
      }

      if (status !== "duplicate" && possibleMatch) {
        ambiguityState = "ambiguous";
      }

      if (status === "duplicate") {
        duplicateRowCount++;
      } else {
        validRowCount++;
      }
    } else {
      invalidRowCount++;
    }

    const isDuplicate = status === "duplicate";
    const dedupeHash = norm?.dedupeHash ?? computeFileSha256(`${fileHash}:${pr.rowIndex}`);
    const sourceRowIdentity =
      norm?.sourceRowIdentity ?? `${fileHash.slice(0, 16)}:${pr.rowIndex}`;

    dbRowsToInsert.push({
      batchId: "" as unknown as string,
      householdId: context.householdId,
      accountId,
      rowIndex: pr.rowIndex,
      sourceNamespace: norm?.sourceNamespace ?? sourceNamespace,
      sourceAccountId: norm?.sourceAccountId ?? (sourceAccountId || null),
      authoritativeId: norm?.authoritativeId ?? null,
      fallbackIdentifier: norm?.fallbackIdentifier ?? null,
      fallbackEvidence: norm?.fallbackEvidence ?? null,
      occurrenceIndex: norm?.occurrenceIndex ?? 0,
      identityType: norm?.identityType ?? "fallback",
      ambiguityState,
      canonicalTransactionId,
      matchedImportRowId,
      sourceRowIdentity,
      dedupeHash,
      status,
      errorCode: errorCode ?? null,
      errorMessage: errorMessage ?? null,
      rawRowContent: pr.rawRowContent,
      rawValues: pr.rawValues,
      normalizedOccurredOn: norm?.occurredOn ?? null,
      normalizedKind: norm?.kind ?? null,
      normalizedAmountMinor: norm?.amountMinor ?? null,
      normalizedCurrency: norm?.currency ?? null,
      normalizedPayee: norm?.payee ?? null,
      normalizedSource: norm?.source ?? null,
      normalizedDescription: norm?.description ?? null,
    });

    const isSelected = pr.valid && !isDuplicate && ambiguityState !== "ambiguous" && !possibleMatch;

    previewItems.push({
      rowIndex: pr.rowIndex,
      valid: pr.valid && !isDuplicate,
      status,
      errorCode,
      errorMessage,
      date: norm ? norm.occurredOn.toISOString() : null,
      kind: norm ? norm.kind : null,
      amountMinor: norm ? norm.amountMinor.toString() : null,
      currency: norm ? norm.currency : null,
      formattedAmount: norm
        ? formatImportAmount(norm.amountMinor, norm.currency)
        : null,
      description: norm ? norm.description : null,
      rawRowContent: pr.rawRowContent,
      dedupeHash,
      sourceRowIdentity,
      sourceNamespace: norm?.sourceNamespace ?? sourceNamespace,
      sourceAccountId: norm?.sourceAccountId ?? (sourceAccountId || null),
      authoritativeId: norm?.authoritativeId ?? null,
      identityType: norm?.identityType ?? "fallback",
      fallbackIdentifier: norm?.fallbackIdentifier ?? undefined,
      occurrenceIndex: norm?.occurrenceIndex ?? undefined,
      ambiguityState,
      canonicalTransactionId,
      matchedImportRowId,
      possibleMatch,
      selected: isSelected,
    });
  }

  // Create batch in DB with status "preview"
  const { batchId } = await createStatementImportBatchInDb({
    batch: {
      householdId: context.householdId,
      accountId,
      sourceFilename,
      fileHash,
      fileSizeBytes: fileBytes.length,
      parserVersion: "1.0.0",
      sourceNamespace,
      sourceAccountId: sourceAccountId || null,
      mappingConfig: mapping,
      status: "preview",
      totalRowCount: parsedRows.length,
      validRowCount,
      invalidRowCount,
      importedRowCount: 0,
      skippedRowCount: 0,
      createdByAuthUserId: context.authUserId,
    },
    rows: dbRowsToInsert,
  });

  return {
    batchId,
    sourceFilename,
    fileHash,
    totalRowCount: parsedRows.length,
    validRowCount,
    invalidRowCount,
    duplicateRowCount,
    rows: previewItems,
  };
}

export async function commitStatementImport(params: {
  context: AuthorizedHouseholdContext;
  accountId: string;
  batchId: string;
  selectedRowIndices: number[];
}): Promise<CommitStatementImportResult> {
  const { context, accountId, batchId, selectedRowIndices } = params;

  const account = await findAccountInHousehold(context.householdId, accountId);
  if (!account) {
    throw new TransactionAccountNotFoundError(
      `Account ${accountId} not found in household`,
    );
  }

  return await commitStatementImportBatchInDb({
    householdId: context.householdId,
    batchId,
    accountId,
    selectedRowIndices,
    authUserId: context.authUserId,
    personId: context.personId,
  });
}

export async function getStatementImportBatchDetails(params: {
  context: AuthorizedHouseholdContext;
  batchId: string;
}): Promise<{
  batch: StatementImportBatchRow;
  rows: StatementImportRowRecord[];
}> {
  const batch = await findStatementImportBatchById(
    params.context.householdId,
    params.batchId,
  );
  if (!batch) {
    throw new ImportBatchNotFoundError(
      `Import batch ${params.batchId} not found in household`,
    );
  }

  const rows = await listStatementImportRowsByBatch(
    params.context.householdId,
    params.batchId,
  );

  return { batch, rows };
}

export async function listStatementImportBatchesForAccount(params: {
  context: AuthorizedHouseholdContext;
  accountId: string;
}): Promise<StatementImportBatchRow[]> {
  const account = await findAccountInHousehold(
    params.context.householdId,
    params.accountId,
  );
  if (!account) {
    throw new TransactionAccountNotFoundError(
      `Account ${params.accountId} not found in household`,
    );
  }

  return await listStatementImportBatchesByAccount(
    params.context.householdId,
    params.accountId,
  );
}
