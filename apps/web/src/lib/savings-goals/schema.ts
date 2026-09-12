import { z } from "zod";
import { SAVINGS_GOAL_STATUSES } from "@nodvis/finance-domain";
import { parseNaturalDecimalToMinor } from "@/lib/transactions/money-entry";

export const minorAmountSchema = z
  .string()
  .trim()
  .regex(/^[0-9]\d*$/, "Amount must be a non-negative integer minor unit string");

export const positiveMinorAmountSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "Amount must be a positive integer minor unit string");

export const calendarDateSchema = z
  .string()
  .trim()
  .regex(
    /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/,
    "Date must be in YYYY-MM-DD format",
  )
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year!, month! - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month! - 1 &&
      date.getUTCDate() === day
    );
  }, "Date must be a valid calendar date");

export const currencyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter uppercase ISO code");

export const savingsGoalStatusSchema = z.enum(SAVINGS_GOAL_STATUSES);

export const createSavingsGoalSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name is required")
      .max(160, "Name cannot exceed 160 characters"),
    targetAmountMinor: positiveMinorAmountSchema.optional(),
    targetAmountNatural: z.string().trim().optional(),
    currentAmountMinor: minorAmountSchema.optional(),
    currentAmountNatural: z.string().trim().optional(),
    currency: currencyCodeSchema,
    targetDate: calendarDateSchema.nullable().optional(),
    accountId: z.string().uuid("Invalid account ID").nullable().optional(),
    notes: z
      .string()
      .trim()
      .max(500, "Notes cannot exceed 500 characters")
      .nullable()
      .optional(),
  })
  .transform((data, ctx) => {
    let resolvedTargetMinor = data.targetAmountMinor;
    if (!resolvedTargetMinor && data.targetAmountNatural) {
      const parsed = parseNaturalDecimalToMinor(
        data.targetAmountNatural,
        data.currency,
      );
      if (parsed.success && parsed.amountMinor) {
        resolvedTargetMinor = parsed.amountMinor;
      }
    }

    let resolvedCurrentMinor = data.currentAmountMinor;
    if (resolvedCurrentMinor === undefined && data.currentAmountNatural !== undefined) {
      if (data.currentAmountNatural === "" || data.currentAmountNatural === "0") {
        resolvedCurrentMinor = "0";
      } else {
        const parsed = parseNaturalDecimalToMinor(
          data.currentAmountNatural,
          data.currency,
        );
        if (parsed.success && parsed.amountMinor) {
          resolvedCurrentMinor = parsed.amountMinor;
        } else {
          ctx.addIssue({ code: "custom", path: ["currentAmountNatural"], message: "Current amount must be a valid decimal" });
          return z.NEVER;
        }
      }
    }

    return {
      ...data,
      targetAmountMinor: resolvedTargetMinor,
      currentAmountMinor: resolvedCurrentMinor ?? "0",
    };
  })
  .refine(
    (data) => data.targetAmountMinor && /^[1-9]\d*$/.test(data.targetAmountMinor),
    {
      message: "Target amount is required and must be strictly positive",
      path: ["targetAmountMinor"],
    },
  );

