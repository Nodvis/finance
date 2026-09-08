import { z } from "zod";
import { validateAccountIdentifier } from "@nodvis/finance-domain";

export const addAccountIdentifierSchema = z.object({
  rawIdentifier: z
    .string()
    .min(1, "Identifier is required")
    .max(128, "Identifier is too long")
    .refine((val) => {
      const res = validateAccountIdentifier(val);
      return res.valid;
    }, {
      message: "Invalid Polish domestic account number or IBAN format/checksum",
    }),
  label: z
    .string()
    .trim()
    .max(160, "Label must be at most 160 characters")
    .optional()
    .nullable(),
});

export type AddAccountIdentifierSchemaInput = z.infer<
  typeof addAccountIdentifierSchema
>;
