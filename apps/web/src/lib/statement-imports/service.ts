import "server-only";

import {
  AmbiguousImportRowCommitError,
  DuplicateImportRowError,
  DuplicateStatementImportProfileNameError,
  StatementImportProfileScopeConflictError,
  ImportBatchAlreadyCommittedError,
  ImportBatchNotFoundError,
  StatementImportProfileNotFoundError,
  commitStatementImportBatchInDb,
  createStatementImportBatchInDb,
  createStatementImportProfileInDb,
  deleteStatementImportProfileInDb,
  findAccountInHousehold,
  findExistingAuthoritativeRecordsInDb,
  findExistingFallbackRecordsInDb,
  findExistingImportDedupeHashes,
  findPossibleManualMatchesInDb,
  findStatementImportBatchById,
  findStatementImportProfileById,
  listStatementImportBatchesByAccount,
  listStatementImportProfilesByHousehold,
  listStatementImportRowsByBatch,
  updateStatementImportProfileInDb,
  type ExistingAuthoritativeRecord,
  type ExistingFallbackRecord,
  type NewStatementImportRowRecord,
  type StatementImportBatchRow,
  type StatementImportProfileRow,
  type StatementImportRowRecord,
} from "@nodvis/finance-db";
import {
  computeFileSha256,
  decodeCsvBuffer,
  detectCsvDelimiter,
  detectCsvEncoding,
  discoverCsvHeader,
  computeCsvHeaderSignature,
  encodeImportIdentityParts,
  ensureUniqueCsvHeaders,
  getCurrencyFractionDigits,
  normalizeImportRow,
  parseCsvText,
  parseImportAmount,
  parseImportDate,
  validateStatementImportProfileInput,
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
  DuplicateStatementImportProfileNameError,
  StatementImportProfileScopeConflictError,
  ImportBatchAlreadyCommittedError,
  ImportBatchNotFoundError,
  StatementImportProfileNotFoundError,
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

export class ImportMappingValidationError extends Error {
  readonly code = "IMPORT_MAPPING_INVALID";
  constructor(message = "CSV mapping is incomplete or does not match sample values") {
    super(message);
    this.name = "ImportMappingValidationError";
  }
}

export type CsvInspectionResult = Readonly<{
  headers: string[];
  sampleRows: string[][];
  detectedDelimiter: CsvDelimiter;
  detectedEncoding: CsvEncoding;
  totalRowCount: number;
  fileHash: string;
  headerRowIndex: number;
  headerSignature: string;
  suggestedMapping: Record<string, unknown>;
  mappingConfidence: "high" | "medium" | "low";
}>;

export type StatementImportPreviewResult = Readonly<{
  batchId: string;
  sourceFilename: string;
  fileHash: string;
  totalRowCount: number;
  validRowCount: number;
  invalidRowCount: number;
  duplicateRowCount: number;
  safeToCommitCount: number;
  attentionRowCount: number;
  rows: RowPreviewItem[];
  autoCommitted?: CommitStatementImportResult | undefined;
}>;

export type CommitStatementImportResult = Readonly<{
  batchId: string;
  importedCount: number;
  skippedCount: number;
  committedTransactionIds: string[];
}>;

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB bounded upload limit
const MAX_ROWS = 5000;

function normalizeSourceAccountId(sourceAccountId: string | null | undefined): string | null {
  return sourceAccountId?.trim() || null;
}

function normalizeSourceNamespace(sourceNamespace: string | null | undefined): string {
  return sourceNamespace?.trim() || "";
}

function dedupScopeKey(sourceNamespace: string | null | undefined, sourceAccountId: string | null | undefined, identity: string): string {
  return encodeImportIdentityParts([
    normalizeSourceNamespace(sourceNamespace),
    normalizeSourceAccountId(sourceAccountId) ?? "",
    identity,
  ]);
}

function isLegacyCompatibleScope(sourceNamespace: string, sourceAccountId: string | null): boolean {
  return sourceNamespace === "generic_csv" && sourceAccountId === null;
}

export function formatImportAmount(amountMinor: bigint, currency: string, locale = "en-US"): string {
  const fractionDigits = getCurrencyFractionDigits(currency);
  const negative = amountMinor < 0n;
  const absolute = negative ? -amountMinor : amountMinor;
  const divisor = 10n ** BigInt(fractionDigits);
  const whole = absolute / divisor;
  const fraction = fractionDigits > 0
    ? (absolute % divisor).toString().padStart(fractionDigits, "0")
    : "";
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  const subUnitNegative = negative && whole === 0n;
  const parts = formatter.formatToParts(subUnitNegative ? -1n : negative ? -whole : whole);
  return parts
    .map((part) => {
      if (part.type === "fraction") return fraction;
      if (subUnitNegative && part.type === "integer") return "0";
      return part.value;
    })
    .join("");
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
  const discovery = discoverCsvHeader(text, detectedDelimiter);
  const headers = discovery.headers;
  const sampleRows = parsed.slice(discovery.headerRowIndex + 1, discovery.headerRowIndex + 4);

  return {
    headers,
    sampleRows,
    detectedDelimiter,
    detectedEncoding,
    totalRowCount: Math.max(0, parsed.length - discovery.headerRowIndex - 1),
    fileHash,
    headerRowIndex: discovery.headerRowIndex,
    headerSignature: discovery.headerSignature,
    suggestedMapping: discovery.suggestedMapping,
    mappingConfidence: discovery.confidence,
  };
}

export async function parseAndPreviewStatementImport(params: {
  context: AuthorizedHouseholdContext;
  accountId: string;
  sourceFilename: string;
  fileBytes: Uint8Array;
  mapping: StatementImportMappingConfig;
  autoCommitSafe?: boolean;
  locale?: string;
}): Promise<StatementImportPreviewResult> {
  const { context, accountId, sourceFilename, fileBytes, mapping, autoCommitSafe, locale = "en-US" } = params;

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
  const decodedText = decodeCsvBuffer(fileBytes, mapping.encoding);
  const rawRows = parseCsvText(decodedText, {
    delimiter: mapping.delimiter,
    maxRows: MAX_ROWS,
  });

  if (rawRows.length === 0) {
    throw new EmptyCsvError();
  }

  const headerIdx = mapping.hasHeader ? mapping.headerRowIndex : -1;
  const headers: string[] = ensureUniqueCsvHeaders(
    headerIdx >= 0 && headerIdx < rawRows.length
      ? rawRows[headerIdx]!
      : (rawRows[0]?.map((_, i) => `Col ${i + 1}`) ?? []),
  );

  if (!mapping.dateColumn || !mapping.descriptionColumn || (mapping.amountMode === "signed" ? !mapping.amountColumn : !mapping.debitColumn && !mapping.creditColumn)) {
    throw new ImportMappingValidationError("Required date, amount, and description mappings are missing");
  }
  if (mapping.headerSignature && mapping.headerSignature !== computeCsvHeaderSignature(headers, mapping.delimiter)) {
    throw new ImportMappingValidationError("Saved mapping does not match this CSV layout");
  }
  const columnIndex = (column: string | undefined) => column ? headers.indexOf(column) : -1;
  const samples = rawRows.slice(Math.max(headerIdx + 1, mapping.skipLeadingRows), Math.max(headerIdx + 1, mapping.skipLeadingRows) + 3);
  const dateSamples = samples
    .map((row) => {
      const primary = mapping.dateColumn ? row[columnIndex(mapping.dateColumn)] ?? "" : "";
      return primary || (mapping.dateFallbackColumn ? row[columnIndex(mapping.dateFallbackColumn)] ?? "" : "");
    })
    .filter(Boolean);
  const amountColumns = mapping.amountMode === "signed" ? [mapping.amountColumn] : [mapping.debitColumn, mapping.creditColumn];
  const amountSamples = samples.flatMap((row) => amountColumns.map((column) => row[columnIndex(column)] ?? "")).filter(Boolean);
  if (!dateSamples.length || !dateSamples.some((value) => parseImportDate(value, mapping.dateFormat).success) || !amountSamples.length || !amountSamples.some((value) => parseImportAmount(value, account.currency).success)) {
    throw new ImportMappingValidationError("Mapped date or amount columns do not match sample values");
  }

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
  const sourceAccountIds = [...new Set([sourceAccountId, ...parsedRows.map((row) => row.normalized?.sourceAccountId)].filter((value): value is string => Boolean(value)))];

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
          sourceAccountIds,
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
          sourceNamespace,
          sourceAccountIds,
        })
      : new Map();

  // 3. Check DB for existing dedupe hashes for this account (backward compatibility & defense-in-depth)
  const validDedupeHashes = parsedRows
    .filter((r) => r.valid && r.normalized?.dedupeHash)
    .map((r) => r.normalized!.dedupeHash);

  const existingHashes = await findExistingImportDedupeHashes(
    accountId,
    validDedupeHashes,
    { sourceNamespace, sourceAccountIds },
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
  let safeToCommitCount = 0;
  let attentionRowCount = 0;

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
        const normalizedSourceAccountId = normalizeSourceAccountId(norm.sourceAccountId);
        const authoritativeKey = dedupScopeKey(norm.sourceNamespace, norm.sourceAccountId, norm.authoritativeId);
        const scopedAuth = authoritativeRecords.get(authoritativeKey);
        const legacyAuth = authoritativeRecords.get(dedupScopeKey("", null, norm.authoritativeId));
        const legacyIsCrossScope = Boolean(legacyAuth && !isLegacyCompatibleScope(norm.sourceNamespace, normalizedSourceAccountId));
        const existingAuth = legacyIsCrossScope ? undefined : (scopedAuth ?? legacyAuth);
        const authoritativeMatchIsAmbiguous = Boolean(
          scopedAuth?.ambiguityState === "ambiguous"
          || legacyAuth?.ambiguityState === "ambiguous"
          || (scopedAuth && legacyAuth)
          || legacyIsCrossScope,
        );
        if (authoritativeMatchIsAmbiguous) {
          ambiguityState = "ambiguous";
          errorCode = "AMBIGUOUS_AUTHORITATIVE_MATCH";
          errorMessage = "Multiple existing transactions match this authoritative ID; review required";
        } else if (existingAuth) {
          if (existingAuth.transaction.voidedAt !== null) {
            canonicalTransactionId = existingAuth.transaction.id;
            matchedImportRowId = existingAuth.importRow?.id ?? null;
            ambiguityState = "ambiguous";
            errorCode = "MATCHES_VOIDED_TRANSACTION";
            errorMessage = "Matches a voided transaction in this account";
          } else {
            canonicalTransactionId = existingAuth.transaction.id;
            matchedImportRowId = existingAuth.importRow?.id ?? null;
            status = "duplicate";
            errorCode = "AUTHORITATIVE_DUPLICATE";
            errorMessage = "Authoritative transaction already imported for this account";
          }
        } else if (seenAuthoritativeInFile.has(authoritativeKey)) {
          status = "duplicate";
          errorCode = "DUPLICATE_AUTHORITATIVE_ID_IN_FILE";
          errorMessage = "Duplicate authoritative transaction ID within this file";
        } else {
          seenAuthoritativeInFile.add(authoritativeKey);
        }
      } else {
        const scopeKey = dedupScopeKey(norm.sourceNamespace, norm.sourceAccountId, norm.fallbackIdentifier);
        const legacyFallbackList = fallbackRecords.get(dedupScopeKey("", null, norm.fallbackIdentifier)) ?? [];
        const crossScopeLegacyFallbackList = !isLegacyCompatibleScope(norm.sourceNamespace, normalizeSourceAccountId(norm.sourceAccountId))
          ? legacyFallbackList
          : [];
        const existingFallbackList = [
          ...(fallbackRecords.get(scopeKey) ?? []),
          ...(isLegacyCompatibleScope(norm.sourceNamespace, normalizeSourceAccountId(norm.sourceAccountId)) ? legacyFallbackList : []),
        ].filter((record, index, records) =>
          records.findIndex((candidate) => candidate.importRowId === record.importRowId) === index,
        );
        const activeDbOccurrences = existingFallbackList.filter((r) => !r.voidedAt);
        const voidedDbOccurrences = existingFallbackList.filter((r) => r.voidedAt !== null);
        const matchingActiveOccurrences = activeDbOccurrences.filter((r) => r.occurrenceIndex === norm.occurrenceIndex);
        const matched = matchingActiveOccurrences[0];

        if (crossScopeLegacyFallbackList.length > 0) {
          ambiguityState = "ambiguous";
          errorCode = "AMBIGUOUS_FALLBACK_MATCH";
          errorMessage = "An existing legacy import cannot be safely scoped; review required";
        } else if (matchingActiveOccurrences.length > 1) {
          ambiguityState = "ambiguous";
          errorCode = "AMBIGUOUS_FALLBACK_MATCH";
          errorMessage = "Multiple existing transactions match this fallback row; review required";
        } else if (matched) {
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
    if (isSelected) safeToCommitCount++;
    if (pr.valid && !isSelected && !isDuplicate) attentionRowCount++;

    previewItems.push({
      rowIndex: pr.rowIndex,
      valid: pr.valid && !isDuplicate,
      status,
      errorCode,
      errorMessage: undefined,
      date: norm ? norm.occurredOn.toISOString() : null,
      kind: norm ? norm.kind : null,
      amountMinor: norm ? norm.amountMinor.toString() : null,
      currency: norm ? norm.currency : null,
      formattedAmount: norm
        ? formatImportAmount(norm.amountMinor, norm.currency, locale)
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

  let autoCommitted: CommitStatementImportResult | undefined;
  if (autoCommitSafe && safeToCommitCount > 0) {
    autoCommitted = await commitStatementImportBatchInDb({
      householdId: context.householdId,
      batchId,
      accountId,
      safeOnly: true,
      authUserId: context.authUserId,
      personId: context.personId,
    });
  }

  return {
    batchId,
    sourceFilename,
    fileHash,
    totalRowCount: parsedRows.length,
    validRowCount,
    invalidRowCount,
    duplicateRowCount,
    safeToCommitCount,
    attentionRowCount,
    rows: previewItems,
    autoCommitted,
  };
}

export async function commitStatementImport(params: {
  context: AuthorizedHouseholdContext;
  accountId: string;
  batchId: string;
  selectedRowIndices?: number[] | undefined;
  safeOnly?: boolean | undefined;
}): Promise<CommitStatementImportResult> {
  const { context, accountId, batchId, selectedRowIndices, safeOnly } = params;

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
    safeOnly,
    authUserId: context.authUserId,
    personId: context.personId,
  });
}

export async function getStatementImportBatchDetails(params: {
  context: AuthorizedHouseholdContext;
  batchId: string;
  accountId: string;
}): Promise<{
  batch: StatementImportBatchRow;
  rows: StatementImportRowRecord[];
}> {
  const batch = await findStatementImportBatchById(
    params.context.householdId,
    params.batchId,
    params.accountId,
  );
  if (!batch) {
    throw new ImportBatchNotFoundError(
      `Import batch ${params.batchId} not found in household`,
    );
  }

  const rows = await listStatementImportRowsByBatch(
    params.context.householdId,
    params.batchId,
    params.accountId,
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

export type StatementImportProfileDto = Readonly<{
  id: string;
  householdId: string;
  accountId: string | null;
  name: string;
  mappingConfig: StatementImportMappingConfig;
  autoProcessSafe: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}>;

function mapProfileRowToDto(
  row: StatementImportProfileRow,
): StatementImportProfileDto {
  return {
    id: row.id,
    householdId: row.householdId,
    accountId: row.accountId,
    name: row.name,
    mappingConfig: row.mappingConfig,
    autoProcessSafe: row.autoProcessSafe,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createImportProfile(params: {
  context: AuthorizedHouseholdContext;
  name: string;
  mappingConfig: StatementImportMappingConfig;
  autoProcessSafe?: boolean;
  isDefault?: boolean;
  accountId?: string | null;
}): Promise<StatementImportProfileDto> {
  const { context, name, mappingConfig, autoProcessSafe, isDefault, accountId } =
    params;

  const profileValidation = validateStatementImportProfileInput({ name, mappingConfig });
  if (!profileValidation.valid) {
    throw new ImportMappingValidationError(profileValidation.errors.join("; "));
  }

  if (accountId) {
    const account = await findAccountInHousehold(context.householdId, accountId);
    if (!account) {
      throw new TransactionAccountNotFoundError(
        `Account ${accountId} not found in household`,
      );
    }
  }

  const row = await createStatementImportProfileInDb({
    profile: {
      householdId: context.householdId,
      accountId: accountId ?? null,
      name: name.trim(),
      mappingConfig,
      autoProcessSafe: autoProcessSafe ?? false,
      isDefault: isDefault ?? false,
    },
  });

  return mapProfileRowToDto(row);
}

export async function listImportProfiles(params: {
  context: AuthorizedHouseholdContext;
  accountId?: string | null;
}): Promise<StatementImportProfileDto[]> {
  const { context, accountId } = params;
  if (accountId) {
    const account = await findAccountInHousehold(context.householdId, accountId);
    if (!account) {
      throw new TransactionAccountNotFoundError(
        `Account ${accountId} not found in household`,
      );
    }
  }

  const rows = await listStatementImportProfilesByHousehold(
    context.householdId,
    accountId,
  );
  return rows.map(mapProfileRowToDto);
}

export async function getImportProfile(params: {
  context: AuthorizedHouseholdContext;
  profileId: string;
  accountId?: string;
}): Promise<StatementImportProfileDto> {
  const row = await findStatementImportProfileById(
    params.context.householdId,
    params.profileId,
    params.accountId,
  );
  if (!row) {
    throw new StatementImportProfileNotFoundError();
  }
  return mapProfileRowToDto(row);
}

export async function updateImportProfile(params: {
  context: AuthorizedHouseholdContext;
  profileId: string;
  routeAccountId?: string;
  name?: string | undefined;
  mappingConfig?: StatementImportMappingConfig | undefined;
  autoProcessSafe?: boolean | undefined;
  isDefault?: boolean | undefined;
  accountId?: string | null | undefined;
}): Promise<StatementImportProfileDto> {
  const {
    context,
    profileId,
    routeAccountId,
    name,
    mappingConfig,
    autoProcessSafe,
    isDefault,
    accountId,
  } = params;

  if (mappingConfig) {
    const profileValidation = validateStatementImportProfileInput({
      name: name ?? "Existing profile",
      mappingConfig,
    });
    if (!profileValidation.valid) {
      throw new ImportMappingValidationError(profileValidation.errors.join("; "));
    }
  }

  if (accountId) {
    const account = await findAccountInHousehold(context.householdId, accountId);
    if (!account) {
      throw new TransactionAccountNotFoundError(
        `Account ${accountId} not found in household`,
      );
    }
  }

  const row = await updateStatementImportProfileInDb({
    householdId: context.householdId,
    profileId,
    ...(routeAccountId ? { routeAccountId } : {}),
    name,
    mappingConfig,
    autoProcessSafe,
    isDefault,
    accountId,
  });

  return mapProfileRowToDto(row);
}

export async function deleteImportProfile(params: {
  context: AuthorizedHouseholdContext;
  profileId: string;
  accountId?: string;
}): Promise<boolean> {
  const deleted = await deleteStatementImportProfileInDb(
    params.context.householdId,
    params.profileId,
    params.accountId,
  );
  if (!deleted) {
    throw new StatementImportProfileNotFoundError();
  }
  return true;
}
