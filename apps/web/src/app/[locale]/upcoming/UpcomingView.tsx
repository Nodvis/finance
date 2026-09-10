"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import type { AuthorizedHouseholdUserContext } from "@/lib/authorization/household";
import type {
  SerializedHouseholdObligation,
  SerializedUpcomingObligationsSummary,
} from "@/lib/obligations/schema";
import { minorToNatural } from "@/lib/obligations/presentation";
import { formatAmountPresentation } from "@/lib/transactions/presentation";

type Props = {
  householdContext: AuthorizedHouseholdUserContext;
  initialObligations: SerializedHouseholdObligation[];
  initialSummary: SerializedUpcomingObligationsSummary;
  locale: string;
  initialStatus?: string | undefined;
  initialCurrency?: string | undefined;
  initialSortOrder?: "asc" | "desc" | undefined;
};

type TabFilter =
  | "all"
  | "active"
  | "upcoming"
  | "overdue"
  | "history"
  | "paid"
  | "cancelled";

type CandidateTransaction = {
  id: string;
  payee: string | null;
  occurredOn: string;
  amountMinor: string;
  currency: string;
};

function formatCalendarDate(dateStr: string, locale: string): string {
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!year || !month || !day) return dateStr;
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

export function UpcomingView({
  householdContext,
  initialObligations,
  initialSummary,
  locale,
  initialStatus,
  initialCurrency,
  initialSortOrder,
}: Props) {
  const t = useTranslations("Obligations");
  const router = useRouter();
  const pathname = usePathname();

  const [obligations, setObligations] = useState(initialObligations);
  const [summary, setSummary] = useState(initialSummary);
  useEffect(() => {
    setObligations(initialObligations);
    setSummary(initialSummary);
  }, [initialObligations, initialSummary]);
  const [activeTab, setActiveTab] = useState<TabFilter>(() => {
    if (
      initialStatus &&
      [
        "all",
        "active",
        "upcoming",
        "overdue",
        "history",
        "paid",
        "cancelled",
      ].includes(initialStatus)
    ) {
      return initialStatus as TabFilter;
    }
    return "all";
  });
  const [selectedCurrency, setSelectedCurrency] = useState<string>(
    initialCurrency ?? "all",
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(
    initialSortOrder ?? "asc",
  );
  const [hasExplicitSort, setHasExplicitSort] = useState<boolean>(
    Boolean(initialSortOrder),
  );
  useEffect(() => {
    const nextStatus = [
      "all",
      "active",
      "upcoming",
      "overdue",
      "history",
      "paid",
      "cancelled",
    ].includes(initialStatus ?? "")
      ? (initialStatus as TabFilter)
      : "all";
    setActiveTab(nextStatus);
    setSelectedCurrency(initialCurrency ?? "all");
    setSortOrder(initialSortOrder ?? "asc");
    setHasExplicitSort(Boolean(initialSortOrder));
  }, [initialCurrency, initialSortOrder, initialStatus]);

  function updateFilters(next: {
    status?: TabFilter;
    currency?: string;
    sortOrder?: "asc" | "desc";
  }) {
    const params = new URLSearchParams();
    const nextStatus = next.status ?? activeTab;
    const nextCurrency = next.currency ?? selectedCurrency;
    const nextSortOrder = next.sortOrder ?? (hasExplicitSort ? sortOrder : undefined);

    if (nextStatus !== "all") params.set("status", nextStatus);
    if (nextCurrency !== "all") params.set("currency", nextCurrency);
    if (nextSortOrder) params.set("sortOrder", nextSortOrder);

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Create form state
  const [title, setTitle] = useState("");
  const [amountNatural, setAmountNatural] = useState("");
  const [currency, setCurrency] = useState(householdContext.defaultCurrency);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  // Edit form state
  const [editingObligation, setEditingObligation] =
    useState<SerializedHouseholdObligation | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAmountNatural, setEditAmountNatural] = useState("");
  const [editCurrency, setEditCurrency] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Matching dialog state
  const [matchingObligation, setMatchingObligation] =
    useState<SerializedHouseholdObligation | null>(null);
  const [candidates, setCandidates] = useState<CandidateTransaction[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [isCandidatesLoading, setIsCandidatesLoading] = useState(false);

  async function refreshSummary() {
    try {
      const res = await fetch(
        `/api/households/${householdContext.householdId}/obligations/summary`,
      );
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setSummary(json.data);
        }
      }
    } catch {
      // Non-critical background refresh failure
    }
  }

  const effectiveSortOrder = hasExplicitSort
    ? sortOrder
    : activeTab === "history" || activeTab === "paid" || activeTab === "cancelled"
      ? "desc"
      : "asc";

  const availableCurrencies = Array.from(
    new Set([
      householdContext.defaultCurrency,
      ...obligations.map((o) => o.currency),
    ]),
  )
    .filter(Boolean)
    .sort();

  const filteredObligations = obligations
    .filter((o) => {
      // Status filtering
      if (activeTab === "active") {
        if (o.status !== "upcoming" && o.status !== "overdue") return false;
      } else if (activeTab === "history") {
        if (o.status !== "paid" && o.status !== "cancelled") return false;
      } else if (activeTab !== "all") {
        if (o.status !== activeTab) return false;
      }

      // Currency filtering
      if (selectedCurrency !== "all" && o.currency !== selectedCurrency) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      const cmp = a.dueDate.localeCompare(b.dueDate);
      if (cmp !== 0) {
        return effectiveSortOrder === "asc" ? cmp : -cmp;
      }
      return effectiveSortOrder === "asc"
        ? a.id.localeCompare(b.id)
        : b.id.localeCompare(a.id);
    });

  const activeItems = filteredObligations.filter(
    (o) => o.status === "upcoming" || o.status === "overdue",
  );
  const historyItems = filteredObligations.filter(
    (o) => o.status === "paid" || o.status === "cancelled",
  );

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/households/${householdContext.householdId}/obligations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            amountNatural,
            currency,
            dueDate,
            notes: notes || null,
          }),
        },
      );
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? t("feedback.errorGeneric"));
      }

      setObligations((prev) => [json.data, ...prev]);
      setTitle("");
      setAmountNatural("");
      setDueDate("");
      setNotes("");
      setIsCreateOpen(false);
      setFeedback({ type: "success", text: t("feedback.createSuccess") });
      await refreshSummary();
      router.refresh();
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : t("feedback.errorGeneric"),
      });
    } finally {
      setPending(false);
    }
  }

  function startEditing(obligation: SerializedHouseholdObligation) {
    setEditingObligation(obligation);
    setEditTitle(obligation.title);
    setEditAmountNatural(minorToNatural(obligation.amountMinor, obligation.currency));
    setEditCurrency(obligation.currency);
    setEditDueDate(obligation.dueDate);
    setEditNotes(obligation.notes ?? "");
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingObligation) return;
    setPending(true);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/households/${householdContext.householdId}/obligations/${editingObligation.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            version: editingObligation.version,
            title: editTitle,
            amountNatural: editAmountNatural,
            currency: editCurrency,
            dueDate: editDueDate,
            notes: editNotes || null,
          }),
        },
      );
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? t("feedback.errorGeneric"));
      }

      setObligations((prev) =>
        prev.map((o) => (o.id === editingObligation.id ? json.data : o)),
      );
      setEditingObligation(null);
      setFeedback({ type: "success", text: t("feedback.updateSuccess") });
      await refreshSummary();
      router.refresh();
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : t("feedback.errorGeneric"),
      });
    } finally {
      setPending(false);
    }
  }

  async function openMatchDialog(obligation: SerializedHouseholdObligation) {
    setMatchingObligation(obligation);
    setCandidates([]);
    setSelectedCandidateId("");
    setIsCandidatesLoading(true);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/households/${householdContext.householdId}/obligations/${obligation.id}/candidates`,
      );
      const json = await response.json();
      if (response.ok && Array.isArray(json.data)) {
        setCandidates(json.data);
        if (json.data.length > 0) {
          setSelectedCandidateId(json.data[0].id);
        }
      }
    } catch {
      // Ignored
    } finally {
      setIsCandidatesLoading(false);
    }
  }

  async function handleConfirmMatch() {
    if (!matchingObligation || !selectedCandidateId) return;
    setPending(true);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/households/${householdContext.householdId}/obligations/${matchingObligation.id}/match`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            version: matchingObligation.version,
            transactionId: selectedCandidateId,
          }),
        },
      );
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? t("feedback.errorGeneric"));
      }

      setObligations((prev) =>
        prev.map((o) => (o.id === matchingObligation.id ? json.data : o)),
      );
      setMatchingObligation(null);
      setFeedback({ type: "success", text: t("feedback.matchSuccess") });
      await refreshSummary();
      router.refresh();
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : t("feedback.errorGeneric"),
      });
    } finally {
      setPending(false);
    }
  }

  async function handleUnlink(obligation: SerializedHouseholdObligation) {
    if (!window.confirm(t("actions.confirmUnlink"))) return;
    setPending(true);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/households/${householdContext.householdId}/obligations/${obligation.id}/unlink`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            version: obligation.version,
          }),
        },
      );
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? t("feedback.errorGeneric"));
      }

      setObligations((prev) =>
        prev.map((o) => (o.id === obligation.id ? json.data : o)),
      );
      setFeedback({ type: "success", text: t("feedback.unlinkSuccess") });
      await refreshSummary();
      router.refresh();
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : t("feedback.errorGeneric"),
      });
    } finally {
      setPending(false);
    }
  }

  async function handleCancel(obligation: SerializedHouseholdObligation) {
    const recurring = obligation.recurringDefinitionId !== null && obligation.recurringDefinitionId !== undefined;
    if (!window.confirm(t(recurring ? "actions.confirmSkip" : "actions.confirmCancel"))) return;
    setPending(true);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/households/${householdContext.householdId}/obligations/${obligation.id}/cancel`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            version: obligation.version,
          }),
        },
      );
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? t("feedback.errorGeneric"));
      }

      setObligations((prev) =>
        prev.map((o) => (o.id === obligation.id ? json.data : o)),
      );
      setFeedback({ type: "success", text: t(recurring ? "feedback.skipSuccess" : "feedback.cancelSuccess") });
      await refreshSummary();
      router.refresh();
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : t("feedback.errorGeneric"),
      });
    } finally {
      setPending(false);
    }
  }

  function renderCard(item: SerializedHouseholdObligation) {
    const isCancelled = item.cancelledAt !== null;
    const isPaid = item.status === "paid";
    const isEditable = !isCancelled && !isPaid;

    return (
      <article
        key={item.id}
        className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-colors hover:border-slate-300 dark:border-stone-800 dark:bg-stone-900/70 sm:flex-row sm:items-center"
      >
        {/* Info */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-900 dark:text-stone-100">
              {item.title}
            </h3>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                item.status === "upcoming"
                  ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                  : item.status === "overdue"
                    ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-400"
                    : item.status === "paid"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400"
                      : "border-slate-200 bg-slate-100 text-slate-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400"
              }`}
            >
              {t(`status.${item.status}`)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-stone-400">
            <div>
              <span className="font-medium text-slate-600 dark:text-stone-300">
                {t("item.dueDate")}:
              </span>{" "}
              {formatCalendarDate(item.dueDate, locale)}
            </div>
            {item.notes ? (
              <div>
                <span className="font-medium text-slate-600 dark:text-stone-300">
                  {t("item.notes")}:
                </span>{" "}
                {item.notes}
              </div>
            ) : null}
          </div>

          {/* Matched Transaction details (no raw IDs) */}
          {isPaid && item.matchedTransaction ? (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              {t("item.paidVia")}{" "}
              <span className="font-medium">
                {item.matchedTransaction.payee ?? "Expense"}
              </span>{" "}
              {t("item.onDate", {
                date: formatCalendarDate(
                  item.matchedTransaction.occurredOn.slice(0, 10),
                  locale,
                ),
              })}
            </p>
          ) : null}
        </div>

        {/* Amount & Actions */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 sm:flex-col sm:items-end">
          <p className="font-mono text-lg font-semibold tracking-tight text-slate-900 dark:text-stone-100">
            {formatAmountPresentation(
              item.amountMinor,
              item.currency,
              locale,
            )}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {/* Match button */}
            {!isPaid && !isCancelled ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => openMatchDialog(item)}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-400"
              >
                {t("actions.match")}
              </button>
            ) : null}

            {/* Unlink button */}
            {isPaid ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => handleUnlink(item)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
              >
                {t("actions.unlink")}
              </button>
            ) : null}

            {/* Edit button */}
            {isEditable ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => startEditing(item)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
              >
                {t("actions.edit")}
              </button>
            ) : null}

            {/* Cancel button */}
            {!isCancelled && !isPaid ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => handleCancel(item)}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 shadow-xs hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                {item.recurringDefinitionId ? t("actions.skip") : t("actions.cancel")}
              </button>
            ) : null}
          </div>
        </div>
      </article>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Page Header */}
      <header className="border-b border-slate-200 pb-5 dark:border-stone-800">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400">
          {t("eyebrow")}
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-stone-100 sm:text-3xl">
              {t("title")}
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-stone-400">
              {t("description")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400"
          >
            {t("addObligation")}
          </button>
        </div>
      </header>

      {/* Feedback Banner */}
      {feedback ? (
        <div
          role="status"
          className={`rounded-xl px-4 py-3 text-sm font-medium ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          {feedback.text}
        </div>
      ) : null}

      {/* Summary Cards */}
      <section
        aria-label={t("summaryTitle")}
        className="grid gap-4 sm:grid-cols-3"
      >
        {/* Upcoming Total */}
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-stone-800 dark:bg-stone-900/70">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-stone-400">
            {t("summary.upcomingTotal")}
          </p>
          <div className="mt-3 space-y-1">
            {summary.upcomingByCurrency.length > 0 ? (
              summary.upcomingByCurrency.map((curr) => (
                <p
                  key={curr.currency}
                  className="font-mono text-2xl font-semibold tracking-tight text-slate-900 dark:text-stone-100 sm:text-3xl"
                >
                  {formatAmountPresentation(
                    curr.totalMinor,
                    curr.currency,
                    locale,
                  )}
                </p>
              ))
            ) : (
              <p className="font-mono text-3xl font-semibold tracking-tight text-slate-900 dark:text-stone-100">
                —
              </p>
            )}
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-stone-400">
            {summary.upcomingCount} {t("tabs.upcoming").toLowerCase()}
          </p>
        </article>

        {/* Overdue Total */}
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-stone-800 dark:bg-stone-900/70">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-stone-400">
              {t("summary.overdueTotal")}
            </p>
            {summary.overdueCount > 0 ? (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-medium text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-950/60">
                {summary.overdueCount}
              </span>
            ) : null}
          </div>
          <div className="mt-3 space-y-1">
            {summary.overdueByCurrency.length > 0 ? (
              summary.overdueByCurrency.map((curr) => (
                <p
                  key={curr.currency}
                  className="font-mono text-2xl font-semibold tracking-tight text-amber-700 dark:text-amber-400 sm:text-3xl"
                >
                  {formatAmountPresentation(
                    curr.totalMinor,
                    curr.currency,
                    locale,
                  )}
                </p>
              ))
            ) : (
              <p className="font-mono text-3xl font-semibold tracking-tight text-slate-900 dark:text-stone-100">
                —
              </p>
            )}
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-stone-400">
            {summary.overdueCount > 0
              ? `${summary.overdueCount} ${t("tabs.overdue").toLowerCase()}`
              : t("summary.noOverdue")}
          </p>
        </article>

        {/* Paid Count */}
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-stone-800 dark:bg-stone-900/70">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-stone-400">
            {t("summary.paidTotal")}
          </p>
          <p className="mt-3 font-mono text-3xl font-semibold tracking-tight text-emerald-600 dark:text-emerald-400">
            {summary.paidCount}
          </p>
          <p className="mt-3 text-xs text-slate-500 dark:text-stone-400">
            {summary.paidCount} {t("tabs.paid").toLowerCase()}
          </p>
        </article>
      </section>

      {/* Tabs and Filters Bar */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 dark:border-stone-800">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-1">
            {(
              [
                "all",
                "active",
                "upcoming",
                "overdue",
                "history",
                "paid",
                "cancelled",
              ] as const
            ).map((tab) => {
              const active = activeTab === tab;
              const count =
                tab === "all"
                  ? obligations.length
                  : tab === "active"
                    ? obligations.filter(
                        (o) =>
                          o.status === "upcoming" || o.status === "overdue",
                      ).length
                    : tab === "history"
                      ? obligations.filter(
                          (o) =>
                            o.status === "paid" || o.status === "cancelled",
                        ).length
                      : obligations.filter((o) => o.status === tab).length;

              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab);
                    if (!hasExplicitSort) {
                      if (
                        tab === "history" ||
                        tab === "paid" ||
                        tab === "cancelled"
                      ) {
                        setSortOrder("desc");
                      } else {
                        setSortOrder("asc");
                      }
                    }
                    updateFilters({
                      status: tab,
                      sortOrder: hasExplicitSort
                        ? sortOrder
                        : tab === "history" || tab === "paid" || tab === "cancelled"
                          ? "desc"
                          : "asc",
                    });
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                    active
                      ? "bg-emerald-600 text-white dark:bg-emerald-500"
                      : "text-slate-600 hover:bg-slate-100 dark:text-stone-400 dark:hover:bg-stone-800"
                  }`}
                >
                  <span>{t(`tabs.${tab}`)}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                      active
                        ? "bg-white/20 text-white"
                        : "bg-slate-200 text-slate-700 dark:bg-stone-800 dark:text-stone-300"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Currency and Sorting Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Currency Filter */}
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="obligation-currency-filter"
                className="text-xs font-medium text-slate-500 dark:text-stone-400"
              >
                {t("filters.currency")}:
              </label>
              <select
                id="obligation-currency-filter"
                value={selectedCurrency}
                onChange={(e) => {
                  const nextCurrency = e.target.value;
                  setSelectedCurrency(nextCurrency);
                  updateFilters({ currency: nextCurrency });
                }}
                className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-emerald-500 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200"
              >
                <option value="all">{t("filters.allCurrencies")}</option>
                {availableCurrencies.map((curr) => (
                  <option key={curr} value={curr}>
                    {curr}
                  </option>
                ))}
              </select>
            </div>

            {/* Due Date Sort */}
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="obligation-sort-filter"
                className="text-xs font-medium text-slate-500 dark:text-stone-400"
              >
                {t("filters.sort")}:
              </label>
              <select
                id="obligation-sort-filter"
                value={effectiveSortOrder}
                onChange={(e) => {
                  const nextSortOrder = e.target.value as "asc" | "desc";
                  setSortOrder(nextSortOrder);
                  setHasExplicitSort(true);
                  updateFilters({ sortOrder: nextSortOrder });
                }}
                className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-emerald-500 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200"
              >
                <option value="asc">{t("filters.sortDueDateAsc")}</option>
                <option value="desc">{t("filters.sortDueDateDesc")}</option>
              </select>
            </div>

            {/* Reset Filters */}
            {activeTab !== "all" ||
            selectedCurrency !== "all" ||
            hasExplicitSort ? (
              <button
                type="button"
                onClick={() => {
                  setActiveTab("all");
                  setSelectedCurrency("all");
                  setHasExplicitSort(false);
                  setSortOrder("asc");
                  router.push(pathname);
                }}
                className="rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-stone-700 dark:text-stone-400 dark:hover:bg-stone-800"
              >
                {t("filters.resetFilters")}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Obligations List / Sections */}
      {filteredObligations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600 dark:border-stone-700 dark:text-stone-400">
          {selectedCurrency !== "all"
            ? t("empty.filtered")
            : t(`empty.${activeTab}`)}
        </div>
      ) : activeTab === "all" ? (
        <div className="flex flex-col gap-8">
          {/* Current / Active Section */}
          <section
            aria-label={t("sections.activeTitle")}
            className="space-y-3"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-stone-100">
                  {t("sections.activeTitle")}
                </h2>
                <p className="text-xs text-slate-500 dark:text-stone-400">
                  {t("sections.activeSubtitle")}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-stone-800 dark:text-stone-300">
                {activeItems.length}
              </span>
            </div>
            {activeItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500 dark:border-stone-800 dark:text-stone-400">
                {t("empty.active")}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {activeItems.map((item) => renderCard(item))}
              </div>
            )}
          </section>

          {/* History Section */}
          {historyItems.length > 0 && (
            <section
              aria-label={t("sections.historyTitle")}
              className="space-y-3 border-t border-slate-200 pt-6 dark:border-stone-800"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-stone-100">
                    {t("sections.historyTitle")}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-stone-400">
                    {t("sections.historySubtitle")}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-stone-800 dark:text-stone-300">
                  {historyItems.length}
                </span>
              </div>
              <div className="flex flex-col gap-3">
                {historyItems.map((item) => renderCard(item))}
              </div>
            </section>
          )}
        </div>
      ) : activeTab === "history" ||
        activeTab === "paid" ||
        activeTab === "cancelled" ? (
        <section
          aria-label={t("sections.historyTitle")}
          className="space-y-3"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-stone-100">
                {t(`tabs.${activeTab}`)}
              </h2>
              <p className="text-xs text-slate-500 dark:text-stone-400">
                {t("sections.historySubtitle")}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-stone-800 dark:text-stone-300">
              {filteredObligations.length}
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {filteredObligations.map((item) => renderCard(item))}
          </div>
        </section>
      ) : (
        <section
          aria-label={t("sections.activeTitle")}
          className="space-y-3"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-stone-100">
                {t(`tabs.${activeTab}`)}
              </h2>
              <p className="text-xs text-slate-500 dark:text-stone-400">
                {t("sections.activeSubtitle")}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-stone-800 dark:text-stone-300">
              {filteredObligations.length}
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {filteredObligations.map((item) => renderCard(item))}
          </div>
        </section>
      )}

      {/* Create Modal */}
      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-stone-800 dark:bg-stone-900">
            <h2 className="text-lg font-bold text-slate-900 dark:text-stone-100">
              {t("form.createTitle")}
            </h2>
            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label htmlFor="obligation-create-title" className="block text-xs font-medium text-slate-700 dark:text-stone-300">
                  {t("form.titleLabel")}
                </label>
                <input
                  id="obligation-create-title"
                  type="text"
                  required
                  maxLength={160}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("form.titlePlaceholder")}
                  className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="obligation-create-amount" className="block text-xs font-medium text-slate-700 dark:text-stone-300">
                    {t("form.amountLabel")}
                  </label>
                  <input
                    id="obligation-create-amount"
                    type="text"
                    required
                    inputMode="decimal"
                    value={amountNatural}
                    onChange={(e) => setAmountNatural(e.target.value)}
                    placeholder={t("form.amountPlaceholder")}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                  />
                </div>
                <div>
                  <label htmlFor="obligation-create-currency" className="block text-xs font-medium text-slate-700 dark:text-stone-300">
                    {t("form.currencyLabel")}
                  </label>
                  <input
                    id="obligation-create-currency"
                    type="text"
                    required
                    maxLength={3}
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="obligation-create-due-date" className="block text-xs font-medium text-slate-700 dark:text-stone-300">
                  {t("form.dueDateLabel")}
                </label>
                <input
                  id="obligation-create-due-date"
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                />
              </div>

              <div>
                <label htmlFor="obligation-create-notes" className="block text-xs font-medium text-slate-700 dark:text-stone-300">
                  {t("form.notesLabel")}
                </label>
                <input
                  id="obligation-create-notes"
                  type="text"
                  maxLength={280}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("form.notesPlaceholder")}
                  className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
                >
                  {t("form.cancelButton")}
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-400"
                >
                  {t("form.createButton")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Edit Modal */}
      {editingObligation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-stone-800 dark:bg-stone-900">
            <h2 className="text-lg font-bold text-slate-900 dark:text-stone-100">
              {t("form.editTitle")}
            </h2>
            <form onSubmit={handleUpdate} className="mt-4 space-y-4">
              <div>
                <label htmlFor="obligation-edit-title" className="block text-xs font-medium text-slate-700 dark:text-stone-300">
                  {t("form.titleLabel")}
                </label>
                <input
                  id="obligation-edit-title"
                  type="text"
                  required
                  maxLength={160}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="obligation-edit-amount" className="block text-xs font-medium text-slate-700 dark:text-stone-300">
                    {t("form.amountLabel")}
                  </label>
                  <input
                    id="obligation-edit-amount"
                    type="text"
                    required
                    inputMode="decimal"
                    value={editAmountNatural}
                    onChange={(e) => setEditAmountNatural(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                  />
                </div>
                <div>
                  <label htmlFor="obligation-edit-currency" className="block text-xs font-medium text-slate-700 dark:text-stone-300">
                    {t("form.currencyLabel")}
                  </label>
                  <input
                    id="obligation-edit-currency"
                    type="text"
                    required
                    maxLength={3}
                    value={editCurrency}
                    onChange={(e) =>
                      setEditCurrency(e.target.value.toUpperCase())
                    }
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="obligation-edit-due-date" className="block text-xs font-medium text-slate-700 dark:text-stone-300">
                  {t("form.dueDateLabel")}
                </label>
                <input
                  id="obligation-edit-due-date"
                  type="date"
                  required
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                />
              </div>

              <div>
                <label htmlFor="obligation-edit-notes" className="block text-xs font-medium text-slate-700 dark:text-stone-300">
                  {t("form.notesLabel")}
                </label>
                <input
                  id="obligation-edit-notes"
                  type="text"
                  maxLength={280}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setEditingObligation(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
                >
                  {t("form.cancelButton")}
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-400"
                >
                  {t("form.saveButton")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Match Candidates Dialog */}
      {matchingObligation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-stone-800 dark:bg-stone-900">
            <h2 className="text-lg font-bold text-slate-900 dark:text-stone-100">
              {t("matching.title")}
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-stone-400">
              {t("matching.description")}
            </p>

            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-stone-800 dark:bg-stone-800/60">
              <p className="text-xs font-semibold text-slate-900 dark:text-stone-100">
                {matchingObligation.title}
              </p>
              <p className="font-mono text-sm font-semibold text-slate-700 dark:text-stone-300">
                {formatAmountPresentation(
                  matchingObligation.amountMinor,
                  matchingObligation.currency,
                  locale,
                )}
              </p>
            </div>

            <div className="mt-4">
              {isCandidatesLoading ? (
                <p className="py-4 text-center text-xs text-slate-500 dark:text-stone-400">
                  {t("matching.loadingCandidates")}
                </p>
              ) : candidates.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-600 dark:text-stone-400">
                  {t("matching.noCandidates")}
                </p>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-stone-300">
                    {t("matching.selectCandidate")}
                  </label>
                  <select
                    value={selectedCandidateId}
                    onChange={(e) => setSelectedCandidateId(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                  >
                    {candidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.payee ?? t("matching.expenseFallback")} ·{" "}
                        {formatCalendarDate(c.occurredOn.slice(0, 10), locale)}{" "}
                        ·{" "}
                        {formatAmountPresentation(
                          c.amountMinor,
                          c.currency,
                          locale,
                        )}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setMatchingObligation(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
              >
                {t("matching.close")}
              </button>
              {candidates.length > 0 ? (
                <button
                  type="button"
                  disabled={pending || !selectedCandidateId}
                  onClick={handleConfirmMatch}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-400"
                >
                  {pending ? t("matching.matching") : t("matching.confirmMatch")}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
