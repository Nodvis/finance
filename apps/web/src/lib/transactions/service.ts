import "server-only";

import {
  DuplicateSubmissionError,
  TransactionAlreadyVoidedError,
  TransactionNotFoundError,
  TransactionVersionConflictError,
  findAccountInHousehold,
  findCategoryInHousehold,
  findTransactionById,
  insertTransaction,
  isPersonInHousehold,
  listAccountsByHousehold,
  listCategoriesByHousehold,
  listTransactionsByHousehold,
  queryTransactionsByHousehold,
  updateTransactionInDb,
  voidTransactionInDb,
} from "@nodvis/finance-db";
import { generateTransactionsCsv } from "./csv-export";
import {
  accountId as toAccountId,
  categoryId as toCategoryId,
  correctExpense,
  correctIncome,
  correctTransfer,
  createExpense,
  createIncome,
  createTransfer,
  isCategoryApplicableToKind,
  money,
  personId as toPersonId,
  transactionId,
} from "@nodvis/finance-domain";
import type {
  ExpenseTransaction,
  HouseholdId,
  IncomeTransaction,
  PersonId,
  Transaction,
  TransferTransaction,
} from "@nodvis/finance-domain";

import type {
  CorrectTransactionInput,
  CreateTransactionInput,
  ListTransactionsQuery,
  VoidTransactionInput,
} from "./schema";

export {
  DuplicateSubmissionError,
  TransactionAlreadyVoidedError,
  TransactionNotFoundError,
  TransactionVersionConflictError,
};

export { getTransactionHistory } from "./history";
export type {
  TransactionHistoryEntry,
  TransactionHistoryResult,
  TransactionFieldChangeItem,
  TransactionHistoryActor,
  TransactionHistorySummary,
  HistoryOperation,
  HistorySource,
} from "./history";

export class TransactionAccountNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransactionAccountNotFoundError";
  }
}

export class TransactionCurrencyMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransactionCurrencyMismatchError";
  }
}

export class TransactionInvalidPersonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransactionInvalidPersonError";
  }
}

export class TransactionCategoryNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransactionCategoryNotFoundError";
  }
}

export class TransactionCategoryArchivedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransactionCategoryArchivedError";
  }
}

export class TransactionCategoryApplicabilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransactionCategoryApplicabilityError";
  }
}

export class TransactionCategoryNotAllowedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransactionCategoryNotAllowedError";
  }
}

export class TransactionKindMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransactionKindMismatchError";
  }
}

export type AuthorizedHouseholdContext = Readonly<{
  authUserId: string;
  householdId: HouseholdId;
  personId: PersonId;
}>;

