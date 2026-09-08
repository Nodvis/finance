import type { HouseholdCategorySummary } from "@nodvis/finance-db";
import type { SerializedCategory } from "./schema";

export function serializeCategory(
  category: HouseholdCategorySummary,
): SerializedCategory {
  return {
    id: category.id,
    householdId: category.householdId,
    name: category.name,
    applicability: category.applicability,
    archivedAt: category.archivedAt ? category.archivedAt.toISOString() : null,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}
