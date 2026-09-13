import { z } from "zod";
import { currencyCodeSchema, positiveMinorAmountSchema } from "@/lib/savings-goals/schema";
export const budgetMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const budgetQuerySchema = z.object({ month: budgetMonthSchema.default(new Date().toISOString().slice(0, 7)), includeArchived: z.coerce.boolean().default(false) });
export const createBudgetSchema = z.object({ categoryId: z.string().uuid(), month: budgetMonthSchema, limitAmountMinor: positiveMinorAmountSchema, currency: currencyCodeSchema });
export const updateBudgetSchema = z.object({ version: z.number().int().positive(), month: budgetMonthSchema.optional(), limitAmountMinor: positiveMinorAmountSchema.optional() }).refine((input) => input.month !== undefined || input.limitAmountMinor !== undefined, "At least one budget field must be updated");
export const archiveBudgetSchema = z.object({ version: z.number().int().positive() });
