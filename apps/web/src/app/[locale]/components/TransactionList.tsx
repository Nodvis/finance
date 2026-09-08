"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import type {
  HouseholdAccountSummary,
  HouseholdCategorySummary,
} from "@nodvis/finance-db";
import { parseNaturalDecimalToMinor } from "@/lib/transactions/money-entry";
import {
  formatAmountPresentation,
  minorUnitsToDecimalString,
} from "@/lib/transactions/presentation";
import type { SerializedTransaction } from "@/lib/transactions/schema";

type TransactionListProps = {
  transactions: SerializedTransaction[];
  accounts: HouseholdAccountSummary[];
  categories?: HouseholdCategorySummary[];
  locale: string;
  householdId?: string;
};

type FilterTab = "active" | "voided";

export function TransactionList({
  transactions,
  accounts,
  categories = [],
  locale,
  householdId,
}: TransactionListProps) {
  const t = useTranslations("Transactions");
  const tActions = useTranslations("Transactions.actions");
  const tDetails = useTranslations("Transactions.details");
  const tEdit = useTranslations("Transactions.edit");
  const tVoid = useTranslations("Transactions.void");
  const tAccess = useTranslations("Accessibility");
  const router = useRouter();

  const [filter, setFilter] = useState<FilterTab>("active");
  const [inspectTx, setInspectTx] = useState<SerializedTransaction | null>(null);
  const [editTx, setEditTx] = useState<SerializedTransaction | null>(null);
  const [voidTx, setVoidTx] = useState<SerializedTransaction | null>(null);

  // Edit form state
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editAccountId, setEditAccountId] = useState("");
  const [editFromAccountId, setEditFromAccountId] = useState("");
  const [editToAccountId, setEditToAccountId] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editPayee, setEditPayee] = useState("");
  const [editSource, setEditSource] = useState("");

  // Void form state
  const [voidReason, setVoidReason] = useState("");

  // Common form error and pending state
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const accountMap = useMemo(
    () => new Map(accounts.map((acc) => [acc.id, acc])),
    [accounts],
  );
  const categoryMap = useMemo(
    () => new Map(categories.map((cat) => [cat.id, cat])),
    [categories],
  );

  const activeTransactions = useMemo(
    () => transactions.filter((tx) => !tx.voidedAt),
    [transactions],
  );
  const voidedTransactions = useMemo(
    () => transactions.filter((tx) => !!tx.voidedAt),
    [transactions],
  );

  const displayedTransactions =
    filter === "active" ? activeTransactions : voidedTransactions;

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setInspectTx(null);
        setEditTx(null);
        setVoidTx(null);
        setFormError(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const formatDate = (isoString: string) => {
    try {
      return new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
      }).format(new Date(isoString));
    } catch {
      return isoString.split("T")[0] ?? isoString;
    }
  };

  const formatDateTime = (isoString: string) => {
    try {
      return new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(isoString));
    } catch {
      return isoString;
    }
  };

  const formatAmount = (amountMinorStr: string, currency: string) => {
    return formatAmountPresentation(amountMinorStr, currency, locale);
  };

  const openEditModal = (tx: SerializedTransaction) => {
    setEditTx(tx);
    setEditAmount(minorUnitsToDecimalString(tx.amount.amountMinor, tx.amount.currency));
    setEditDate(tx.occurredOn.split("T")[0] ?? "");
    setFormError(null);

    if (tx.kind === "expense") {
      setEditAccountId(tx.accountId);
      setEditCategoryId(tx.categoryId ?? "");
      setEditPayee(tx.payee);
    } else if (tx.kind === "income") {
      setEditAccountId(tx.accountId);
      setEditCategoryId(tx.categoryId ?? "");
      setEditSource(tx.source);
    } else if (tx.kind === "transfer") {
      setEditFromAccountId(tx.fromAccountId);
      setEditToAccountId(tx.toAccountId);
    }
  };

  const openVoidModal = (tx: SerializedTransaction) => {
    setVoidTx(tx);
    setVoidReason("");
    setFormError(null);
  };

  // Edit currency detection
  const editCurrency = useMemo(() => {
    if (!editTx) return "PLN";
    if (editTx.kind === "transfer") {
      const fromAcc = accountMap.get(editFromAccountId);
      return fromAcc?.currency ?? editTx.amount.currency;
    }
    const acc = accountMap.get(editAccountId);
    return acc?.currency ?? editTx.amount.currency;
  }, [editTx, editAccountId, editFromAccountId, accountMap]);

  // Live amount preview during editing
  const editParseResult = useMemo(() => {
    if (!editAmount.trim()) return null;
    return parseNaturalDecimalToMinor(editAmount, editCurrency);
  }, [editAmount, editCurrency]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTx || !householdId) return;

    if (!editParseResult || !editParseResult.success || !editParseResult.amountMinor) {
      setFormError(t("form.amountRequired"));
      return;
    }

    if (!editDate) {
      setFormError("Date is required.");
      return;
    }

    let payload: Record<string, unknown>;

    if (editTx.kind === "expense") {
      if (!editPayee.trim()) {
        setFormError(t("form.payeeRequired"));
        return;
      }
      payload = {
        kind: "expense",
        expectedVersion: editTx.version,
        accountId: editAccountId,
        amountMinor: editParseResult.amountMinor,
        currency: editCurrency,
        payee: editPayee.trim(),
        categoryId: editCategoryId || null,
        occurredOn: new Date(editDate).toISOString(),
      };
    } else if (editTx.kind === "income") {
      if (!editSource.trim()) {
        setFormError(t("form.sourceRequired"));
        return;
      }
      payload = {
        kind: "income",
        expectedVersion: editTx.version,
        accountId: editAccountId,
        amountMinor: editParseResult.amountMinor,
        currency: editCurrency,
        source: editSource.trim(),
        categoryId: editCategoryId || null,
        occurredOn: new Date(editDate).toISOString(),
      };
    } else {
      // transfer
      if (editFromAccountId === editToAccountId) {
        setFormError(t("form.transferSameAccountError"));
        return;
      }
      payload = {
        kind: "transfer",
        expectedVersion: editTx.version,
        fromAccountId: editFromAccountId,
        toAccountId: editToAccountId,
        amountMinor: editParseResult.amountMinor,
        currency: editCurrency,
        occurredOn: new Date(editDate).toISOString(),
      };
    }

    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/households/${householdId}/transactions/${editTx.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );

        if (res.status === 409) {
          setFormError(tEdit("errorConflict"));
          return;
        }

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setFormError(body.error ?? tEdit("errorGeneric"));
          return;
        }

        setEditTx(null);
        router.refresh();
      } catch {
        setFormError(tEdit("errorGeneric"));
      }
    });
  };

  const handleVoidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidTx || !householdId) return;

    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/households/${householdId}/transactions/${voidTx.id}/void`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              expectedVersion: voidTx.version,
              voidReason: voidReason.trim() || undefined,
            }),
          },
        );

        if (res.status === 409) {
          setFormError(tVoid("errorConflict"));
          return;
        }

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setFormError(body.error ?? tVoid("errorGeneric"));
          return;
        }

        setVoidTx(null);
        router.refresh();
      } catch {
        setFormError(tVoid("errorGeneric"));
      }
    });
  };

  return (
    <section
      aria-label={t("list.title")}
      className="rounded-2xl border border-stone-800 bg-stone-900/80 p-6 shadow-xs backdrop-blur-xs"
    >
      {/* Header with Title and Filter Tabs */}
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-stone-100">
            {t("list.title")}
          </h2>
          <p className="mt-1 text-sm text-stone-400">
            {t("list.description")}
          </p>
        </div>

        {/* Active vs Voided Toggle Tabs */}
        <div
          role="tablist"
          aria-label={t("list.title")}
          className="inline-flex rounded-xl border border-stone-800 bg-stone-950/80 p-1 text-xs"
        >
          <button
            type="button"
            role="tab"
            aria-selected={filter === "active"}
            onClick={() => setFilter("active")}
            className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
              filter === "active"
                ? "bg-stone-800 text-stone-100 shadow-xs"
                : "text-stone-400 hover:text-stone-200"
            }`}
          >
            {t("list.filterActive")} ({activeTransactions.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "voided"}
            onClick={() => setFilter("voided")}
            className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
              filter === "voided"
                ? "bg-rose-950/80 text-rose-200 border border-rose-800/60 shadow-xs"
                : "text-stone-400 hover:text-stone-200"
            }`}
          >
            {t("list.filterVoided", { count: voidedTransactions.length })}
          </button>
        </div>
      </header>

      {/* Transaction Content */}
      {displayedTransactions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-800 bg-stone-950/40 py-12 px-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-stone-800 bg-stone-900 text-stone-400">
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="mt-3 text-base font-medium text-stone-200">
            {filter === "active"
              ? t("list.emptyTitle")
              : t("list.emptyVoidedTitle")}
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-stone-400">
            {filter === "active"
              ? t("list.emptyDescription")
              : t("list.emptyVoidedDescription")}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-800 text-xs font-medium uppercase tracking-wider text-stone-400">
                  <th scope="col" className="pb-3 pr-4">
                    {t("list.colDate")}
                  </th>
                  <th scope="col" className="pb-3 px-4">
                    {t("list.colType")}
                  </th>
                  <th scope="col" className="pb-3 px-4">
                    {t("list.colCategory")}
                  </th>
                  <th scope="col" className="pb-3 px-4">
                    {t("list.colDescription")}
                  </th>
                  <th scope="col" className="pb-3 px-4">
                    {t("list.colAccount")}
                  </th>
                  <th scope="col" className="pb-3 px-4 text-right">
                    {t("list.colAmount")}
                  </th>
                  <th scope="col" className="pb-3 pl-4 text-right">
                    {t("list.colActions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/80">
                {displayedTransactions.map((tx) => {
                  const isVoid = !!tx.voidedAt;
                  let badgeClass = "";
                  let typeLabel = "";
                  let description = "";
                  let accountLabel = "";
                  let amountSign = "";
                  let amountClass = "";

                  if (tx.kind === "expense") {
                    badgeClass = isVoid
                      ? "bg-stone-900 text-stone-500 border border-stone-800"
                      : "bg-rose-950/70 text-rose-300 border border-rose-800/50";
                    typeLabel = t("list.kindExpense");
                    description = tx.payee;
                    const acc = accountMap.get(tx.accountId);
                    accountLabel = acc ? acc.name : tx.accountId;
                    amountSign = "- ";
                    amountClass = isVoid
                      ? "text-stone-500 line-through font-mono"
                      : "text-rose-400 font-mono";
                  } else if (tx.kind === "income") {
                    badgeClass = isVoid
                      ? "bg-stone-900 text-stone-500 border border-stone-800"
                      : "bg-emerald-950/70 text-emerald-300 border border-emerald-800/50";
                    typeLabel = t("list.kindIncome");
                    description = tx.source;
                    const acc = accountMap.get(tx.accountId);
                    accountLabel = acc ? acc.name : tx.accountId;
                    amountSign = "+ ";
                    amountClass = isVoid
                      ? "text-stone-500 line-through font-mono"
                      : "text-emerald-400 font-mono";
                  } else {
                    badgeClass = isVoid
                      ? "bg-stone-900 text-stone-500 border border-stone-800"
                      : "bg-sky-950/70 text-sky-300 border border-sky-800/50";
                    typeLabel = t("list.kindTransfer");
                    const fromAcc = accountMap.get(tx.fromAccountId);
                    const toAcc = accountMap.get(tx.toAccountId);
                    const fromName = fromAcc ? fromAcc.name : tx.fromAccountId;
                    const toName = toAcc ? toAcc.name : tx.toAccountId;
                    description = `${fromName} → ${toName}`;
                    accountLabel = `${fromName} → ${toName}`;
                    amountSign = "";
                    amountClass = isVoid
                      ? "text-stone-500 line-through font-mono"
                      : "text-stone-100 font-mono";
                  }

                  return (
                    <tr
                      key={tx.id}
                      className={`transition-colors ${
                        isVoid
                          ? "bg-stone-950/20 text-stone-500"
                          : "hover:bg-stone-800/30 text-stone-200"
                      }`}
                    >
                      <td className="py-3 pr-4 whitespace-nowrap text-stone-400">
                        {formatDate(tx.occurredOn)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${badgeClass}`}
                          >
                            {typeLabel}
                          </span>
                          {isVoid && (
                            <span className="inline-block rounded-md border border-rose-900/60 bg-rose-950/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-300">
                              {t("list.badgeVoided")}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-stone-300">
                        {tx.kind !== "transfer" && "categoryId" in tx && tx.categoryId ? (
                          <span className="inline-flex items-center rounded-md border border-stone-700 bg-stone-800/60 px-2 py-0.5 text-xs text-stone-200">
                            {categoryMap.get(tx.categoryId)?.name ?? tx.categoryId}
                          </span>
                        ) : (
                          <span className="text-stone-500">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium text-stone-100">
                        {description}
                      </td>
                      <td className="py-3 px-4 text-stone-400 whitespace-nowrap">
                        {accountLabel}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span className={`font-semibold ${amountClass}`}>
                          {amountSign}
                          {formatAmount(tx.amount.amountMinor, tx.amount.currency)}
                        </span>
                      </td>
                      <td className="py-3 pl-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setInspectTx(tx)}
                            className="rounded-lg border border-stone-800 bg-stone-900 px-2.5 py-1 text-xs font-medium text-stone-300 transition-colors hover:border-stone-700 hover:text-stone-100"
                            aria-label={`${tActions("details")} ${description}`}
                          >
                            {tActions("details")}
                          </button>
                          {!isVoid && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditModal(tx)}
                                className="rounded-lg border border-stone-800 bg-stone-900 px-2.5 py-1 text-xs font-medium text-stone-300 transition-colors hover:border-stone-700 hover:text-stone-100"
                                aria-label={`${tActions("edit")} ${description}`}
                              >
                                {tActions("edit")}
                              </button>
                              <button
                                type="button"
                                onClick={() => openVoidModal(tx)}
                                className="rounded-lg border border-stone-800 bg-stone-900 px-2.5 py-1 text-xs font-medium text-rose-400 transition-colors hover:border-rose-900/80 hover:bg-rose-950/40"
                                aria-label={`${tActions("void")} ${description}`}
                              >
                                {tActions("void")}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden flex flex-col gap-3">
            {displayedTransactions.map((tx) => {
              const isVoid = !!tx.voidedAt;
              let badgeClass = "";
              let typeLabel = "";
              let description = "";
              let accountLabel = "";
              let amountSign = "";
              let amountClass = "";

              if (tx.kind === "expense") {
                badgeClass = isVoid
                  ? "bg-stone-900 text-stone-500 border border-stone-800"
                  : "bg-rose-950/70 text-rose-300 border border-rose-800/50";
                typeLabel = t("list.kindExpense");
                description = tx.payee;
                const acc = accountMap.get(tx.accountId);
                accountLabel = acc ? acc.name : tx.accountId;
                amountSign = "- ";
                amountClass = isVoid
                  ? "text-stone-500 line-through font-mono"
                  : "text-rose-400 font-mono";
              } else if (tx.kind === "income") {
                badgeClass = isVoid
                  ? "bg-stone-900 text-stone-500 border border-stone-800"
                  : "bg-emerald-950/70 text-emerald-300 border border-emerald-800/50";
                typeLabel = t("list.kindIncome");
                description = tx.source;
                const acc = accountMap.get(tx.accountId);
                accountLabel = acc ? acc.name : tx.accountId;
                amountSign = "+ ";
                amountClass = isVoid
                  ? "text-stone-500 line-through font-mono"
                  : "text-emerald-400 font-mono";
              } else {
                badgeClass = isVoid
                  ? "bg-stone-900 text-stone-500 border border-stone-800"
                  : "bg-sky-950/70 text-sky-300 border border-sky-800/50";
                typeLabel = t("list.kindTransfer");
                const fromAcc = accountMap.get(tx.fromAccountId);
                const toAcc = accountMap.get(tx.toAccountId);
                const fromName = fromAcc ? fromAcc.name : tx.fromAccountId;
                const toName = toAcc ? toAcc.name : tx.toAccountId;
                description = `${fromName} → ${toName}`;
                accountLabel = `${fromName} → ${toName}`;
                amountSign = "";
                amountClass = isVoid
                  ? "text-stone-500 line-through font-mono"
                  : "text-stone-100 font-mono";
              }

              return (
                <article
                  key={tx.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    isVoid
                      ? "border-stone-800 bg-stone-950/40 opacity-75"
                      : "border-stone-800 bg-stone-950/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${badgeClass}`}
                        >
                          {typeLabel}
                        </span>
                        {isVoid && (
                          <span className="inline-block rounded-md border border-rose-900/60 bg-rose-950/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-300">
                            {t("list.badgeVoided")}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-2 font-medium text-stone-100">
                        {description}
                      </h3>
                      <p className="mt-0.5 text-xs text-stone-400">
                        {accountLabel} • {formatDate(tx.occurredOn)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-base font-semibold ${amountClass}`}>
                        {amountSign}
                        {formatAmount(tx.amount.amountMinor, tx.amount.currency)}
                      </p>
                      {tx.kind !== "transfer" && "categoryId" in tx && tx.categoryId && (
                        <span className="mt-1 inline-block rounded-md border border-stone-800 bg-stone-900 px-2 py-0.5 text-[11px] text-stone-300">
                          {categoryMap.get(tx.categoryId)?.name ?? tx.categoryId}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-2 border-t border-stone-800/80 pt-3">
                    <button
                      type="button"
                      onClick={() => setInspectTx(tx)}
                      className="rounded-lg border border-stone-800 bg-stone-900 px-3 py-1.5 text-xs font-medium text-stone-300 hover:border-stone-700 hover:text-stone-100"
                    >
                      {tActions("details")}
                    </button>
                    {!isVoid && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditModal(tx)}
                          className="rounded-lg border border-stone-800 bg-stone-900 px-3 py-1.5 text-xs font-medium text-stone-300 hover:border-stone-700 hover:text-stone-100"
                        >
                          {tActions("edit")}
                        </button>
                        <button
                          type="button"
                          onClick={() => openVoidModal(tx)}
                          className="rounded-lg border border-stone-800 bg-stone-900 px-3 py-1.5 text-xs font-medium text-rose-400 hover:border-rose-900/80 hover:bg-rose-950/40"
                        >
                          {tActions("void")}
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {/* INSPECT DETAILS DIALOG */}
      {inspectTx && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="details-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg rounded-2xl border border-stone-800 bg-stone-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-4">
              <div>
                <h3
                  id="details-dialog-title"
                  className="text-lg font-semibold text-stone-100"
                >
                  {tDetails("title")}
                </h3>
                <p className="text-xs text-stone-400">
                  {t("list.versionLabel", { version: inspectTx.version })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectTx(null)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-800 hover:text-stone-200"
                aria-label={tActions("close")}
              >
                ✕
              </button>
            </div>

            <dl className="mt-4 divide-y divide-stone-800 text-sm">
              <div className="flex justify-between py-2.5">
                <dt className="text-stone-400">{tDetails("status")}</dt>
                <dd className="font-medium text-stone-100">
                  {inspectTx.voidedAt ? (
                    <span className="rounded-md border border-rose-900/80 bg-rose-950 px-2 py-0.5 text-xs text-rose-300 font-semibold">
                      {tDetails("statusVoided")}
                    </span>
                  ) : (
                    <span className="rounded-md border border-emerald-900/80 bg-emerald-950 px-2 py-0.5 text-xs text-emerald-300 font-semibold">
                      {tDetails("statusActive")}
                    </span>
                  )}
                </dd>
              </div>

              <div className="flex justify-between py-2.5">
                <dt className="text-stone-400">{tDetails("type")}</dt>
                <dd className="font-medium text-stone-200 uppercase text-xs tracking-wider">
                  {inspectTx.kind}
                </dd>
              </div>

              <div className="flex justify-between py-2.5">
                <dt className="text-stone-400">{tDetails("amount")}</dt>
                <dd className="font-mono font-semibold text-stone-100">
                  {formatAmount(
                    inspectTx.amount.amountMinor,
                    inspectTx.amount.currency,
                  )}
                </dd>
              </div>

              <div className="flex justify-between py-2.5">
                <dt className="text-stone-400">{tDetails("date")}</dt>
                <dd className="text-stone-200">
                  {formatDate(inspectTx.occurredOn)}
                </dd>
              </div>

              {inspectTx.kind === "expense" && (
                <>
                  <div className="flex justify-between py-2.5">
                    <dt className="text-stone-400">{tDetails("payee")}</dt>
                    <dd className="font-medium text-stone-100">
                      {inspectTx.payee}
                    </dd>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <dt className="text-stone-400">{tDetails("account")}</dt>
                    <dd className="text-stone-200">
                      {accountMap.get(inspectTx.accountId)?.name ??
                        inspectTx.accountId}
                    </dd>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <dt className="text-stone-400">{tDetails("category")}</dt>
                    <dd className="text-stone-200">
                      {inspectTx.categoryId
                        ? categoryMap.get(inspectTx.categoryId)?.name ??
                          inspectTx.categoryId
                        : t("list.uncategorized")}
                    </dd>
                  </div>
                </>
              )}

              {inspectTx.kind === "income" && (
                <>
                  <div className="flex justify-between py-2.5">
                    <dt className="text-stone-400">{tDetails("source")}</dt>
                    <dd className="font-medium text-stone-100">
                      {inspectTx.source}
                    </dd>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <dt className="text-stone-400">{tDetails("account")}</dt>
                    <dd className="text-stone-200">
                      {accountMap.get(inspectTx.accountId)?.name ??
                        inspectTx.accountId}
                    </dd>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <dt className="text-stone-400">{tDetails("category")}</dt>
                    <dd className="text-stone-200">
                      {inspectTx.categoryId
                        ? categoryMap.get(inspectTx.categoryId)?.name ??
                          inspectTx.categoryId
                        : t("list.uncategorized")}
                    </dd>
                  </div>
                </>
              )}

              {inspectTx.kind === "transfer" && (
                <>
                  <div className="flex justify-between py-2.5">
                    <dt className="text-stone-400">{tDetails("fromAccount")}</dt>
                    <dd className="text-stone-200">
                      {accountMap.get(inspectTx.fromAccountId)?.name ??
                        inspectTx.fromAccountId}
                    </dd>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <dt className="text-stone-400">{tDetails("toAccount")}</dt>
                    <dd className="text-stone-200">
                      {accountMap.get(inspectTx.toAccountId)?.name ??
                        inspectTx.toAccountId}
                    </dd>
                  </div>
                </>
              )}

              {inspectTx.voidedAt && (
                <>
                  <div className="flex justify-between py-2.5">
                    <dt className="text-rose-400 font-medium">
                      {tDetails("voidedAt")}
                    </dt>
                    <dd className="text-rose-300">
                      {formatDateTime(inspectTx.voidedAt)}
                    </dd>
                  </div>
                  {inspectTx.voidReason && (
                    <div className="flex flex-col py-2.5 gap-1">
                      <dt className="text-stone-400">
                        {tDetails("voidReason")}
                      </dt>
                      <dd className="rounded-lg border border-stone-800 bg-stone-950 p-2.5 text-stone-300 italic">
                        "{inspectTx.voidReason}"
                      </dd>
                    </div>
                  )}
                </>
              )}

              <div className="flex flex-col py-2.5 gap-1">
                <dt className="text-xs text-stone-500">
                  {tDetails("transactionId")}
                </dt>
                <dd className="font-mono text-xs text-stone-400 select-all">
                  {inspectTx.id}
                </dd>
              </div>
            </dl>

            <div className="mt-4 rounded-xl border border-stone-800 bg-stone-950/60 p-3 text-xs text-stone-400 leading-relaxed">
              {tDetails("auditTrailNotice")}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectTx(null)}
                className="rounded-xl border border-stone-700 bg-stone-800 px-4 py-2 text-sm font-medium text-stone-200 hover:bg-stone-700 hover:text-stone-100"
              >
                {tActions("close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT / CORRECT TRANSACTION DIALOG */}
      {editTx && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg rounded-2xl border border-stone-800 bg-stone-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-4">
              <div>
                <h3
                  id="edit-dialog-title"
                  className="text-lg font-semibold text-stone-100"
                >
                  {editTx.kind === "expense"
                    ? tEdit("titleExpense")
                    : editTx.kind === "income"
                      ? tEdit("titleIncome")
                      : tEdit("titleTransfer")}
                </h3>
                <p className="mt-1 text-xs text-stone-400">
                  {tEdit("description")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditTx(null);
                  setFormError(null);
                }}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-800 hover:text-stone-200"
                aria-label={tActions("cancel")}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-4 flex flex-col gap-4">
              {formError && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-800/80 bg-rose-950/60 p-3 text-xs text-rose-300"
                >
                  {formError}
                </div>
              )}

              {/* Amount and Live Preview */}
              <div>
                <label
                  htmlFor="edit-amount"
                  className="block text-xs font-medium text-stone-300"
                >
                  {t("form.amountMinor")} ({editCurrency})
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    id="edit-amount"
                    type="text"
                    inputMode="decimal"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    required
                    className="w-full rounded-xl border border-stone-800 bg-stone-950 px-3 py-2 text-sm text-stone-100 placeholder-stone-600 focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>
                {editParseResult && editParseResult.success && editParseResult.amountMinor && (
                  <p className="mt-1 text-xs text-emerald-400 font-mono">
                    {t("form.amountPreview")}:{" "}
                    {formatAmount(
                      editParseResult.amountMinor,
                      editCurrency,
                    )}
                  </p>
                )}
                {editParseResult && !editParseResult.success && (
                  <p className="mt-1 text-xs text-rose-400">
                    {editParseResult.error}
                  </p>
                )}
              </div>

              {/* Date */}
              <div>
                <label
                  htmlFor="edit-date"
                  className="block text-xs font-medium text-stone-300"
                >
                  {t("form.date")}
                </label>
                <input
                  id="edit-date"
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  required
                  className="mt-1.5 w-full rounded-xl border border-stone-800 bg-stone-950 px-3 py-2 text-sm text-stone-100 focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* Expense Specific Fields */}
              {editTx.kind === "expense" && (
                <>
                  <div>
                    <label
                      htmlFor="edit-payee"
                      className="block text-xs font-medium text-stone-300"
                    >
                      {t("form.payee")}
                    </label>
                    <input
                      id="edit-payee"
                      type="text"
                      value={editPayee}
                      onChange={(e) => setEditPayee(e.target.value)}
                      required
                      className="mt-1.5 w-full rounded-xl border border-stone-800 bg-stone-950 px-3 py-2 text-sm text-stone-100 placeholder-stone-600 focus:border-emerald-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="edit-account"
                      className="block text-xs font-medium text-stone-300"
                    >
                      {t("form.account")}
                    </label>
                    <select
                      id="edit-account"
                      value={editAccountId}
                      onChange={(e) => setEditAccountId(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-stone-800 bg-stone-950 px-3 py-2 text-sm text-stone-100 focus:border-emerald-500 focus:outline-hidden"
                    >
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.currency})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="edit-category"
                      className="block text-xs font-medium text-stone-300"
                    >
                      {t("form.category")}
                    </label>
                    <select
                      id="edit-category"
                      value={editCategoryId}
                      onChange={(e) => setEditCategoryId(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-stone-800 bg-stone-950 px-3 py-2 text-sm text-stone-100 focus:border-emerald-500 focus:outline-hidden"
                    >
                      <option value="">{t("form.selectCategory")}</option>
                      {categories
                        .filter(
                          (c) =>
                            !c.archivedAt &&
                            (c.applicability === "expense" ||
                              c.applicability === "both"),
                        )
                        .map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </>
              )}

              {/* Income Specific Fields */}
              {editTx.kind === "income" && (
                <>
                  <div>
                    <label
                      htmlFor="edit-source"
                      className="block text-xs font-medium text-stone-300"
                    >
                      {t("form.source")}
                    </label>
                    <input
                      id="edit-source"
                      type="text"
                      value={editSource}
                      onChange={(e) => setEditSource(e.target.value)}
                      required
                      className="mt-1.5 w-full rounded-xl border border-stone-800 bg-stone-950 px-3 py-2 text-sm text-stone-100 placeholder-stone-600 focus:border-emerald-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="edit-income-account"
                      className="block text-xs font-medium text-stone-300"
                    >
                      {t("form.account")}
                    </label>
                    <select
                      id="edit-income-account"
                      value={editAccountId}
                      onChange={(e) => setEditAccountId(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-stone-800 bg-stone-950 px-3 py-2 text-sm text-stone-100 focus:border-emerald-500 focus:outline-hidden"
                    >
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.currency})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="edit-income-category"
                      className="block text-xs font-medium text-stone-300"
                    >
                      {t("form.category")}
                    </label>
                    <select
                      id="edit-income-category"
                      value={editCategoryId}
                      onChange={(e) => setEditCategoryId(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-stone-800 bg-stone-950 px-3 py-2 text-sm text-stone-100 focus:border-emerald-500 focus:outline-hidden"
                    >
                      <option value="">{t("form.selectCategory")}</option>
                      {categories
                        .filter(
                          (c) =>
                            !c.archivedAt &&
                            (c.applicability === "income" ||
                              c.applicability === "both"),
                        )
                        .map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </>
              )}

              {/* Transfer Specific Fields */}
              {editTx.kind === "transfer" && (
                <>
                  <div>
                    <label
                      htmlFor="edit-from-account"
                      className="block text-xs font-medium text-stone-300"
                    >
                      {t("form.fromAccount")}
                    </label>
                    <select
                      id="edit-from-account"
                      value={editFromAccountId}
                      onChange={(e) => setEditFromAccountId(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-stone-800 bg-stone-950 px-3 py-2 text-sm text-stone-100 focus:border-emerald-500 focus:outline-hidden"
                    >
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.currency})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="edit-to-account"
                      className="block text-xs font-medium text-stone-300"
                    >
                      {t("form.toAccount")}
                    </label>
                    <select
                      id="edit-to-account"
                      value={editToAccountId}
                      onChange={(e) => setEditToAccountId(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-stone-800 bg-stone-950 px-3 py-2 text-sm text-stone-100 focus:border-emerald-500 focus:outline-hidden"
                    >
                      {accounts
                        .filter((acc) => acc.id !== editFromAccountId)
                        .map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({acc.currency})
                          </option>
                        ))}
                    </select>
                  </div>
                </>
              )}

              <div className="mt-4 flex items-center justify-end gap-3 border-t border-stone-800 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setEditTx(null);
                    setFormError(null);
                  }}
                  className="rounded-xl border border-stone-800 bg-stone-900 px-4 py-2 text-sm font-medium text-stone-300 hover:bg-stone-800 hover:text-stone-100"
                >
                  {tActions("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {isPending ? tActions("saving") : tActions("save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VOID CONFIRMATION DIALOG */}
      {voidTx && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="void-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg rounded-2xl border border-rose-900/60 bg-stone-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-4">
              <div>
                <h3
                  id="void-dialog-title"
                  className="text-lg font-semibold text-rose-300"
                >
                  {tVoid("title")}
                </h3>
                <p className="mt-1 text-xs text-stone-400">
                  {tVoid("description")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setVoidTx(null);
                  setFormError(null);
                }}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-800 hover:text-stone-200"
                aria-label={tActions("cancel")}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleVoidSubmit} className="mt-4 flex flex-col gap-4">
              {formError && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-800/80 bg-rose-950/60 p-3 text-xs text-rose-300"
                >
                  {formError}
                </div>
              )}

              {/* Summary of transaction being voided */}
              <div className="rounded-xl border border-stone-800 bg-stone-950 p-4 text-xs text-stone-300 flex justify-between items-center">
                <div>
                  <span className="font-semibold text-stone-100 uppercase text-[11px] tracking-wider">
                    {voidTx.kind}
                  </span>
                  <p className="mt-1 text-stone-400">
                    {voidTx.kind === "expense"
                      ? voidTx.payee
                      : voidTx.kind === "income"
                        ? voidTx.source
                        : `${accountMap.get(voidTx.fromAccountId)?.name ?? voidTx.fromAccountId} → ${accountMap.get(voidTx.toAccountId)?.name ?? voidTx.toAccountId}`}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-stone-100 text-sm">
                    {formatAmount(
                      voidTx.amount.amountMinor,
                      voidTx.amount.currency,
                    )}
                  </span>
                  <p className="mt-0.5 text-stone-500">
                    {formatDate(voidTx.occurredOn)}
                  </p>
                </div>
              </div>

              <div>
                <label
                  htmlFor="void-reason"
                  className="block text-xs font-medium text-stone-300"
                >
                  {tVoid("reasonLabel")}
                </label>
                <textarea
                  id="void-reason"
                  rows={3}
                  maxLength={280}
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder={tVoid("reasonPlaceholder")}
                  className="mt-1.5 w-full rounded-xl border border-stone-800 bg-stone-950 px-3 py-2 text-sm text-stone-100 placeholder-stone-600 focus:border-rose-500 focus:outline-hidden"
                />
                <p className="mt-1 text-[11px] text-stone-500">
                  {tVoid("reasonHelp")} ({voidReason.length}/280)
                </p>
              </div>

              <div className="mt-4 flex items-center justify-end gap-3 border-t border-stone-800 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setVoidTx(null);
                    setFormError(null);
                  }}
                  className="rounded-xl border border-stone-800 bg-stone-900 px-4 py-2 text-sm font-medium text-stone-300 hover:bg-stone-800 hover:text-stone-100"
                >
                  {tActions("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-50"
                >
                  {isPending ? tActions("voiding") : tActions("confirmVoid")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