export async function createManualTransaction(
  context: AuthorizedHouseholdContext,
  input: CreateTransactionInput,
): Promise<Transaction> {
  const newTxId = transactionId(crypto.randomUUID());

  if (input.kind === "expense") {
    const account = await findAccountInHousehold(
      context.householdId,
      input.accountId,
    );
    if (!account) {
      throw new TransactionAccountNotFoundError(
        `Account ${input.accountId} not found in household`,
      );
    }
    if (account.currency !== input.amount.currency) {
      throw new TransactionCurrencyMismatchError(
        `Account currency (${account.currency}) does not match transaction currency (${input.amount.currency})`,
      );
    }

    const paidByPersonId = input.paidByPersonId ?? context.personId;
    if (input.paidByPersonId) {
      const isMember = await isPersonInHousehold(
        context.householdId,
        input.paidByPersonId,
      );
      if (!isMember) {
        throw new TransactionInvalidPersonError(
          `Person ${input.paidByPersonId} is not a member of household`,
        );
      }
    }

    if (input.categoryId) {
      const category = await findCategoryInHousehold(
        context.householdId,
        input.categoryId,
      );
      if (!category) {
        throw new TransactionCategoryNotFoundError(
          `Category ${input.categoryId} not found in household`,
        );
      }
      if (category.archivedAt) {
        throw new TransactionCategoryArchivedError(
          `Category "${category.name}" is archived and cannot be assigned to new transactions`,
        );
      }
      if (!isCategoryApplicableToKind(category.applicability, "expense")) {
        throw new TransactionCategoryApplicabilityError(
          `Category "${category.name}" cannot be applied to expense transactions`,
        );
      }
    }

    const expense = createExpense({
      id: newTxId,
      householdId: context.householdId,
      accountId: toAccountId(input.accountId),
      amount: money(input.amount.amountMinor, input.amount.currency),
      payee: input.payee,
      paidByPersonId: toPersonId(paidByPersonId),
      occurredOn: input.occurredOn,
      categoryId: input.categoryId ? toCategoryId(input.categoryId) : null,
    });

    return await insertTransaction(expense, {
      submissionId: input.submissionId,
      audit: {
        authUserId: context.authUserId,
        personId: context.personId,
        source: "manual",
      },
    });
  }

  if (input.kind === "income") {
    const account = await findAccountInHousehold(
      context.householdId,
      input.accountId,
    );
    if (!account) {
      throw new TransactionAccountNotFoundError(
        `Account ${input.accountId} not found in household`,
      );
    }
    if (account.currency !== input.amount.currency) {
      throw new TransactionCurrencyMismatchError(
        `Account currency (${account.currency}) does not match transaction currency (${input.amount.currency})`,
      );
    }

    const receivedByPersonId = input.receivedByPersonId ?? context.personId;
    if (input.receivedByPersonId) {
      const isMember = await isPersonInHousehold(
        context.householdId,
        input.receivedByPersonId,
      );
      if (!isMember) {
        throw new TransactionInvalidPersonError(
          `Person ${input.receivedByPersonId} is not a member of household`,
        );
      }
    }

    if (input.categoryId) {
      const category = await findCategoryInHousehold(
        context.householdId,
        input.categoryId,
      );
      if (!category) {
        throw new TransactionCategoryNotFoundError(
          `Category ${input.categoryId} not found in household`,
        );
      }
      if (category.archivedAt) {
        throw new TransactionCategoryArchivedError(
          `Category "${category.name}" is archived and cannot be assigned to new transactions`,
        );
      }
      if (!isCategoryApplicableToKind(category.applicability, "income")) {
        throw new TransactionCategoryApplicabilityError(
          `Category "${category.name}" cannot be applied to income transactions`,
        );
      }
    }

    const income = createIncome({
      id: newTxId,
      householdId: context.householdId,
      accountId: toAccountId(input.accountId),
      amount: money(input.amount.amountMinor, input.amount.currency),
      source: input.source,
      receivedByPersonId: toPersonId(receivedByPersonId),
      occurredOn: input.occurredOn,
      categoryId: input.categoryId ? toCategoryId(input.categoryId) : null,
    });

    return await insertTransaction(income, {
      submissionId: input.submissionId,
      audit: {
        authUserId: context.authUserId,
        personId: context.personId,
        source: "manual",
      },
    });
  }

  if (input.kind === "transfer") {
    if ((input as { categoryId?: unknown }).categoryId) {
      throw new TransactionCategoryNotAllowedError(
        "Transfer transactions cannot have a category",
      );
    }

    const fromAccount = await findAccountInHousehold(
      context.householdId,
      input.fromAccountId,
    );
    if (!fromAccount) {
      throw new TransactionAccountNotFoundError(
        `Source account ${input.fromAccountId} not found in household`,
      );
    }
    const toAccount = await findAccountInHousehold(
      context.householdId,
      input.toAccountId,
    );
    if (!toAccount) {
      throw new TransactionAccountNotFoundError(
        `Destination account ${input.toAccountId} not found in household`,
      );
    }

    if (fromAccount.currency !== input.amount.currency) {
      throw new TransactionCurrencyMismatchError(
        `Source account currency (${fromAccount.currency}) does not match transfer currency (${input.amount.currency})`,
      );
    }
    if (toAccount.currency !== input.amount.currency) {
      throw new TransactionCurrencyMismatchError(
        `Destination account currency (${toAccount.currency}) does not match transfer currency (${input.amount.currency})`,
      );
    }

    const transfer = createTransfer({
      id: newTxId,
      householdId: context.householdId,
      fromAccountId: toAccountId(input.fromAccountId),
      toAccountId: toAccountId(input.toAccountId),
      amount: money(input.amount.amountMinor, input.amount.currency),
      occurredOn: input.occurredOn,
    });

    return await insertTransaction(transfer, {
      submissionId: input.submissionId,
      audit: {
        authUserId: context.authUserId,
        personId: context.personId,
        source: "manual",
      },
    });
  }

  throw new Error("Unsupported transaction kind");
}

export async function getManualTransaction(
  context: AuthorizedHouseholdContext,
  transactionId: string,
): Promise<Transaction> {
  const tx = await findTransactionById(context.householdId, transactionId);
  if (!tx) {
    throw new TransactionNotFoundError(
      `Transaction ${transactionId} not found in household`,
    );
  }
  return tx;
}

