import { z } from "zod";
import { CATEGORY_APPLICABILITIES } from "@nodvis/finance-domain";
import type { CategoryApplicability } from "@nodvis/finance-domain";

export const categoryApplicabilitySchema = z.enum(CATEGORY_APPLICABILITIES);

export const createCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Category name is required")
    .max(160, "Category name cannot exceed 160 characters"),
  applicability: categoryApplicabilitySchema,
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const renameCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Category name is required")
    .max(160, "Category name cannot exceed 160 characters"),
});

export type RenameCategoryInput = z.infer<typeof renameCategorySchema>;

export const listCategoriesQuerySchema = z.object({
  includeArchived: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      return val === true || val === "true";
    }),
  applicability: categoryApplicabilitySchema.optional(),
});

export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>;

export type SerializedCategory = {
  id: string;
  householdId: string;
  name: string;
  applicability: CategoryApplicability;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
