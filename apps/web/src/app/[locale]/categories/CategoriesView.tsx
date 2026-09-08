"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import type { HouseholdAccessSummary } from "@nodvis/finance-db";
import type { CategoryApplicability } from "@nodvis/finance-domain";
import type { SerializedCategory } from "@/lib/categories/schema";
import type { AuthorizedHouseholdUserContext } from "@/lib/authorization/household";
import { SignOutButton } from "../components/SignOutButton";

const APPLICABILITY_OPTIONS: CategoryApplicability[] = ["expense", "income", "both"];

type CategoriesViewProps = {
  householdContext: AuthorizedHouseholdUserContext;
  allHouseholds: HouseholdAccessSummary[];
  initialCategories: SerializedCategory[];
  locale: string;
};

export function CategoriesView({
  householdContext,
  allHouseholds,
  initialCategories,
  locale: _locale,
}: CategoriesViewProps) {
  const tCategories = useTranslations("Categories");
  const tHousehold = useTranslations("Household");
  const tSelection = useTranslations("HouseholdSelection");
  const tAccess = useTranslations("Accessibility");
  const router = useRouter();

  const [categories, setCategories] = useState<SerializedCategory[]>(initialCategories);
  const [showArchived, setShowArchived] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingCategory, setEditingCategory] = useState<SerializedCategory | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [isSwitchingHousehold, setIsSwitchingHousehold] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Form states for creating category
  const [name, setName] = useState("");
  const [applicability, setApplicability] = useState<CategoryApplicability>("expense");
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Form states for editing category
  const [editName, setEditName] = useState("");
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const activeCategories = categories.filter((c) => c.archivedAt === null);
  const archivedCategories = categories.filter((c) => c.archivedAt !== null);

  const handleSwitchHousehold = async (targetHouseholdId: string) => {
    try {
      setIsSwitchingHousehold(true);
      const res = await fetch("/api/households/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ householdId: targetHouseholdId }),
      });
      if (res.ok) {
        router.refresh();
      }
    } catch {
      // Ignore
    } finally {
      setIsSwitchingHousehold(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setStatusMessage({
        type: "error",
        text: tCategories("form.errorNameRequired"),
      });
      return;
    }

    setIsSubmittingCreate(true);
    setStatusMessage(null);

    try {
      const payload = {
        name: trimmedName,
        applicability,
      };

      const res = await fetch(
        `/api/households/${householdContext.householdId}/categories`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const json = await res.json();
      if (!res.ok) {
        setStatusMessage({
          type: "error",
          text: json.error || tCategories("form.errorGeneric"),
        });
      } else {
        setCategories((prev) => [...prev, json.data]);
        setName("");
        setApplicability("expense");
        setIsCreating(false);
        setStatusMessage({
          type: "success",
          text: tCategories("form.successAdd"),
        });
        router.refresh();
      }
    } catch {
      setStatusMessage({
        type: "error",
        text: tCategories("form.errorGeneric"),
      });
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const startEdit = (cat: SerializedCategory) => {
    setEditingCategory(cat);
    setEditName(cat.name);
    setStatusMessage(null);
  };

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingCategory) return;

    const trimmedName = editName.trim();
    if (!trimmedName) {
      setStatusMessage({
        type: "error",
        text: tCategories("form.errorNameRequired"),
      });
      return;
    }

    setIsSubmittingEdit(true);
    setStatusMessage(null);

    try {
      const payload = {
        name: trimmedName,
      };

      const res = await fetch(
        `/api/households/${householdContext.householdId}/categories/${editingCategory.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const json = await res.json();
      if (!res.ok) {
        setStatusMessage({
          type: "error",
          text: json.error || tCategories("form.errorGeneric"),
        });
      } else {
        setCategories((prev) =>
          prev.map((c) => (c.id === editingCategory.id ? json.data : c)),
        );
        setEditingCategory(null);
        setStatusMessage({
          type: "success",
          text: tCategories("form.successEdit"),
        });
        router.refresh();
      }
    } catch {
      setStatusMessage({
        type: "error",
        text: tCategories("form.errorGeneric"),
      });
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleArchive = async (categoryId: string) => {
    if (!window.confirm(tCategories("archiveConfirm"))) {
      return;
    }

    setActionLoadingId(categoryId);
    setStatusMessage(null);

    try {
      const res = await fetch(
        `/api/households/${householdContext.householdId}/categories/${categoryId}/archive`,
        { method: "POST" },
      );
      const json = await res.json();
      if (!res.ok) {
        setStatusMessage({
          type: "error",
          text: json.error || tCategories("form.errorGeneric"),
        });
      } else {
        setCategories((prev) =>
          prev.map((c) => (c.id === categoryId ? json.data : c)),
        );
        setStatusMessage({
          type: "success",
          text: tCategories("form.successArchive"),
        });
        router.refresh();
      }
    } catch {
      setStatusMessage({
        type: "error",
        text: tCategories("form.errorGeneric"),
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUnarchive = async (categoryId: string) => {
    setActionLoadingId(categoryId);
    setStatusMessage(null);

    try {
      const res = await fetch(
        `/api/households/${householdContext.householdId}/categories/${categoryId}/unarchive`,
        { method: "POST" },
      );
      const json = await res.json();
      if (!res.ok) {
        setStatusMessage({
          type: "error",
          text: json.error || tCategories("form.errorGeneric"),
        });
      } else {
        setCategories((prev) =>
          prev.map((c) => (c.id === categoryId ? json.data : c)),
        );
        setStatusMessage({
          type: "success",
          text: tCategories("form.successUnarchive"),
        });
        router.refresh();
      }
    } catch {
      setStatusMessage({
        type: "error",
        text: tCategories("form.errorGeneric"),
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const renderApplicabilityBadge = (app: CategoryApplicability) => {
    switch (app) {
      case "expense":
        return (
          <span className="inline-flex items-center rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-300">
            {tCategories("badges.expense")}
          </span>
        );
      case "income":
        return (
          <span className="inline-flex items-center rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300">
            {tCategories("badges.income")}
          </span>
        );
      case "both":
        return (
          <span className="inline-flex items-center rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-300">
            {tCategories("badges.both")}
          </span>
        );
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Context bar */}
      <section
        aria-label={tHousehold("label")}
        className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-stone-800 bg-stone-900/60 p-4 backdrop-blur-sm"
      >
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-stone-300">
              {tHousehold("label")}
            </p>
            <p className="text-sm font-semibold text-stone-100">
              {householdContext.householdName}
            </p>
          </div>
          <div className="h-8 w-px bg-stone-800 hidden sm:block" />
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-stone-300">
              {tHousehold("member")}
            </p>
            <p className="text-sm font-medium text-stone-300">
              {householdContext.personDisplayName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {allHouseholds.length > 1 && (
            <div className="flex items-center gap-2">
              <label
                htmlFor="household-select"
                className="text-xs text-stone-400 sr-only"
              >
                {tSelection("switchButton")}
              </label>
              <select
                id="household-select"
                disabled={isSwitchingHousehold}
                value={householdContext.householdId}
                onChange={(e) => handleSwitchHousehold(e.target.value)}
                className="rounded-lg border border-stone-700 bg-stone-800 px-3 py-1.5 text-xs text-stone-200 transition focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500 disabled:opacity-50"
              >
                {allHouseholds.map((h) => (
                  <option key={h.householdId} value={h.householdId}>
                    {h.householdName}
                  </option>
                ))}
              </select>
            </div>
          )}
          <SignOutButton />
        </div>
      </section>

      {/* Header section */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">
            {tCategories("eyebrow")}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-stone-100 sm:text-3xl">
            {tCategories("title")}
          </h1>
          <p className="mt-1 text-sm text-stone-400">
            {tCategories("description")}
          </p>
        </div>

        <div>
          <button
            type="button"
            onClick={() => {
              setIsCreating((prev) => !prev);
              setEditingCategory(null);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-stone-100 px-4 py-2 text-xs font-semibold text-stone-900 transition hover:bg-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-400"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d={isCreating ? "M6 18L18 6M6 6l12 12" : "M12 4v16m8-8H4"}
              />
            </svg>
            {isCreating
              ? tCategories("actions.cancel")
              : tCategories("actions.addCategory")}
          </button>
        </div>
      </header>

      {/* Status banner */}
      {statusMessage && (
        <div
          role="alert"
          className={`flex items-center justify-between rounded-lg p-3 text-xs font-medium ${
            statusMessage.type === "success"
              ? "border border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
              : "border border-rose-500/30 bg-rose-950/40 text-rose-300"
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="ml-4 text-stone-400 hover:text-stone-200"
            aria-label="Dismiss message"
          >
            ✕
          </button>
        </div>
      )}

      {/* Create form card */}
      {isCreating && (
        <section
          aria-label={tAccess("createCategoryForm")}
          className="rounded-xl border border-stone-700 bg-stone-900/80 p-6 shadow-sm backdrop-blur-sm"
        >
          <h2 className="text-base font-semibold text-stone-100 mb-4">
            {tCategories("actions.addCategory")}
          </h2>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="create-category-name"
                  className="block text-xs font-medium text-stone-300 mb-1"
                >
                  {tCategories("form.name")}{" "}
                  <span className="text-rose-400">*</span>
                </label>
                <input
                  id="create-category-name"
                  type="text"
                  required
                  maxLength={160}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={tCategories("form.namePlaceholder")}
                  className="w-full rounded-lg border border-stone-700 bg-stone-800 px-3 py-2 text-sm text-stone-100 placeholder-stone-500 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
                />
              </div>

              <div>
                <label
                  htmlFor="create-category-applicability"
                  className="block text-xs font-medium text-stone-300 mb-1"
                >
                  {tCategories("form.applicability")}
                </label>
                <select
                  id="create-category-applicability"
                  value={applicability}
                  onChange={(e) =>
                    setApplicability(e.target.value as CategoryApplicability)
                  }
                  className="w-full rounded-lg border border-stone-700 bg-stone-800 px-3 py-2 text-sm text-stone-100 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
                >
                  {APPLICABILITY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {tCategories(`applicability.${opt}`)}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-stone-500">
                  {tCategories("form.applicabilityHelp")}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="rounded-lg border border-stone-700 px-4 py-2 text-xs font-semibold text-stone-300 hover:bg-stone-800"
              >
                {tCategories("actions.cancel")}
              </button>
              <button
                type="submit"
                disabled={isSubmittingCreate}
                className="rounded-lg bg-stone-100 px-4 py-2 text-xs font-semibold text-stone-900 hover:bg-stone-200 disabled:opacity-50"
              >
                {isSubmittingCreate
                  ? tCategories("form.submittingAdd")
                  : tCategories("form.submitAdd")}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Edit category modal/card */}
      {editingCategory && (
        <section
          aria-label={tAccess("editCategoryForm")}
          className="rounded-xl border border-stone-700 bg-stone-900/80 p-6 shadow-sm backdrop-blur-sm"
        >
          <h2 className="text-base font-semibold text-stone-100 mb-4">
            {tCategories("actions.edit")}
          </h2>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="edit-category-name"
                className="block text-xs font-medium text-stone-300 mb-1"
              >
                {tCategories("form.name")}{" "}
                <span className="text-rose-400">*</span>
              </label>
              <input
                id="edit-category-name"
                type="text"
                required
                maxLength={160}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder={tCategories("form.namePlaceholder")}
                className="w-full rounded-lg border border-stone-700 bg-stone-800 px-3 py-2 text-sm text-stone-100 placeholder-stone-500 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="rounded-lg border border-stone-700 px-4 py-2 text-xs font-semibold text-stone-300 hover:bg-stone-800"
              >
                {tCategories("actions.cancel")}
              </button>
              <button
                type="submit"
                disabled={isSubmittingEdit}
                className="rounded-lg bg-stone-100 px-4 py-2 text-xs font-semibold text-stone-900 hover:bg-stone-200 disabled:opacity-50"
              >
                {isSubmittingEdit
                  ? tCategories("actions.saving")
                  : tCategories("actions.save")}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Active categories section */}
      <section
        aria-label={tAccess("categoriesList")}
        className="flex flex-col gap-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-stone-200">
              {tCategories("activeCategories")}
            </h2>
            <span className="rounded-full border border-stone-800 bg-stone-900/60 px-2 py-0.5 text-xs font-medium text-stone-400">
              {activeCategories.length}
            </span>
          </div>
        </div>

        {activeCategories.length === 0 ? (
          <div className="rounded-xl border border-stone-800/80 bg-stone-900/30 p-8 text-center">
            <h3 className="text-sm font-semibold text-stone-200">
              {tCategories("emptyActiveTitle")}
            </h3>
            <p className="mt-1 text-xs text-stone-400">
              {tCategories("emptyActiveDescription")}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-stone-800 bg-stone-900/40">
            <ul className="divide-y divide-stone-800/80">
              {activeCategories.map((category) => (
                <li
                  key={category.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 transition-colors hover:bg-stone-850/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-stone-100">
                      {category.name}
                    </span>
                    {renderApplicabilityBadge(category.applicability)}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(category)}
                      className="rounded-md border border-stone-700/80 bg-stone-800/80 px-2.5 py-1 text-xs font-medium text-stone-300 transition hover:bg-stone-700 hover:text-stone-100 focus:outline-none focus:ring-1 focus:ring-stone-400"
                    >
                      {tCategories("actions.edit")}
                    </button>
                    <button
                      type="button"
                      disabled={actionLoadingId === category.id}
                      onClick={() => handleArchive(category.id)}
                      className="rounded-md border border-stone-700/80 bg-stone-800/80 px-2.5 py-1 text-xs font-medium text-rose-300 transition hover:bg-rose-950/40 hover:border-rose-700/50 hover:text-rose-200 focus:outline-none focus:ring-1 focus:ring-rose-400 disabled:opacity-50"
                    >
                      {actionLoadingId === category.id
                        ? tCategories("actions.archiving")
                        : tCategories("actions.archive")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Archived categories section */}
      {archivedCategories.length > 0 && (
        <section
          aria-label={tAccess("archivedCategoriesList")}
          className="flex flex-col gap-4 pt-4 border-t border-stone-800"
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowArchived((prev) => !prev)}
              className="text-xs font-medium text-stone-400 hover:text-stone-200 focus:outline-none underline underline-offset-4"
            >
              {showArchived
                ? tCategories("hideArchived")
                : tCategories("showArchived", { count: archivedCategories.length })}
            </button>
          </div>

          {showArchived && (
            <div className="overflow-hidden rounded-xl border border-stone-800/80 bg-stone-900/20">
              <ul className="divide-y divide-stone-800/60">
                {archivedCategories.map((category) => (
                  <li
                    key={category.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 opacity-75 hover:opacity-100 transition-opacity"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-stone-400 line-through">
                        {category.name}
                      </span>
                      {renderApplicabilityBadge(category.applicability)}
                      <span className="inline-flex items-center rounded-md border border-stone-700 bg-stone-800 px-2 py-0.5 text-xs font-medium text-stone-400">
                        {tCategories("badges.archived")}
                      </span>
                    </div>

                    <div>
                      <button
                        type="button"
                        disabled={actionLoadingId === category.id}
                        onClick={() => handleUnarchive(category.id)}
                        className="rounded-md border border-stone-700/80 bg-stone-800/80 px-2.5 py-1 text-xs font-medium text-stone-300 transition hover:bg-stone-700 hover:text-stone-100 focus:outline-none focus:ring-1 focus:ring-stone-400 disabled:opacity-50"
                      >
                        {actionLoadingId === category.id
                          ? tCategories("actions.unarchiving")
                          : tCategories("actions.unarchive")}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
