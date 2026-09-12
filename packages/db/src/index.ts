export { closeDb, getDb } from "./client";
export {
  listBalanceObservationsForSubject,
  listHouseholdBalanceObservations,
  listLatestBalanceObservations,
  recordAccountBalanceObservation,
  recordLiabilityBalanceObservation,
} from "./access/balance-observations";
export type {
  BalanceObservationRecord,
  BalanceObservationSource,
} from "./access/balance-observations";
export {
  InstanceAlreadyInitializedError,
  isInstanceInitialized,
} from "./access/instance";
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
  archiveCreditFacility,
  CreditFacilityAccountError,
  CreditFacilityNotFoundError,
  createCreditFacility,
  findCreditFacilityForAccount,
  listCreditFacilitiesByHousehold,
  serializeCreditFacility,
  updateCreditFacility,
} from "./access/credit-facilities";
export type {
  CreateCreditFacilityInput,
  HouseholdCreditFacilitySummary,
  UpdateCreditFacilityInput,
} from "./access/credit-facilities";
export {
  BnplPurchaseFacilityError,
  BnplPurchaseNotFoundError,
  BnplPurchaseVersionConflictError,
  createBnplPurchaseRecord,
  getBnplPurchase,
  listBnplPurchasesByHousehold,
  serializeBnplPurchase,
  updateBnplPurchaseRecord,
  voidBnplPurchaseRecord,
} from "./access/bnpl-purchases";
export type {
  BnplPurchaseSummary,
  CreateBnplPurchaseRecordInput,
} from "./access/bnpl-purchases";
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
  listRecurringObservations,
  listSavedRecurringPatterns,
  saveRecurringPatternStatus,
} from "./access/recurring";
export type {
  RecurringObservationRow,
  RecurringPatternStatus,
} from "./access/recurring";
export { listHouseholdAnalyticsTransactions } from "./access/analytics";

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
  DuplicateStatementImportProfileNameError,
  StatementImportProfileNotFoundError,
  createStatementImportProfileInDb,
  deleteStatementImportProfileInDb,
  findStatementImportProfileById,
  listStatementImportProfilesByHousehold,
  updateStatementImportProfileInDb,
} from "./access/statement-import-profiles";
export type {
  NewStatementImportProfileRow,
  StatementImportProfileRow,
} from "./access/statement-import-profiles";

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

export {
  LiabilityDestinationAccountCurrencyMismatchError,
  LiabilityDestinationAccountInvalidHouseholdError,
  LiabilityDestinationAccountNotFoundError,
  LiabilityNotFoundError,
  LiabilityRepaymentAlreadyVoidedError,
  LiabilityRepaymentNotFoundError,
  LiabilityRepaymentVersionConflictError,
  LiabilityVersionConflictError,
  archiveLiabilityInDb,
  findLiabilityById,
  findLiabilityRepaymentById,
  insertLiabilityInDb,
  listLiabilitiesByHousehold,
  listLiabilityRepaymentsByHousehold,
  mapRowToLiability,
  mapRowToLiabilityRepayment,
  recordLiabilityRepaymentInDb,
  unarchiveLiabilityInDb,
  updateLiabilityInDb,
  voidLiabilityRepaymentInDb,
} from "./access/liabilities";
export * from "./access/categorization-rules";
export * from "./access/obligations";
export {
  RECURRING_MATERIALIZATION_DAYS,
  RecurringObligationNotFoundError,
  RecurringObligationVersionConflictError,
  cancelRecurringObligationInDb,
  createRecurringObligationInDb,
  listRecurringObligationsInDb,
  materializeRecurringObligationsInDb,
  updateRecurringObligationInDb,
} from "./access/recurring-obligations";
export type {
  HouseholdLiabilitySummary,
  LiabilityRepaymentRow,
  LiabilityRow,
} from "./access/liabilities";

export * from "./schema/index";