export const updateSavingsGoalSchema = z
  .object({
    version: z.number().int().positive("Version must be a positive integer"),
    name: z
      .string()
      .trim()
      .min(1, "Name cannot be blank")
      .max(160, "Name cannot exceed 160 characters")
      .optional(),
    targetAmountMinor: positiveMinorAmountSchema.optional(),
    targetAmountNatural: z.string().trim().optional(),
    currentAmountMinor: minorAmountSchema.optional(),
    currentAmountNatural: z.string().trim().optional(),
    currency: currencyCodeSchema.optional(),
    targetDate: calendarDateSchema.nullable().optional(),
    accountId: z.string().uuid("Invalid account ID").nullable().optional(),
    notes: z
      .string()
      .trim()
      .max(500, "Notes cannot exceed 500 characters")
      .nullable()
      .optional(),
  })
  .transform((data, ctx) => {
    let resolvedTargetMinor = data.targetAmountMinor;
    if (!resolvedTargetMinor && data.targetAmountNatural && data.currency) {
      const parsed = parseNaturalDecimalToMinor(
        data.targetAmountNatural,
        data.currency,
      );
      if (parsed.success && parsed.amountMinor) {
        resolvedTargetMinor = parsed.amountMinor;
      }
    }

    let resolvedCurrentMinor = data.currentAmountMinor;
    if (resolvedCurrentMinor === undefined && data.currentAmountNatural !== undefined && data.currency) {
      if (data.currentAmountNatural === "" || data.currentAmountNatural === "0") {
        resolvedCurrentMinor = "0";
      } else {
        const parsed = parseNaturalDecimalToMinor(
          data.currentAmountNatural,
          data.currency,
        );
        if (parsed.success && parsed.amountMinor) {
          resolvedCurrentMinor = parsed.amountMinor;
        } else {
          ctx.addIssue({ code: "custom", path: ["currentAmountNatural"], message: "Current amount must be a valid decimal" });
          return z.NEVER;
        }
      }
    }

    return {
      ...data,
      targetAmountMinor: resolvedTargetMinor,
      currentAmountMinor: resolvedCurrentMinor,
    };
  });

export const contributeSavingsGoalSchema = z
  .object({
    version: z.number().int().positive("Version must be a positive integer"),
    amountMinor: positiveMinorAmountSchema.optional(),
    amountNatural: z.string().trim().optional(),
    currency: currencyCodeSchema.optional(),
  })
  .transform((data) => {
    let resolvedAmountMinor = data.amountMinor;
    if (!resolvedAmountMinor && data.amountNatural) {
      const parsed = parseNaturalDecimalToMinor(
        data.amountNatural,
        data.currency ?? "PLN",
      );
      if (parsed.success && parsed.amountMinor) {
        resolvedAmountMinor = parsed.amountMinor;
      }
    }

    return {
      ...data,
      amountMinor: resolvedAmountMinor,
    };
  })
  .refine(
    (data) => data.amountMinor && /^[1-9]\d*$/.test(data.amountMinor),
    {
      message: "Contribution amount is required and must be strictly positive",
      path: ["amountMinor"],
    },
  );

export const completeSavingsGoalSchema = z.object({
  version: z.number().int().positive("Version must be a positive integer"),
});

export const uncompleteSavingsGoalSchema = z.object({
  version: z.number().int().positive("Version must be a positive integer"),
});

export const archiveSavingsGoalSchema = z.object({
  version: z.number().int().positive("Version must be a positive integer"),
});

export const unarchiveSavingsGoalSchema = z.object({
  version: z.number().int().positive("Version must be a positive integer"),
});

export const savingsGoalQuerySchema = z.object({
  status: z.enum(["all", "active", "completed", "archived"]).optional(),
  accountId: z.string().uuid().optional(),
  sortBy: z.enum(["createdAt", "targetDate", "name"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  asOfDate: calendarDateSchema.optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export type CreateSavingsGoalInput = z.infer<typeof createSavingsGoalSchema>;
export type UpdateSavingsGoalInput = z.infer<typeof updateSavingsGoalSchema>;
export type ContributeSavingsGoalInput = z.infer<typeof contributeSavingsGoalSchema>;
export type CompleteSavingsGoalInput = z.infer<typeof completeSavingsGoalSchema>;
export type UncompleteSavingsGoalInput = z.infer<typeof uncompleteSavingsGoalSchema>;
export type ArchiveSavingsGoalInput = z.infer<typeof archiveSavingsGoalSchema>;
export type UnarchiveSavingsGoalInput = z.infer<typeof unarchiveSavingsGoalSchema>;
export type SavingsGoalQuery = z.infer<typeof savingsGoalQuerySchema>;
