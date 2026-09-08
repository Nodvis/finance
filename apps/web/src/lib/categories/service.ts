import "server-only";

import {
  CategoryNotFoundError,
  archiveHouseholdCategory,
  createHouseholdCategory,
  findCategoryInHousehold,
  listCategoriesByHousehold,
  renameHouseholdCategory,
  seedDefaultCategories,
  unarchiveHouseholdCategory,
} from "@nodvis/finance-db";
import type { HouseholdCategorySummary } from "@nodvis/finance-db";
import type { AuthorizedHouseholdContext } from "@/lib/transactions/service";
import type { AuthorizedHouseholdUserContext } from "@/lib/authorization/household";
import type {
  CreateCategoryInput,
  ListCategoriesQuery,
  RenameCategoryInput,
} from "./schema";

export { CategoryNotFoundError };

export type HouseholdContext =
  | AuthorizedHouseholdUserContext
  | AuthorizedHouseholdContext;

export async function listHouseholdCategories(
  context: HouseholdContext,
  query?: ListCategoriesQuery,
): Promise<HouseholdCategorySummary[]> {
  const options = {
    ...(query?.includeArchived !== undefined
      ? { includeArchived: query.includeArchived }
      : {}),
    ...(query?.applicability !== undefined
      ? { applicability: query.applicability }
      : {}),
  };

  let categories = await listCategoriesByHousehold(context.householdId, options);

  if (categories.length === 0) {
    await seedDefaultCategories(context.householdId);
    categories = await listCategoriesByHousehold(context.householdId, options);
  }

  return categories;
}

export async function getHouseholdCategory(
  context: HouseholdContext,
  categoryId: string,
): Promise<HouseholdCategorySummary> {
  const category = await findCategoryInHousehold(
    context.householdId,
    categoryId,
  );
  if (!category) {
    throw new CategoryNotFoundError();
  }
  return category;
}

export async function createHouseholdCategoryEntry(
  context: HouseholdContext,
  input: CreateCategoryInput,
): Promise<HouseholdCategorySummary> {
  return await createHouseholdCategory({
    householdId: context.householdId,
    name: input.name,
    applicability: input.applicability,
  });
}

export async function renameHouseholdCategoryEntry(
  context: HouseholdContext,
  categoryId: string,
  input: RenameCategoryInput,
): Promise<HouseholdCategorySummary> {
  return await renameHouseholdCategory(
    context.householdId,
    categoryId,
    input.name,
  );
}

export async function archiveHouseholdCategoryEntry(
  context: HouseholdContext,
  categoryId: string,
): Promise<HouseholdCategorySummary> {
  return await archiveHouseholdCategory(context.householdId, categoryId);
}

export async function unarchiveHouseholdCategoryEntry(
  context: HouseholdContext,
  categoryId: string,
): Promise<HouseholdCategorySummary> {
  return await unarchiveHouseholdCategory(context.householdId, categoryId);
}
