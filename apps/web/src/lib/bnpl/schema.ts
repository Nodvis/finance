import { z } from "zod";

const minor = z.string().regex(/^\d+$/);
const optionalMinor = minor.nullable().optional();

export const bnplPurchaseCreateSchema = z.object({
  creditFacilityId: z.uuid(),
  provider: z.string().trim().min(1).max(160),
  product: z.string().trim().min(1).max(160),
  merchant: z.string().trim().min(1).max(160),
  description: z.string().trim().max(280).nullable().optional(),
  purchaseDate: z.string().datetime(),
  financingDate: z.string().datetime().optional(),
  originalAmountMinor: minor,
  financedAmountMinor: minor,
  currency: z.string().regex(/^[A-Z]{3}$/),
  observedOutstandingMinor: optionalMinor,
  observedOutstandingAt: z.string().datetime().nullable().optional(),
  paymentModel: z.enum(["pay_in_full", "pay_in_30", "installments", "split_pay", "revolving", "other"]).optional(),
  status: z.enum(["pending", "active", "settled", "overdue", "cancelled", "defaulted"]).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  principalMinor: optionalMinor,
  interestMinor: optionalMinor,
  feeMinor: optionalMinor,
  transactionId: z.uuid().nullable().optional(),
});

export const bnplPurchaseQuerySchema = z.object({
  facilityId: z.uuid().optional(),
  includeVoided: z.enum(["true", "false"]).optional(),
});

export const bnplPurchaseUpdateSchema = bnplPurchaseCreateSchema.omit({ creditFacilityId: true, currency: true }).partial().extend({
  version: z.number().int().positive(),
});

export const bnplPurchaseVoidSchema = z.object({
  version: z.number().int().positive(),
  reason: z.string().trim().max(280).nullable().optional(),
});
