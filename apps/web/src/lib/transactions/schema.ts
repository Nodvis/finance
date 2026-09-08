import { z } from "zod";

const amountMinorSchema = z
  .union([
    z
      .string()
      .regex(/^[1-9]\d*$/, "amountMinor must be a positive integer string"),
    z.bigint().positive("amountMinor must be positive"),
  ])
  .transform((val) => BigInt(val));

const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "currency must be a 3-letter uppercase ISO code");

export const moneySchema = z.object({
  amountMinor: amountMinorSchema,
  currency: currencySchema,
});

export type MoneyInput = z.infer<typeof moneySchema>;

export const createExpenseSchema = z.object({
  kind: z.literal("expense"),
  accountId: z.string().uuid("Invalid accountId UUID"),
  amount: moneySchema,
  payee: z
    .string()
    .trim()
    .min(1, "Payee is required")
    .max(160, "Payee must be at most 160 characters"),
  paidByPersonId: z.string().uuid("Invalid paidByPersonId UUID").optional(),
  occurredOn: z.coerce.date(),
  categoryId: z.string().uuid("Invalid categoryId UUID").optional().nullable(),
});

export const createIncomeSchema = z.object({
  kind: z.literal("income"),
  accountId: z.string().uuid("Invalid accountId UUID"),
  amount: moneySchema,
  source: z
    .string()
    .trim()
    .min(1, "Source is required")
    .max(160, "Source must be at most 160 characters"),
  receivedByPersonId: z
    .string()
    .uuid("Invalid receivedByPersonId UUID")
    .optional(),
  occurredOn: z.coerce.date(),
  categoryId: z.string().uuid("Invalid categoryId UUID").optional().nullable(),
});

export const createTransferSchema = z
  .object({
    kind: z.literal("transfer"),
    fromAccountId: z.string().uuid("Invalid fromAccountId UUID"),
    toAccountId: z.string().uuid("Invalid toAccountId UUID"),
    amount: moneySchema,
    occurredOn: z.coerce.date(),
    categoryId: z.union([z.string(), z.null(), z.undefined()]).optional(),
  })
  .refine((data) => data.fromAccountId !== data.toAccountId, {
    message:
      "Self-transfer rejected: fromAccountId and toAccountId must be different",
    path: ["toAccountId"],
  })
  .refine((data) => !data.categoryId, {
    message: "Transfer transactions cannot have a category",
    path: ["categoryId"],
  });

const createTransactionDiscriminatedUnion = z.discriminatedUnion("kind", [
  createExpenseSchema,
  createIncomeSchema,
  createTransferSchema,
]);

// Normalize amount if caller provided flattened amountMinor & currency
const normalizeAmountPreprocessor = (data: unknown) => {
  if (data && typeof data === "object") {
    const obj = { ...(data as Record<string, unknown>) };
    if (
      !obj.amount &&
      (obj.amountMinor !== undefined || obj.currency !== undefined)
    ) {
      obj.amount = {
        amountMinor: obj.amountMinor,
        currency: obj.currency,
      };
    }
    return obj;
  }
  return data;
};

export const createTransactionSchema = z.preprocess(
  normalizeAmountPreprocessor,
  createTransactionDiscriminatedUnion,
);

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export const listTransactionsQuerySchema = z.object({
  accountId: z.string().uuid("Invalid accountId UUID").optional(),
  categoryId: z.string().uuid("Invalid categoryId UUID").optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;

export type SerializedMoney = {
  amountMinor: string;
  currency: string;
};

export type SerializedExpenseTransaction = {
  id: string;
  householdId: string;
  kind: "expense";
  accountId: string;
  amount: SerializedMoney;
  payee: string;
  paidByPersonId: string;
  occurredOn: string;
  categoryId: string | null;
};

export type SerializedIncomeTransaction = {
  id: string;
  householdId: string;
  kind: "income";
  accountId: string;
  amount: SerializedMoney;
  source: string;
  receivedByPersonId: string;
  occurredOn: string;
  categoryId: string | null;
};

export type SerializedTransferTransaction = {
  id: string;
  householdId: string;
  kind: "transfer";
  fromAccountId: string;
  toAccountId: string;
  amount: SerializedMoney;
  occurredOn: string;
};

export type SerializedTransaction =
  | SerializedExpenseTransaction
  | SerializedIncomeTransaction
  | SerializedTransferTransaction;
