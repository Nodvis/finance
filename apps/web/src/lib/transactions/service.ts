import "server-only";

import {
  findAccountInHousehold,
  insertTransaction,
  isPersonInHousehold,
  listTransactionsByHousehold,
} from "@nodvis/finance-db";
import {
  accountId as toAccountId,
  createExpense,
  createIncome,
  createTransfer,
  money,
  personId as toPersonId,
  transactionId,
} from "@nodvis/finance-domain";
import type {
  HouseholdId,
  PersonId,
  Transaction,
} from "@nodvis/finance-domain";

import type { CreateTransactionInput, ListTransactionsQuery } from "./schema";

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

    const expense = createExpense({
      id: newTxId,
      householdId: context.householdId,
      accountId: toAccountId(input.accountId),
      amount: money(input.amount.amountMinor, input.amount.currency),
      payee: input.payee,
      paidByPersonId: toPersonId(paidByPersonId),
      occurredOn: input.occurredOn,
    });

    return await insertTransaction(expense);
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

    const income = createIncome({
      id: newTxId,
      householdId: context.householdId,
      accountId: toAccountId(input.accountId),
      amount: money(input.amount.amountMinor, input.amount.currency),
      source: input.source,
      receivedByPersonId: toPersonId(receivedByPersonId),
      occurredOn: input.occurredOn,
    });

    return await insertTransaction(income);
  }

  if (input.kind === "transfer") {
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

    return await insertTransaction(transfer);
  }

  throw new Error("Unsupported transaction kind");
}

export async function listManualTransactions(
  context: AuthorizedHouseholdContext,
  query: ListTransactionsQuery,
): Promise<Transaction[]> {
  return await listTransactionsByHousehold({
    householdId: context.householdId,
    ...(query.accountId ? { accountId: query.accountId } : {}),
    limit: query.limit,
    offset: query.offset,
  });
}
