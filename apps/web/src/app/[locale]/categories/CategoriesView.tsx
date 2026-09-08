"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import type { HouseholdAccessSummary } from "@nodvis/finance-db";
import type { CategoryApplicability } from "@nodvis/finance-domain";
import type { SerializedCategory } from "@/lib/categories/schema";
import type { AuthorizedHouseholdUserContext } from "@/lib/authorization/household";

const APPLICABILITY_OPTIONS: CategoryApplicability[] = ["expense", "income", "both"];

type CategoriesViewProps = {
  householdContext: AuthorizedHouseholdUserContext;
  allHouseholds: HouseholdAccessSummary[];
  initialCategories: SerializedCategory[];
  locale: string;
};

export function CategoriesView({
  householdContext,
  initialCategories,
  locale: _locale,
}: CategoriesViewProps) {
  const tCategories = useTranslations("Categories");
  const tAccess = useTranslations("Accessibility");
  const router = useRouter();

  const [categories, setCategories] = useState<SerializedCategory[]>(initialCategories);
  const [showArchived, setShowArchived] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingCategory, setEditingCategory] = useState<SerializedCategory | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
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
          <span className="inline-flex items-center rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            {tCategories("badges.expense")}
          </span>
        );
      case "income":
        return (
          <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
            {tCategories("badges.income")}
          </span>
        );
      case "both":
        return (
          <span className="inline-flex items-center rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300">
            {tCategories("badges.both")}
          </span>
        );
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          {tCategories("eyebrow")}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-stone-100 sm:text-3xl">
          {tCategories("title")}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-stone-400">
          {tCategories("description")}
        </p>
      </div>

      {/* Status banner */}
      {statusMessage && (
        <div
          role="alert"
          className={`flex items-center justify-between rounded-lg border p-3 text-sm ${
            statusMessage.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/80 dark:bg-emerald-950/60 dark:text-emerald-200"
              : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/80 dark:bg-rose-950/60 dark:text-rose-200"
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="ml-4 text-xs font-semibold hover:opacity-75 focus:outline-none"
            aria-label="Dismiss message"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300">
            {tCategories("activeCategories")}:{" "}
            <strong className="font-semibold text-slate-900 dark:text-stone-100">
              {activeCategories.length}
            </strong>
          </span>
          {archivedCategories.length > 0 && (
            <button
              type="button"
              onClick={() => setShowArchived(!showArchived)}
              className="text-xs text-slate-500 underline underline-offset-4 transition-colors hover:text-slate-800 focus:outline-none dark:text-stone-400 dark:hover:text-stone-200"
            >
              {showArchived
                ? tCategories("hideArchived")
                : tCategories("showArchived", { count: archivedCategories.length })}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setIsCreating(true);
            setEditingCategory(null);
            setStatusMessage(null);
          }}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-emerald-500 dark:text-stone-950 dark:hover:bg-emerald-400"
        >
          + {tCategories("actions.addCategory")}
        </button>
      </div>

      {/* Focused Create Category Modal / Dialog */}
      {isCreating && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={tAccess("createCategoryForm")}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs overflow-y-auto dark:bg-black/60"
        >
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-stone-800 dark:bg-stone-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-stone-800">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-stone-100">
                {tCategories("actions.addCategory")}
              </h2>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-xs text-slate-400 hover:text-slate-700 transition-colors focus:outline-none dark:text-stone-400 dark:hover:text-stone-200"
              >
                {tCategories("actions.cancel")}
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="create-category-name"
                  className="block text-sm font-medium text-slate-700 dark:text-stone-300"
                >
                  {tCategories("form.name")}{" "}
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  id="create-category-name"
                  type="text"
                  required
                  maxLength={160}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={tCategories("form.namePlaceholder")}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500"
                />
              </div>

              <div>
                <label
                  htmlFor="create-category-applicability"
                  className="block text-sm font-medium text-slate-700 dark:text-stone-300"
                >
                  {tCategories("form.applicability")}
                </label>
                <select
                  id="create-category-applicability"
                  value={applicability}
                  onChange={(e) =>
                    setApplicability(e.target.value as CategoryApplicability)
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
                >
                  {APPLICABILITY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {tCategories(`applicability.${opt}`)}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500 dark:text-stone-400">
                  {tCategories("form.applicabilityHelp")}
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
                >
                  {tCategories("actions.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 dark:bg-emerald-500 dark:text-stone-950 dark:hover:bg-emerald-400"
                >
                  {isSubmittingCreate
                    ? tCategories("form.submittingAdd")
                    : tCategories("form.submitAdd")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Focused Edit Category Modal / Dialog */}
      {editingCategory && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={tAccess("editCategoryForm")}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs overflow-y-auto dark:bg-black/60"
        >
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-stone-800 dark:bg-stone-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-stone-800">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-stone-100">
                {tCategories("actions.edit")}
              </h2>
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="text-xs text-slate-400 hover:text-slate-700 transition-colors focus:outline-none dark:text-stone-400 dark:hover:text-stone-200"
              >
                {tCategories("actions.cancel")}
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="edit-category-name"
                  className="block text-sm font-medium text-slate-700 dark:text-stone-300"
                >
                  {tCategories("form.name")}{" "}
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  id="edit-category-name"
                  type="text"
                  required
                  maxLength={160}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={tCategories("form.namePlaceholder")}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
                >
                  {tCategories("actions.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 dark:bg-emerald-500 dark:text-stone-950 dark:hover:bg-emerald-400"
                >
                  {isSubmittingEdit
                    ? tCategories("actions.saving")
                    : tCategories("actions.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Active categories section */}
      <section
        aria-label={tAccess("categoriesList")}
        className="flex flex-col gap-4"
      >
        {activeCategories.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center dark:border-stone-800 dark:bg-stone-900/30">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-stone-200">
              {tCategories("emptyActiveTitle")}
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-stone-400">
              {tCategories("emptyActiveDescription")}
            </p>
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="mt-4 inline-flex items-center rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-500 focus:outline-none dark:bg-emerald-500 dark:text-stone-950 dark:hover:bg-emerald-400"
            >
              + {tCategories("actions.addCategory")}
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-stone-800 dark:bg-stone-900/40">
            <ul className="divide-y divide-slate-100 dark:divide-stone-800/80">
              {activeCategories.map((category) => (
                <li
                  key={category.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 transition-colors hover:bg-slate-50/60 dark:hover:bg-stone-800/40"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-900 dark:text-stone-100">
                      {category.name}
                    </span>
                    {renderApplicabilityBadge(category.applicability)}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(category)}
                      className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-xs transition hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-slate-400 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700 dark:hover:text-stone-100"
                    >
                      {tCategories("actions.edit")}
                    </button>
                    <button
                      type="button"
                      disabled={actionLoadingId === category.id}
                      onClick={() => handleArchive(category.id)}
                      className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-rose-600 shadow-xs transition hover:border-rose-200 hover:bg-rose-50 focus:outline-none focus:ring-1 focus:ring-rose-400 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-rose-400 dark:hover:bg-rose-950/40 dark:hover:border-rose-900"
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
      {archivedCategories.length > 0 && showArchived && (
        <section
          aria-label={tAccess("archivedCategoriesList")}
          className="flex flex-col gap-4 pt-4 border-t border-slate-200 dark:border-stone-800"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-stone-300">
              {tCategories("archivedCategories")}
            </h2>
            <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-400">
              {archivedCategories.length}
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50 dark:border-stone-800/80 dark:bg-stone-900/20">
            <ul className="divide-y divide-slate-200/60 dark:divide-stone-800/60">
              {archivedCategories.map((category) => (
                <li
                  key={category.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 opacity-75 hover:opacity-100 transition-opacity"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-500 line-through dark:text-stone-400">
                      {category.name}
                    </span>
                    {renderApplicabilityBadge(category.applicability)}
                    <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400">
                      {tCategories("badges.archived")}
                    </span>
                  </div>

                  <div>
                    <button
                      type="button"
                      disabled={actionLoadingId === category.id}
                      onClick={() => handleUnarchive(category.id)}
                      className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-xs transition hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700 dark:hover:text-stone-100"
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
        </section>
      )}
    </div>
  );
}
