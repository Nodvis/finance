import { z } from "zod";
import {
  LIABILITY_KINDS,
  REPAYMENT_ALLOCATION_STATES,
} from "@nodvis/finance-domain";
import type {
  LiabilityKind,
  RepaymentAllocationState,
} from "@nodvis/finance-domain";

export const liabilityKindSchema = z.enum(LIABILITY_KINDS);
export const repaymentAllocationStateSchema = z.enum(
  REPAYMENT_ALLOCATION_STATES,
);

export const currencyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter uppercase code");

export const createLiabilitySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Liability name is required")
    .max(160, "Liability name cannot exceed 160 characters"),
  kind: liabilityKindSchema.default("loan"),
  currency: currencyCodeSchema,
  observedOutstandingNatural: z.string().trim().optional().nullable(),
  observedOutstandingMinor: z
    .string()
    .trim()
    .regex(/^\d+$/, "Observed outstanding minor must be a non-negative integer string")
    .optional()
    .nullable(),
  observedOutstandingAt: z.coerce.date().optional().nullable(),
  responsiblePersonId: z
    .string()
    .uuid("Invalid responsible person ID")
    .optional()
    .nullable(),
  lender: z
    .string()
    .trim()
    .max(160, "Lender name cannot exceed 160 characters")
    .optional()
    .nullable(),
  destinationAccountId: z
    .string()
    .uuid("Invalid destination account ID")
    .optional()
    .nullable(),
  notes: z
    .string()
    .trim()
    .max(280, "Notes cannot exceed 280 characters")
    .optional()
    .nullable(),
});

// The service also accepts raw pre-default input; route handlers pass parsed
// output, where Zod has already supplied the default kind.
export type CreateLiabilityInput = Omit<
  z.input<typeof createLiabilitySchema>,
  "kind" | "observedOutstandingAt"
> & {
  kind?: LiabilityKind;
  observedOutstandingAt?: Date | null | undefined;
};

export const updateLiabilitySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Liability name cannot be empty")
    .max(160, "Liability name cannot exceed 160 characters")
    .optional(),
  kind: liabilityKindSchema.optional(),
  observedOutstandingNatural: z.string().trim().optional().nullable(),
  observedOutstandingMinor: z
    .string()
    .trim()
    .regex(/^\d+$/, "Observed outstanding minor must be a non-negative integer string")
    .optional()
    .nullable(),
  observedOutstandingAt: z.coerce.date().optional().nullable(),
  responsiblePersonId: z
    .string()
    .uuid("Invalid responsible person ID")
    .optional()
    .nullable(),
  lender: z
    .string()
    .trim()
    .max(160, "Lender name cannot exceed 160 characters")
    .optional()
    .nullable(),
  destinationAccountId: z
    .string()
    .uuid("Invalid destination account ID")
    .optional()
    .nullable(),
  notes: z
    .string()
    .trim()
    .max(280, "Notes cannot exceed 280 characters")
    .optional()
    .nullable(),
  expectedVersion: z
    .number()
    .int("Expected version must be an integer")
    .min(1, "Expected version must be >= 1"),
});

export type UpdateLiabilityInput = z.infer<typeof updateLiabilitySchema>;

export const archiveLiabilitySchema = z.object({
  expectedVersion: z
    .number()
    .int("Expected version must be an integer")
    .min(1, "Expected version must be >= 1"),
});

export type ArchiveLiabilityInput = z.infer<typeof archiveLiabilitySchema>;

export const unarchiveLiabilitySchema = z.object({
  expectedVersion: z
    .number()
    .int("Expected version must be an integer")
    .min(1, "Expected version must be >= 1"),
});

export type UnarchiveLiabilityInput = z.infer<typeof unarchiveLiabilitySchema>;

export const createLiabilityRepaymentSchema = z.object({
  submissionId: z.uuid().optional(),
  paidAt: z.coerce.date({ message: "Repayment date is required" }),
  amountNatural: z.string().trim().optional(),
  amountMinor: z
    .string()
    .trim()
    .regex(/^[1-9]\d*$/, "Repayment amount must be a positive integer string")
    .optional(),
  principalNatural: z.string().trim().optional().nullable(),
  principalMinor: z
    .string()
    .trim()
    .regex(/^\d+$/, "Principal minor must be a non-negative integer string")
    .optional()
    .nullable(),
  interestNatural: z.string().trim().optional().nullable(),
  interestMinor: z
    .string()
    .trim()
    .regex(/^\d+$/, "Interest minor must be a non-negative integer string")
    .optional()
    .nullable(),
  feeNatural: z.string().trim().optional().nullable(),
  feeMinor: z
    .string()
    .trim()
    .regex(/^\d+$/, "Fee minor must be a non-negative integer string")
    .optional()
    .nullable(),
  sourceAccountId: z
    .string()
    .uuid("Invalid source account ID")
    .optional()
    .nullable(),
  transactionId: z
    .string()
    .uuid("Invalid transaction ID")
    .optional()
    .nullable(),
  notes: z
    .string()
    .trim()
    .max(280, "Notes cannot exceed 280 characters")
    .optional()
    .nullable(),
});

export type CreateLiabilityRepaymentInput = z.infer<
  typeof createLiabilityRepaymentSchema
>;

export const voidLiabilityRepaymentSchema = z.object({
  expectedVersion: z
    .number()
    .int("Expected version must be an integer")
    .min(1, "Expected version must be >= 1"),
  voidReason: z
    .string()
    .trim()
    .max(280, "Void reason cannot exceed 280 characters")
    .optional()
    .nullable(),
});

export type VoidLiabilityRepaymentInput = z.infer<
  typeof voidLiabilityRepaymentSchema
>;

export const listLiabilitiesQuerySchema = z.object({
  includeArchived: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      return val === true || val === "true";
    }),
});

export type ListLiabilitiesQuery = z.infer<typeof listLiabilitiesQuerySchema>;

export const listLiabilityRepaymentsQuerySchema = z.object({
  includeVoided: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      return val === true || val === "true";
    }),
});

export type ListLiabilityRepaymentsQuery = z.infer<
  typeof listLiabilityRepaymentsQuerySchema
>;

export type SerializedHouseholdLiability = {
  id: string;
  householdId: string;
  name: string;
  kind: LiabilityKind;
  currency: string;
  observedOutstandingMinor: string | null;
  observedOutstandingAt: string | null;
  responsiblePersonId: string | null;
  responsiblePersonName: string | null;
  lender: string | null;
  destinationAccountId: string | null;
  destinationAccountName: string | null;
  notes: string | null;
  version: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SerializedLiabilityRepayment = {
  id: string;
  householdId: string;
  liabilityId: string;
  transactionId: string | null;
  paidAt: string;
  amountMinor: string;
  currency: string;
  principalMinor: string | null;
  interestMinor: string | null;
  feeMinor: string | null;
  allocationState: RepaymentAllocationState;
  notes: string | null;
  version: number;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
  updatedAt: string;
};
