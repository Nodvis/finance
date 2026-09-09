import { z } from "zod";
import { ACCOUNT_TYPES } from "@nodvis/finance-domain";

export const accountTypeSchema = z.enum(ACCOUNT_TYPES);

export const currencyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter uppercase code");

export const createAccountInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Account name is required")
    .max(160, "Account name cannot exceed 160 characters"),
  type: accountTypeSchema,
  currency: currencyCodeSchema,
  ownerPersonIds: z
    .array(z.uuid("Invalid owner person ID"))
    .min(1, "At least one owner is required"),
  initialBalance: z
    .object({
      amountNatural: z.string().optional().nullable(),
      capturedAt: z.coerce.date().optional(),
    })
    .optional()
    .nullable(),
  overdraft: z
    .object({
      enabled: z.literal(true),
      approvedLimitNatural: z.string().trim().min(1),
    })
    .optional(),
});

export type CreateAccountInput = z.infer<typeof createAccountInputSchema>;

export const updateAccountMetadataSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Account name cannot be empty")
    .max(160, "Account name cannot exceed 160 characters")
    .optional(),
  ownerPersonIds: z
    .array(z.uuid("Invalid owner person ID"))
    .min(1, "At least one owner is required")
    .optional(),
});

export type UpdateAccountMetadataInput = z.infer<
  typeof updateAccountMetadataSchema
>;