export async function correctManualTransaction(
  context: AuthorizedHouseholdContext,
  transactionId: string,
  input: CorrectTransactionInput,
): Promise<Transaction> {
  const existing = await findTransactionById(context.householdId, transactionId);
  if (!existing) {
    throw new TransactionNotFoundError(
      `Transaction ${transactionId} not found in household`,
    );
  }
  if (existing.voidedAt !== null) {
    throw new TransactionAlreadyVoidedError(
      `Transaction ${transactionId} is voided and cannot be edited`,
    );
  }
  if (existing.kind !== input.kind) {
    throw new TransactionKindMismatchError(
      `Cannot change transaction kind from ${existing.kind} to ${input.kind}`,
    );
  }

  if (input.kind === "expense") {
    const account = await findAccountInHousehold(
      context.householdId,
      input.accountId,
    );
    if (!account) {
      throw new TransactionAccountNotFoundError(
        `Account ${input.accountId} not found in household`,
      );
    }
    if (account.currency !== input.amount.currency) {
      throw new TransactionCurrencyMismatchError(
        `Account currency (${account.currency}) does not match transaction currency (${input.amount.currency})`,
      );
    }

    const paidByPersonId =
      input.paidByPersonId ?? (existing as ExpenseTransaction).paidByPersonId;
    if (input.paidByPersonId) {
      const isMember = await isPersonInHousehold(
        context.householdId,
        input.paidByPersonId,
      );
      if (!isMember) {
        throw new TransactionInvalidPersonError(
          `Person ${input.paidByPersonId} is not a member of household`,
        );
      }
    }

    if (input.categoryId) {
      const category = await findCategoryInHousehold(
        context.householdId,
        input.categoryId,
      );
      if (!category) {
        throw new TransactionCategoryNotFoundError(
          `Category ${input.categoryId} not found in household`,
        );
      }
      if (category.archivedAt) {
        throw new TransactionCategoryArchivedError(
          `Category "${category.name}" is archived and cannot be assigned to transactions`,
        );
      }
      if (!isCategoryApplicableToKind(category.applicability, "expense")) {
        throw new TransactionCategoryApplicabilityError(
          `Category "${category.name}" cannot be applied to expense transactions`,
        );
      }
    }

    const corrected = correctExpense(existing as ExpenseTransaction, {
      accountId: toAccountId(input.accountId),
      amount: money(input.amount.amountMinor, input.amount.currency),
      payee: input.payee,
      paidByPersonId: toPersonId(paidByPersonId),
      occurredOn: input.occurredOn,
      categoryId: input.categoryId ? toCategoryId(input.categoryId) : null,
    });

    return await updateTransactionInDb({
      householdId: context.householdId,
      id: transactionId,
      expectedVersion: input.expectedVersion,
      transaction: corrected,
      audit: {
        authUserId: context.authUserId,
        personId: context.personId,
        source: "manual",
      },
    });
  }

  if (input.kind === "income") {
    const account = await findAccountInHousehold(
      context.householdId,
      input.accountId,
    );
    if (!account) {
      throw new TransactionAccountNotFoundError(
        `Account ${input.accountId} not found in household`,
      );
    }
    if (account.currency !== input.amount.currency) {
      throw new TransactionCurrencyMismatchError(
        `Account currency (${account.currency}) does not match transaction currency (${input.amount.currency})`,
      );
    }

    const receivedByPersonId =
      input.receivedByPersonId ?? (existing as IncomeTransaction).receivedByPersonId;
    if (input.receivedByPersonId) {
      const isMember = await isPersonInHousehold(
        context.householdId,
        input.receivedByPersonId,
      );
      if (!isMember) {
        throw new TransactionInvalidPersonError(
          `Person ${input.receivedByPersonId} is not a member of household`,
        );
      }
    }

    if (input.categoryId) {
      const category = await findCategoryInHousehold(
        context.householdId,
        input.categoryId,
      );
      if (!category) {
        throw new TransactionCategoryNotFoundError(
          `Category ${input.categoryId} not found in household`,
        );
      }
      if (category.archivedAt) {
        throw new TransactionCategoryArchivedError(
          `Category "${category.name}" is archived and cannot be assigned to transactions`,
        );
      }
      if (!isCategoryApplicableToKind(category.applicability, "income")) {
        throw new TransactionCategoryApplicabilityError(
          `Category "${category.name}" cannot be applied to income transactions`,
        );
      }
    }

    const corrected = correctIncome(existing as IncomeTransaction, {
      accountId: toAccountId(input.accountId),
      amount: money(input.amount.amountMinor, input.amount.currency),
      source: input.source,
      receivedByPersonId: toPersonId(receivedByPersonId),
      occurredOn: input.occurredOn,
      categoryId: input.categoryId ? toCategoryId(input.categoryId) : null,
    });

    return await updateTransactionInDb({
      householdId: context.householdId,
      id: transactionId,
      expectedVersion: input.expectedVersion,
      transaction: corrected,
      audit: {
        authUserId: context.authUserId,
        personId: context.personId,
        source: "manual",
      },
    });
  }

  if (input.kind === "transfer") {
    if ((input as { categoryId?: unknown }).categoryId) {
      throw new TransactionCategoryNotAllowedError(
        "Transfer transactions cannot have a category",
      );
    }

    const fromAccount = await findAccountInHousehold(
      context.householdId,
      input.fromAccountId,
    );
    if (!fromAccount) {
      throw new TransactionAccountNotFoundError(
        `Source account ${input.fromAccountId} not found in household`,
      );
    }
    const toAccount = await findAccountInHousehold(
      context.householdId,
      input.toAccountId,
    );
    if (!toAccount) {
      throw new TransactionAccountNotFoundError(
        `Destination account ${input.toAccountId} not found in household`,
      );
    }

    if (fromAccount.currency !== input.amount.currency) {
      throw new TransactionCurrencyMismatchError(
        `Source account currency (${fromAccount.currency}) does not match transfer currency (${input.amount.currency})`,
      );
    }
    if (toAccount.currency !== input.amount.currency) {
      throw new TransactionCurrencyMismatchError(
        `Destination account currency (${toAccount.currency}) does not match transfer currency (${input.amount.currency})`,
      );
    }

    const corrected = correctTransfer(existing as TransferTransaction, {
      fromAccountId: toAccountId(input.fromAccountId),
      toAccountId: toAccountId(input.toAccountId),
      amount: money(input.amount.amountMinor, input.amount.currency),
      occurredOn: input.occurredOn,
    });

    return await updateTransactionInDb({
      householdId: context.householdId,
      id: transactionId,
      expectedVersion: input.expectedVersion,
      transaction: corrected,
      audit: {
        authUserId: context.authUserId,
        personId: context.personId,
        source: "manual",
      },
    });
  }

  throw new Error("Unsupported transaction kind");
}

