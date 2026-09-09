import { z } from "zod";

export const creditFacilityInputSchema = z.object({
  kind: z.enum(["overdraft", "revolving", "credit_card", "bnpl"]),
  name: z.string().trim().min(1).max(160),
  currency: z.string().regex(/^[A-Z]{3}$/),
  approvedLimitMinor: z.string().regex(/^\d+$/).nullable().optional(),
  observedUsedMinor: z.string().regex(/^\d+$/).nullable().optional(),
  observedAvailableMinor: z.string().regex(/^\d+$/).nullable().optional(),
  observedAt: z.string().datetime().nullable().optional(),
  effectiveFrom: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  version: z.number().int().positive().optional(),
});

export const creditFacilityUpdateSchema = creditFacilityInputSchema.extend({
  version: z.number().int().positive(),
});

export type CreditFacilityInput = z.infer<typeof creditFacilityInputSchema>;
