export { closeDb, getDb } from "./client";
export {
  createHouseholdOnboarding,
  findDefaultHouseholdForAuthUser,
  findHouseholdAccessForAuthUser,
  findHouseholdForAuthUser,
  isPersonInHousehold,
  listHouseholdMembers,
  listHouseholdsForAuthUser,
} from "./access/household";
export type {
  CreateHouseholdOnboardingInput,
  HouseholdAccessSummary,
  HouseholdMemberSummary,
} from "./access/household";
export {
  AccountInvalidOwnerError,
  AccountNotFoundError,
  archiveHouseholdAccount,
  createHouseholdAccount,
  findAccountInHousehold,
  listAccountsByHousehold,
  unarchiveHouseholdAccount,
  updateHouseholdAccountMetadata,
} from "./access/accounts";
export type {
  CreateHouseholdAccountInput,
  HouseholdAccountSummary,
  UpdateHouseholdAccountMetadataInput,
} from "./access/accounts";
export {
  DuplicateSubmissionError,
  TransactionAlreadyVoidedError,
  TransactionNotFoundError,
  TransactionVersionConflictError,
  buildTransactionConditions,
  countTransactionsByHousehold,
  findTransactionById,
  insertTransaction,
  listTransactionAuditEntries,
  listTransactionsByHousehold,
  mapRowToTransaction,
  queryTransactionsByHousehold,
  updateTransactionInDb,
  voidTransactionInDb,
} from "./access/transactions";
export type {
  ListTransactionsParams,
  NewTransactionAuditRow,
  NewTransactionRow,
  TransactionAuditActor,
  TransactionAuditRow,
  TransactionRow,
} from "./access/transactions";

export {
  CategoryNotFoundError,
  archiveHouseholdCategory,
  createHouseholdCategory,
  findCategoryInHousehold,
  listCategoriesByHousehold,
  renameHouseholdCategory,
  seedDefaultCategories,
  unarchiveHouseholdCategory,
} from "./access/categories";
export type {
  CreateHouseholdCategoryInput,
  HouseholdCategorySummary,
  ListCategoriesOptions,
} from "./access/categories";
export {
  getHouseholdEligibleAccounts,
  getHouseholdPeriodCashFlow,
  getHouseholdPeriodCategorySpending,
} from "./access/overview";
export type {
  DbAssetAccountRow,
  DbCategorySpendingRow,
  DbPeriodCashFlowRow,
} from "./access/overview";
export {
  AmbiguousImportRowCommitError,
  DuplicateImportRowError,
  ImportBatchAlreadyCommittedError,
  ImportBatchNotFoundError,
  commitStatementImportBatchInDb,
  createStatementImportBatchInDb,
  findExistingAuthoritativeRecordsInDb,
  findExistingFallbackRecordsInDb,
  findExistingImportDedupeHashes,
  findPossibleManualMatchesInDb,
  findStatementImportBatchById,
  listStatementImportBatchesByAccount,
  listStatementImportRowsByBatch,
} from "./access/statement-imports";
export type {
  ExistingAuthoritativeRecord,
  ExistingFallbackRecord,
  NewStatementImportBatchRow,
  NewStatementImportRowRecord,
  StatementImportBatchRow,
  StatementImportRowRecord,
} from "./access/statement-imports";

export {
  AccountIdentifierNotFoundError,
  DuplicateAccountIdentifierError,
  InvalidAccountIdentifierError,
  addAccountIdentifier,
  deleteAccountIdentifier,
  findAccountIdentifierById,
  listAccountIdentifiersByHousehold,
  mapAccountIdentifierRow,
} from "./access/account-identifiers";
export type {
  AccountIdentifierRecord,
  AddAccountIdentifierInput,
} from "./access/account-identifiers";

export {
  InvalidTransferMatchError,
  executeTransferMatch,
  listTransferMatchesByHousehold,
} from "./access/transfer-matching";
export type {
  ExecuteTransferMatchParams,
  TransferMatchRecord,
} from "./access/transfer-matching";

export * from "./schema/index";