export async function voidManualTransaction(
  context: AuthorizedHouseholdContext,
  transactionId: string,
  input: VoidTransactionInput,
): Promise<Transaction> {
  return await voidTransactionInDb({
    householdId: context.householdId,
    id: transactionId,
    expectedVersion: input.expectedVersion,
    voidReason: input.voidReason ?? null,
    audit: {
      authUserId: context.authUserId,
      personId: context.personId,
      source: "manual",
    },
  });
}

export async function queryManualTransactions(
  context: AuthorizedHouseholdContext,
  query: ListTransactionsQuery,
): Promise<{
  transactions: Transaction[];
  total: number;
  limit: number;
  offset: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}> {
  const limit = query.limit ?? 50;
  const offset =
    query.page && query.page > 1
      ? (query.page - 1) * limit
      : (query.offset ?? 0);

  const kind = query.kind ?? query.type;
  const search = query.search ?? query.q;
  const from = query.from ?? query.startDate;
  const to = query.to ?? query.endDate;

  const result = await queryTransactionsByHousehold({
    householdId: context.householdId,
    accountId: query.accountId,
    categoryId: query.categoryId,
    kind,
    month: query.month,
    from,
    to,
    search,
    status: query.status,
    includeVoided: query.includeVoided,
    limit,
    offset,
  });

  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(result.total / limit));
  const hasMore = offset + result.transactions.length < result.total;

  return {
    transactions: result.transactions,
    total: result.total,
    limit,
    offset,
    page,
    totalPages,
    hasMore,
  };
}

export async function listManualTransactions(
  context: AuthorizedHouseholdContext,
  query: ListTransactionsQuery,
): Promise<Transaction[]> {
  const limit = query.limit ?? 50;
  const offset =
    query.page && query.page > 1
      ? (query.page - 1) * limit
      : (query.offset ?? 0);

  const kind = query.kind ?? query.type;
  const search = query.search ?? query.q;
  const from = query.from ?? query.startDate;
  const to = query.to ?? query.endDate;

  return await listTransactionsByHousehold({
    householdId: context.householdId,
    ...(query.accountId ? { accountId: query.accountId } : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(kind ? { kind } : {}),
    ...(query.month ? { month: query.month } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(search ? { search } : {}),
    ...(query.status ? { status: query.status } : {}),
    includeVoided: query.includeVoided,
    limit,
    offset,
  });
}

export async function exportManualTransactionsToCsv(
  context: AuthorizedHouseholdContext,
  query: ListTransactionsQuery,
  locale: string = "en",
): Promise<string> {
  const [accounts, categories, result] = await Promise.all([
    listAccountsByHousehold(context.householdId, { includeArchived: true }),
    listCategoriesByHousehold(context.householdId, { includeArchived: true }),
    queryManualTransactions(context, {
      ...query,
      limit: query.limit ?? 10000,
      offset: query.offset ?? 0,
    }),
  ]);

  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  return generateTransactionsCsv({
    transactions: result.transactions,
    accounts: accountMap,
    categories: categoryMap,
    locale,
  });
}

export async function listHouseholdAccounts(
  context: AuthorizedHouseholdContext,
) {
  return await listAccountsByHousehold(context.householdId);
}
