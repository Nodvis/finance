import { z } from "zod";
import { calendarDateSchema } from "@/lib/obligations/schema";

export const recurringFrequencySchema = z.enum(["weekly", "monthly", "yearly"]);
const recurringObligationFields = z.object({
  title: z.string().trim().min(1).max(160),
  amountMinor: z.string().trim().regex(/^[1-9]\d*$/).optional(),
  amountNatural: z.string().trim().optional(),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  frequency: recurringFrequencySchema,
  firstDueDate: calendarDateSchema,
  endDate: calendarDateSchema.nullable().optional(),
  notes: z.string().trim().max(280).nullable().optional(),
});
export const createRecurringObligationSchema = recurringObligationFields
  .refine((value) => value.amountMinor !== undefined || value.amountNatural !== undefined, "Amount is required")
  .refine((value) => !value.endDate || value.endDate >= value.firstDueDate, "End date must not precede first due date");

export const updateRecurringObligationSchema = recurringObligationFields.partial().extend({ version: z.number().int().positive() })
  .refine((value) => value.amountMinor !== undefined || value.amountNatural !== undefined || Object.keys(value).some((key) => !["version", "amountMinor", "amountNatural"].includes(key)), "At least one change is required")
  .refine((value) => !value.endDate || !value.firstDueDate || value.endDate >= value.firstDueDate, "End date must not precede first due date");
export const cancelRecurringObligationSchema = z.object({ version: z.number().int().positive() });
export type CreateRecurringObligationInput = z.infer<typeof createRecurringObligationSchema>;
export type UpdateRecurringObligationInput = z.infer<typeof updateRecurringObligationSchema>;
