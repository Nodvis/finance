import { createHash } from "node:crypto";
import type { CategoryId, HouseholdId } from "./identity";
import type { TransactionKind } from "./transaction";

export const CATEGORY_APPLICABILITIES = ["expense", "income", "both"] as const;
export type CategoryApplicability = (typeof CATEGORY_APPLICABILITIES)[number];

export type Category = Readonly<{
  id: CategoryId;
  householdId: HouseholdId;
  name: string;
  applicability: CategoryApplicability;
  archivedAt: Date | null;
}>;

export type DefaultCategoryDefinition = Readonly<{
  key: string;
  name: string;
  applicability: CategoryApplicability;
}>;

export const DEFAULT_POLISH_CATEGORIES: readonly DefaultCategoryDefinition[] =
  Object.freeze([
    Object.freeze({
      key: "groceries",
      name: "Jedzenie i zakupy codzienne",
      applicability: "expense" as const,
    }),
    Object.freeze({
      key: "housing",
      name: "Mieszkanie i rachunki",
      applicability: "expense" as const,
    }),
    Object.freeze({
      key: "transport",
      name: "Transport i paliwo",
      applicability: "expense" as const,
    }),
    Object.freeze({
      key: "health",
      name: "Zdrowie i uroda",
      applicability: "expense" as const,
    }),
    Object.freeze({
      key: "entertainment",
      name: "Rozrywka i wypoczynek",
      applicability: "expense" as const,
    }),
    Object.freeze({
      key: "clothing",
      name: "Ubrania i obuwie",
      applicability: "expense" as const,
    }),
    Object.freeze({
      key: "other_expenses",
      name: "Inne wydatki",
      applicability: "expense" as const,
    }),
    Object.freeze({
      key: "salary",
      name: "Wynagrodzenie i praca",
      applicability: "income" as const,
    }),
    Object.freeze({
      key: "benefits",
      name: "Świadczenia i zasiłki",
      applicability: "income" as const,
    }),
    Object.freeze({
      key: "other_income",
      name: "Inne przychody",
      applicability: "income" as const,
    }),
    Object.freeze({
      key: "settlements",
      name: "Zwroty i rozliczenia",
      applicability: "both" as const,
    }),
  ]);

export function categoryApplicability(value: string): CategoryApplicability {
  if (!CATEGORY_APPLICABILITIES.includes(value as CategoryApplicability)) {
    throw new Error(`Invalid category applicability: ${value}`);
  }
  return value as CategoryApplicability;
}

export function createCategory(input: {
  id: CategoryId;
  householdId: HouseholdId;
  name: string;
  applicability: CategoryApplicability | string;
  archivedAt?: Date | null;
}): Category {
  const name = input.name.trim();
  if (name.length === 0 || name.length > 160) {
    throw new Error("Invalid category name: must be 1 to 160 characters");
  }

  const applicability = categoryApplicability(input.applicability);
  const archivedAt = input.archivedAt ? new Date(input.archivedAt) : null;
  if (archivedAt && Number.isNaN(archivedAt.getTime())) {
    throw new Error("Invalid category archived timestamp");
  }

  return Object.freeze({
    id: input.id,
    householdId: input.householdId,
    name,
    applicability,
    archivedAt,
  });
}

export function renameCategory(category: Category, newName: string): Category {
  const name = newName.trim();
  if (name.length === 0 || name.length > 160) {
    throw new Error("Invalid category name: must be 1 to 160 characters");
  }
  return Object.freeze({
    ...category,
    name,
  });
}

export function archiveCategory(
  category: Category,
  archivedAt: Date = new Date(),
): Category {
  if (category.archivedAt) {
    return category;
  }
  return Object.freeze({
    ...category,
    archivedAt: new Date(archivedAt),
  });
}

export function unarchiveCategory(category: Category): Category {
  if (!category.archivedAt) {
    return category;
  }
  return Object.freeze({
    ...category,
    archivedAt: null,
  });
}

export function isCategoryArchived(category: Category): boolean {
  return category.archivedAt !== null;
}

export function isCategoryApplicableToKind(
  applicability: CategoryApplicability,
  kind: TransactionKind,
): boolean {
  if (kind === "expense") {
    return applicability === "expense" || applicability === "both";
  }
  if (kind === "income") {
    return applicability === "income" || applicability === "both";
  }
  return false;
}

export function generateDefaultCategoryId(
  householdId: string,
  categoryKey: string,
): string {
  const hash = createHash("sha256")
    .update(`${householdId}:${categoryKey}`)
    .digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
