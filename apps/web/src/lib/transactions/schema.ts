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
  submissionId: z.string().trim().max(64).optional(),
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
  submissionId: z.string().trim().max(64).optional(),
});

export const createTransferSchema = z
  .object({
    kind: z.literal("transfer"),
    fromAccountId: z.string().uuid("Invalid fromAccountId UUID"),
    toAccountId: z.string().uuid("Invalid toAccountId UUID"),
    amount: moneySchema,
    occurredOn: z.coerce.date(),
    categoryId: z.union([z.string(), z.null(), z.undefined()]).optional(),
    submissionId: z.string().trim().max(64).optional(),
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

export const correctExpenseSchema = z.object({
  kind: z.literal("expense"),
  expectedVersion: z.number().int().min(1, "expectedVersion must be at least 1"),
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

export const correctIncomeSchema = z.object({
  kind: z.literal("income"),
  expectedVersion: z.number().int().min(1, "expectedVersion must be at least 1"),
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

export const correctTransferSchema = z
  .object({
    kind: z.literal("transfer"),
    expectedVersion: z.number().int().min(1, "expectedVersion must be at least 1"),
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

const correctTransactionDiscriminatedUnion = z.discriminatedUnion("kind", [
  correctExpenseSchema,
  correctIncomeSchema,
  correctTransferSchema,
]);

export const correctTransactionSchema = z.preprocess(
  normalizeAmountPreprocessor,
  correctTransactionDiscriminatedUnion,
);

export type CorrectTransactionInput = z.infer<typeof correctTransactionSchema>;

export const voidTransactionSchema = z.object({
  expectedVersion: z.number().int().min(1, "expectedVersion must be at least 1"),
  voidReason: z
    .string()
    .trim()
    .max(280, "Void reason must be at most 280 characters")
    .optional()
    .nullable(),
});

export type VoidTransactionInput = z.infer<typeof voidTransactionSchema>;

export const listTransactionsQuerySchema = z.object({
  accountId: z.string().uuid("Invalid accountId UUID").optional(),
  categoryId: z
    .union([z.string().uuid("Invalid categoryId UUID"), z.literal("uncategorized")])
    .optional(),
  kind: z.enum(["expense", "income", "transfer"]).optional(),
  type: z.enum(["expense", "income", "transfer"]).optional(),
  month: z
    .string()
    .regex(/^\d{4}-(?:0[1-9]|1[0-2])$/, "Month must be in YYYY-MM format")
    .optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be in YYYY-MM-DD format")
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be in YYYY-MM-DD format")
    .optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().trim().max(100).optional(),
  q: z.string().trim().max(100).optional(),
  status: z.enum(["active", "voided", "all"]).optional(),
  includeVoided: z
    .preprocess((val) => val === "true" || val === true, z.boolean())
    .optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  format: z.enum(["json", "csv"]).optional(),
  export: z.enum(["json", "csv"]).optional(),
  locale: z.string().max(10).optional(),
});

export type ListTransactionsQuery = {
  accountId?: string | undefined;
  categoryId?: string | undefined;
  kind?: "expense" | "income" | "transfer" | undefined;
  type?: "expense" | "income" | "transfer" | undefined;
  month?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  search?: string | undefined;
  q?: string | undefined;
  status?: "active" | "voided" | "all" | undefined;
  includeVoided?: boolean | undefined;
  page?: number | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
  format?: "json" | "csv" | undefined;
  export?: "json" | "csv" | undefined;
  locale?: string | undefined;
};
export type ParsedListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;

export type PaginationMetadata = {
  total: number;
  limit: number;
  offset: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
};

export type PaginatedTransactionsResponse = {
  data: SerializedTransaction[];
  pagination: PaginationMetadata;
};

export type SerializedMoney = {
  amountMinor: string;
  currency: string;
};

export type SerializedBaseTransaction = {
  id: string;
  householdId: string;
  amount: SerializedMoney;
  occurredOn: string;
  version: number;
  voidedAt: string | null;
  voidReason: string | null;
};

export type SerializedExpenseTransaction = SerializedBaseTransaction & {
  kind: "expense";
  accountId: string;
  payee: string;
  paidByPersonId: string;
  categoryId: string | null;
};

export type SerializedIncomeTransaction = SerializedBaseTransaction & {
  kind: "income";
  accountId: string;
  source: string;
  receivedByPersonId: string;
  categoryId: string | null;
};

export type SerializedTransferTransaction = SerializedBaseTransaction & {
  kind: "transfer";
  fromAccountId: string;
  toAccountId: string;
};

export type SerializedTransaction =
  | SerializedExpenseTransaction
  | SerializedIncomeTransaction
  | SerializedTransferTransaction;
