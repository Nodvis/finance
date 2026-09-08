export type HistoryOperation = "create" | "correction" | "void" | "baseline";
export type HistorySource = "manual" | "system" | "import" | "legacy";

export type TransactionHistoryActor = {
  authUserId: string | null;
  personId: string | null;
  displayName: string | null;
};

export type TransactionFieldChangeItem = {
  field:
    | "amount"
    | "date"
    | "account"
    | "fromAccount"
    | "toAccount"
    | "category"
    | "payee"
    | "source"
    | "person"
    | "status"
    | "voidReason";
  fieldLabelKey: string;
  before: string | null;
  after: string | null;
};

export type TransactionHistorySummary = {
  kind: "expense" | "income" | "transfer";
  amountFormatted: string;
  occurredOn: string;
  accountName: string | null;
  fromAccountName: string | null;
  toAccountName: string | null;
  categoryName: string | null;
  counterparty: string | null;
  personName: string | null;
  status: "active" | "voided";
};

export type TransactionHistoryEntry = {
  id: string;
  revision: number;
  operation: HistoryOperation;
  source: HistorySource;
  recordedAt: string;
  actor: TransactionHistoryActor | null;
  voidReason: string | null;
  isBaseline: boolean;
  changes: TransactionFieldChangeItem[];
  summary: TransactionHistorySummary;
};

export type TransactionHistoryResult = {
  transactionId: string;
  history: TransactionHistoryEntry[];
};
