import { z } from "zod";

export const minorAmountSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "Amount must be a positive integer minor unit string");

export const calendarDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/, "Date must be in YYYY-MM-DD format");

export const currencyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter uppercase ISO code");

export const obligationStatusSchema = z.enum([
  "upcoming",
  "overdue",
  "paid",
  "cancelled",
]);

export const createObligationSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(160, "Title cannot exceed 160 characters"),
  amountMinor: minorAmountSchema.optional(),
  amountNatural: z.string().trim().optional(),
  currency: currencyCodeSchema,
  dueDate: calendarDateSchema,
  notes: z
    .string()
    .trim()
    .max(280, "Notes cannot exceed 280 characters")
    .nullable()
    .optional(),
});

export const updateObligationSchema = z.object({
  version: z.number().int().positive("Version must be a positive integer"),
  title: z
    .string()
    .trim()
    .min(1, "Title cannot be blank")
    .max(160, "Title cannot exceed 160 characters")
    .optional(),
  amountMinor: minorAmountSchema.optional(),
  amountNatural: z.string().trim().optional(),
  currency: currencyCodeSchema.optional(),
  dueDate: calendarDateSchema.optional(),
  notes: z
    .string()
    .trim()
    .max(280, "Notes cannot exceed 280 characters")
    .nullable()
    .optional(),
});

export const matchObligationSchema = z.object({
  version: z.number().int().positive("Version must be a positive integer"),
  transactionId: z.string().uuid("Invalid transaction ID"),
});

export const unlinkObligationSchema = z.object({
  version: z.number().int().positive("Version must be a positive integer"),
});

export const cancelObligationSchema = z.object({
  version: z.number().int().positive("Version must be a positive integer"),
});

export const obligationQuerySchema = z.object({
  status: z
    .enum(["all", "active", "upcoming", "overdue", "paid", "cancelled"])
    .optional(),
  today: calendarDateSchema.optional(),
});

export type CreateObligationInput = z.infer<typeof createObligationSchema>;
export type UpdateObligationInput = z.infer<typeof updateObligationSchema>;
export type MatchObligationInput = z.infer<typeof matchObligationSchema>;
export type UnlinkObligationInput = z.infer<typeof unlinkObligationSchema>;
export type CancelObligationInput = z.infer<typeof cancelObligationSchema>;
export type ObligationQuery = z.infer<typeof obligationQuerySchema>;

export type SerializedHouseholdObligation = {
  id: string;
  householdId: string;
  title: string;
  amountMinor: string;
  currency: string;
  dueDate: string;
  notes: string | null;
  transactionId: string | null;
  version: number;
  status: "upcoming" | "overdue" | "paid" | "cancelled";
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  matchedTransaction?: {
    id: string;
    payee: string | null;
    occurredOn: string;
    amountMinor: string;
    currency: string;
  } | null;
};

export type SerializedUpcomingObligationsSummary = {
  upcomingCount: number;
  overdueCount: number;
  paidCount: number;
  upcomingByCurrency: Array<{
    currency: string;
    totalMinor: string;
  }>;
  overdueByCurrency: Array<{
    currency: string;
    totalMinor: string;
  }>;
};
