import { and, asc, eq } from "drizzle-orm";
import type { CategoryApplicability } from "@nodvis/finance-domain";
import {
  DEFAULT_POLISH_CATEGORIES,
  categoryId as toCategoryId,
  createCategory,
  generateDefaultCategoryId,
  householdId as toHouseholdId,
} from "@nodvis/finance-domain";

import { getDb } from "../client";
import { categories } from "../schema/categories";

export class CategoryNotFoundError extends Error {
  constructor(message: string = "Category not found in household") {
    super(message);
    this.name = "CategoryNotFoundError";
  }
}

export type HouseholdCategorySummary = {
  id: string;
  householdId: string;
  name: string;
  applicability: CategoryApplicability;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function findCategoryInHousehold(
  householdId: string,
  categoryId: string,
): Promise<HouseholdCategorySummary | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: categories.id,
      householdId: categories.householdId,
      name: categories.name,
      applicability: categories.applicability,
      archivedAt: categories.archivedAt,
      createdAt: categories.createdAt,
      updatedAt: categories.updatedAt,
    })
    .from(categories)
    .where(
      and(
        eq(categories.householdId, householdId),
        eq(categories.id, categoryId),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    householdId: row.householdId,
    name: row.name,
    applicability: row.applicability as CategoryApplicability,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export type ListCategoriesOptions = {
  includeArchived?: boolean;
  applicability?: CategoryApplicability;
};

export async function listCategoriesByHousehold(
  householdId: string,
  options: ListCategoriesOptions = { includeArchived: true },
): Promise<HouseholdCategorySummary[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: categories.id,
      householdId: categories.householdId,
      name: categories.name,
      applicability: categories.applicability,
      archivedAt: categories.archivedAt,
      createdAt: categories.createdAt,
      updatedAt: categories.updatedAt,
    })
    .from(categories)
    .where(eq(categories.householdId, householdId))
    .orderBy(asc(categories.name));

  let results: HouseholdCategorySummary[] = rows.map((r) => ({
    id: r.id,
    householdId: r.householdId,
    name: r.name,
    applicability: r.applicability as CategoryApplicability,
    archivedAt: r.archivedAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  if (options.includeArchived === false) {
    results = results.filter((c) => c.archivedAt === null);
  }

  if (options.applicability) {
    results = results.filter(
      (c) =>
        c.applicability === options.applicability ||
        c.applicability === "both",
    );
  }

  return results;
}

export type CreateHouseholdCategoryInput = {
  householdId: string;
  name: string;
  applicability: CategoryApplicability | string;
  id?: string | undefined;
};

export async function createHouseholdCategory(
  input: CreateHouseholdCategoryInput,
): Promise<HouseholdCategorySummary> {
  const db = getDb();
  const newCatId = input.id ?? crypto.randomUUID();

  const domainCategory = createCategory({
    id: toCategoryId(newCatId),
    householdId: toHouseholdId(input.householdId),
    name: input.name,
    applicability: input.applicability,
  });

  const [inserted] = await db
    .insert(categories)
    .values({
      id: domainCategory.id,
      householdId: domainCategory.householdId,
      name: domainCategory.name,
      applicability: domainCategory.applicability,
      archivedAt: null,
    })
    .returning();

  if (!inserted) {
    throw new Error("Failed to create category");
  }

  return {
    id: inserted.id,
    householdId: inserted.householdId,
    name: inserted.name,
    applicability: inserted.applicability as CategoryApplicability,
    archivedAt: inserted.archivedAt,
    createdAt: inserted.createdAt,
    updatedAt: inserted.updatedAt,
  };
}

export async function renameHouseholdCategory(
  householdId: string,
  categoryId: string,
  newName: string,
): Promise<HouseholdCategorySummary> {
  const db = getDb();
  const trimmed = newName.trim();
  if (trimmed.length === 0 || trimmed.length > 160) {
    throw new Error("Invalid category name: must be 1 to 160 characters");
  }

  const [existing] = await db
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.householdId, householdId),
        eq(categories.id, categoryId),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new CategoryNotFoundError();
  }

  const [updated] = await db
    .update(categories)
    .set({
      name: trimmed,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(categories.householdId, householdId),
        eq(categories.id, categoryId),
      ),
    )
    .returning();

  return {
    id: updated!.id,
    householdId: updated!.householdId,
    name: updated!.name,
    applicability: updated!.applicability as CategoryApplicability,
    archivedAt: updated!.archivedAt,
    createdAt: updated!.createdAt,
    updatedAt: updated!.updatedAt,
  };
}

export async function archiveHouseholdCategory(
  householdId: string,
  categoryId: string,
  archivedAt: Date = new Date(),
): Promise<HouseholdCategorySummary> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.householdId, householdId),
        eq(categories.id, categoryId),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new CategoryNotFoundError();
  }

  const [updated] = await db
    .update(categories)
    .set({
      archivedAt,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(categories.householdId, householdId),
        eq(categories.id, categoryId),
      ),
    )
    .returning();

  return {
    id: updated!.id,
    householdId: updated!.householdId,
    name: updated!.name,
    applicability: updated!.applicability as CategoryApplicability,
    archivedAt: updated!.archivedAt,
    createdAt: updated!.createdAt,
    updatedAt: updated!.updatedAt,
  };
}

export async function unarchiveHouseholdCategory(
  householdId: string,
  categoryId: string,
): Promise<HouseholdCategorySummary> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.householdId, householdId),
        eq(categories.id, categoryId),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new CategoryNotFoundError();
  }

  const [updated] = await db
    .update(categories)
    .set({
      archivedAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(categories.householdId, householdId),
        eq(categories.id, categoryId),
      ),
    )
    .returning();

  return {
    id: updated!.id,
    householdId: updated!.householdId,
    name: updated!.name,
    applicability: updated!.applicability as CategoryApplicability,
    archivedAt: updated!.archivedAt,
    createdAt: updated!.createdAt,
    updatedAt: updated!.updatedAt,
  };
}

export async function seedDefaultCategories(
  householdId: string,
): Promise<HouseholdCategorySummary[]> {
  const db = getDb();
  const created: HouseholdCategorySummary[] = [];

  for (const def of DEFAULT_POLISH_CATEGORIES) {
    const stableId = generateDefaultCategoryId(householdId, def.key);
    const [existing] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          eq(categories.householdId, householdId),
          eq(categories.name, def.name),
        ),
      )
      .limit(1);

    if (!existing) {
      const [inserted] = await db
        .insert(categories)
        .values({
          id: stableId,
          householdId,
          name: def.name,
          applicability: def.applicability,
          archivedAt: null,
        })
        .onConflictDoNothing()
        .returning();

      if (inserted) {
        created.push({
          id: inserted.id,
          householdId: inserted.householdId,
          name: inserted.name,
          applicability: inserted.applicability as CategoryApplicability,
          archivedAt: inserted.archivedAt,
          createdAt: inserted.createdAt,
          updatedAt: inserted.updatedAt,
        });
      }
    }
  }

  return created;
}
