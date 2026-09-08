"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
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
import type { TransactionHistoryEntry } from "@/lib/transactions/history-types";

type TransactionListProps = {
  transactions: SerializedTransaction[];
  accounts: HouseholdAccountSummary[];
  categories?: HouseholdCategorySummary[] | undefined;
  locale: string;
  householdId?: string | undefined;
  initialInspectTx?: SerializedTransaction | null | undefined;
  initialActiveInspectTab?: "details" | "history" | undefined;
  initialHistoryData?: TransactionHistoryEntry[] | null | undefined;
};

type FilterOverrides = {
  search?: string;
  type?: string;
  accountId?: string;
  categoryId?: string;
  month?: string;
  from?: string;
  to?: string;
  status?: "active" | "voided" | "all";
  page?: number;
  limit?: number;
};

export function TransactionList({
  transactions,
  accounts,
  categories = [],
  locale,
  householdId,
  initialInspectTx = null,
  initialActiveInspectTab = "details",
  initialHistoryData = null,
}: TransactionListProps) {
  const t = useTranslations("Transactions");
  const tFilters = useTranslations("Transactions.filters");
  const tActions = useTranslations("Transactions.actions");
  const tDetails = useTranslations("Transactions.details");
  const tHistory = useTranslations("Transactions.history");
  const tEdit = useTranslations("Transactions.edit");
  const tVoid = useTranslations("Transactions.void");
  const tAccess = useTranslations("Accessibility");
  const router = useRouter();

  // Server-side filter state
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string>("");
  const [accountId, setAccountId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [month, setMonth] = useState<string>("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [status, setStatus] = useState<"active" | "voided" | "all">("active");
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);

  // Paginated items and count
  const [items, setItems] = useState<SerializedTransaction[]>(transactions);
  const [totalCount, setTotalCount] = useState<number>(transactions.length);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [inspectTx, setInspectTx] = useState<SerializedTransaction | null>(initialInspectTx);
  const [activeInspectTab, setActiveInspectTab] = useState<"details" | "history">(initialActiveInspectTab);
  const [historyData, setHistoryData] = useState<TransactionHistoryEntry[] | null>(initialHistoryData);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
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

  useEffect(() => {
    setItems(transactions);
    setTotalCount(transactions.length);
  }, [transactions]);

  const fetchFilteredTransactions = useCallback(
    async (overrideParams: FilterOverrides = {}) => {
      if (!householdId) return;
      setIsLoading(true);

      const effectiveSearch =
        overrideParams.search !== undefined ? overrideParams.search : search;
      const effectiveType =
        overrideParams.type !== undefined ? overrideParams.type : type;
      const effectiveAccount =
        overrideParams.accountId !== undefined ? overrideParams.accountId : accountId;
      const effectiveCategory =
        overrideParams.categoryId !== undefined ? overrideParams.categoryId : categoryId;
      const effectiveMonth =
        overrideParams.month !== undefined ? overrideParams.month : month;
      const effectiveFrom =
        overrideParams.from !== undefined ? overrideParams.from : from;
      const effectiveTo =
        overrideParams.to !== undefined ? overrideParams.to : to;
      const effectiveStatus =
        overrideParams.status !== undefined ? overrideParams.status : status;
      const effectivePage =
        overrideParams.page !== undefined ? overrideParams.page : page;
      const effectiveLimit =
        overrideParams.limit !== undefined ? overrideParams.limit : limit;

      try {
        const sp = new URLSearchParams();
        if (effectiveSearch.trim()) sp.set("search", effectiveSearch.trim());
        if (effectiveType) sp.set("type", effectiveType);
        if (effectiveAccount) sp.set("accountId", effectiveAccount);
        if (effectiveCategory) sp.set("categoryId", effectiveCategory);
        if (effectiveMonth) sp.set("month", effectiveMonth);
        if (effectiveFrom) sp.set("from", effectiveFrom);
        if (effectiveTo) sp.set("to", effectiveTo);
        if (effectiveStatus) sp.set("status", effectiveStatus);
        if (effectivePage > 1) sp.set("page", String(effectivePage));
        if (effectiveLimit !== 20) sp.set("limit", String(effectiveLimit));

        // Sync URL in browser without full reload
        if (typeof window !== "undefined") {
          const queryStr = sp.toString();
          const newUrl = queryStr
            ? `${window.location.pathname}?${queryStr}`
            : window.location.pathname;
          window.history.replaceState(null, "", newUrl);
        }

        const fetchQuery = new URLSearchParams(sp);
        fetchQuery.set("page", String(effectivePage));
        fetchQuery.set("limit", String(effectiveLimit));

        const res = await fetch(
          `/api/households/${householdId}/transactions?${fetchQuery.toString()}`,
        );
        if (res.ok) {
          const json = await res.json();
          setItems(json.data ?? []);
          setTotalCount(json.pagination?.total ?? (json.data?.length ?? 0));
        }
      } catch (err) {
        console.error("Failed to load transactions", err);
      } finally {
        setIsLoading(false);
      }
    },
    [householdId, search, type, accountId, categoryId, month, from, to, status, page, limit],
  );

  const scheduleFetch = useCallback(
    (overrideParams: FilterOverrides = {}) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        fetchFilteredTransactions(overrideParams);
      }, 250);
    },
    [fetchFilteredTransactions],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const urlSearch = sp.get("search") ?? sp.get("q") ?? "";
    const urlType = sp.get("type") ?? sp.get("kind") ?? "";
    const urlAccount = sp.get("accountId") ?? "";
    const urlCategory = sp.get("categoryId") ?? "";
    const urlMonth = sp.get("month") ?? "";
    const urlFrom = sp.get("from") ?? sp.get("startDate") ?? "";
    const urlTo = sp.get("to") ?? sp.get("endDate") ?? "";
    const rawStatus = sp.get("status");
    const urlStatus: "active" | "voided" | "all" =
      rawStatus === "active" || rawStatus === "voided" || rawStatus === "all"
        ? rawStatus
        : sp.get("includeVoided") === "true"
          ? "all"
          : "active";
    const urlPage = parseInt(sp.get("page") ?? "1", 10) || 1;
    const urlLimit = parseInt(sp.get("limit") ?? "20", 10) || 20;

    let hasUrlParams = false;
    if (urlSearch) { setSearch(urlSearch); hasUrlParams = true; }
    if (urlType) { setType(urlType); hasUrlParams = true; }
    if (urlAccount) { setAccountId(urlAccount); hasUrlParams = true; }
    if (urlCategory) { setCategoryId(urlCategory); hasUrlParams = true; }
    if (urlMonth) { setMonth(urlMonth); hasUrlParams = true; }
    if (urlFrom) { setFrom(urlFrom); hasUrlParams = true; }
    if (urlTo) { setTo(urlTo); hasUrlParams = true; }
    if (urlStatus !== "active") { setStatus(urlStatus); hasUrlParams = true; }
    if (urlPage > 1) { setPage(urlPage); hasUrlParams = true; }
    if (urlLimit !== 20) { setLimit(urlLimit); hasUrlParams = true; }

    if (hasUrlParams && householdId) {
      fetchFilteredTransactions({
        search: urlSearch,
        type: urlType,
        accountId: urlAccount,
        categoryId: urlCategory,
        month: urlMonth,
        from: urlFrom,
        to: urlTo,
        status: urlStatus,
        page: urlPage,
        limit: urlLimit,
      });
    }
  }, []);

  const exportCsvUrl = useMemo(() => {
    if (!householdId) return "";
    const sp = new URLSearchParams();
    if (search.trim()) sp.set("search", search.trim());
    if (type) sp.set("type", type);
    if (accountId) sp.set("accountId", accountId);
    if (categoryId) sp.set("categoryId", categoryId);
    if (month) sp.set("month", month);
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    if (status) sp.set("status", status);
    sp.set("locale", locale);
    return `/api/households/${householdId}/transactions/export?${sp.toString()}`;
  }, [householdId, search, type, accountId, categoryId, month, from, to, status, locale]);

  const hasActiveFilters = Boolean(
    search.trim() ||
      type ||
      accountId ||
      categoryId ||
      month ||
      from ||
      to ||
      status !== "active" ||
      page > 1,
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (search.trim()) count++;
    if (type) count++;
    if (accountId) count++;
    if (categoryId) count++;
    if (month || from || to) count++;
    if (status !== "active") count++;
    return count;
  }, [search, type, accountId, categoryId, month, from, to, status]);

  const handleReset = () => {
    setSearch("");
    setType("");
    setAccountId("");
    setCategoryId("");
    setMonth("");
    setFrom("");
    setTo("");
    setStatus("active");
    setPage(1);
    fetchFilteredTransactions({
      search: "",
      type: "",
      accountId: "",
      categoryId: "",
      month: "",
      from: "",
      to: "",
      status: "active",
      page: 1,
      limit,
    });
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const startRecord = totalCount === 0 ? 0 : (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, totalCount);
  const displayedTransactions = items;

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

  useEffect(() => {
    if (!inspectTx) {
      setHistoryData(null);
      setHistoryError(null);
      setActiveInspectTab("details");
      return;
    }

    const effectiveHouseholdId = householdId ?? inspectTx.householdId;
    if (!effectiveHouseholdId) return;

    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError(null);

    fetch(`/api/households/${effectiveHouseholdId}/transactions/${inspectTx.id}/history`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Failed to load history");
        }
        return res.json();
      })
      .then((json) => {
        if (!cancelled) {
          setHistoryData(json.data?.history ?? []);
          setHistoryLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setHistoryError(err.message || "Failed to load");
          setHistoryLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [inspectTx, householdId]);

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
      {/* Header with Title and Export CSV action */}
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-stone-100">
            {t("list.title")}
          </h2>
          <p className="mt-1 text-sm text-stone-400">
            {t("list.description")}
          </p>
        </div>

        {householdId && (
          <div className="flex items-center gap-3">
            <a
              href={exportCsvUrl}
              download
              role="button"
              aria-label={tAccess("csvExport")}
              className="inline-flex items-center gap-2 rounded-xl border border-stone-700 bg-stone-800/90 px-3.5 py-2 text-xs font-medium text-stone-200 shadow-xs transition-colors hover:border-stone-600 hover:bg-stone-700/80 hover:text-white focus:outline-none focus:ring-2 focus:ring-stone-500"
            >
              <svg
                className="h-4 w-4 text-stone-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.75}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                />
              </svg>
              {tFilters("exportCsv")}
            </a>
          </div>
        )}
      </header>

      {/* Filter toolbar */}
      <div
        aria-label={tAccess("transactionFilters")}
        className="mb-6 rounded-xl border border-stone-800/80 bg-stone-950/60 p-4"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Text Search */}
          <div className="relative">
            <label
              htmlFor="tx-filter-search"
              className="sr-only"
            >
              {tFilters("searchLabel")}
            </label>
            <input
              id="tx-filter-search"
              type="search"
              value={search}
              onChange={(e) => {
                const val = e.target.value;
                setSearch(val);
                setPage(1);
                scheduleFetch({ search: val, page: 1 });
              }}
              placeholder={tFilters("searchPlaceholder")}
              className="w-full rounded-xl border border-stone-800 bg-stone-900/90 px-3 py-2 text-xs text-stone-100 placeholder-stone-500 focus:border-stone-600 focus:outline-none focus:ring-1 focus:ring-stone-600"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setPage(1);
                  fetchFilteredTransactions({ search: "", page: 1 });
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200 text-xs"
                aria-label={tActions("close")}
              >
                ✕
              </button>
            )}
          </div>

          {/* Transaction Type */}
          <div>
            <label htmlFor="tx-filter-type" className="sr-only">
              {tFilters("typeLabel")}
            </label>
            <select
              id="tx-filter-type"
              value={type}
              onChange={(e) => {
                const val = e.target.value;
                setType(val);
                setPage(1);
                fetchFilteredTransactions({ type: val, page: 1 });
              }}
              aria-label={tFilters("typeLabel")}
              className="w-full rounded-xl border border-stone-800 bg-stone-900/90 px-3 py-2 text-xs text-stone-100 focus:border-stone-600 focus:outline-none focus:ring-1 focus:ring-stone-600"
            >
              <option value="">{tFilters("typeAll")}</option>
              <option value="expense">{tFilters("typeExpense")}</option>
              <option value="income">{tFilters("typeIncome")}</option>
              <option value="transfer">{tFilters("typeTransfer")}</option>
            </select>
          </div>

          {/* Account Filter */}
          <div>
            <label htmlFor="tx-filter-account" className="sr-only">
              {tFilters("accountLabel")}
            </label>
            <select
              id="tx-filter-account"
              value={accountId}
              onChange={(e) => {
                const val = e.target.value;
                setAccountId(val);
                setPage(1);
                fetchFilteredTransactions({ accountId: val, page: 1 });
              }}
              aria-label={tFilters("accountLabel")}
              className="w-full rounded-xl border border-stone-800 bg-stone-900/90 px-3 py-2 text-xs text-stone-100 focus:border-stone-600 focus:outline-none focus:ring-1 focus:ring-stone-600"
            >
              <option value="">{tFilters("accountAll")}</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.currency})
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label htmlFor="tx-filter-category" className="sr-only">
              {tFilters("categoryLabel")}
            </label>
            <select
              id="tx-filter-category"
              value={categoryId}
              onChange={(e) => {
                const val = e.target.value;
                setCategoryId(val);
                setPage(1);
                fetchFilteredTransactions({ categoryId: val, page: 1 });
              }}
              aria-label={tFilters("categoryLabel")}
              className="w-full rounded-xl border border-stone-800 bg-stone-900/90 px-3 py-2 text-xs text-stone-100 focus:border-stone-600 focus:outline-none focus:ring-1 focus:ring-stone-600"
            >
              <option value="">{tFilters("categoryAll")}</option>
              <option value="uncategorized">{tFilters("uncategorized")}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Second row of filters: Status & Date Ranges & Reset */}
        <div className="mt-3 flex flex-wrap items-center gap-3 pt-3 border-t border-stone-800/60">
          {/* Status selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-400">{tFilters("statusLabel")}:</span>
            <div
              role="radiogroup"
              aria-label={tFilters("statusLabel")}
              className="inline-flex rounded-lg border border-stone-800 bg-stone-900 p-0.5 text-xs"
            >
              <button
                type="button"
                role="radio"
                aria-checked={status === "active"}
                onClick={() => {
                  setStatus("active");
                  setPage(1);
                  fetchFilteredTransactions({ status: "active", page: 1 });
                }}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  status === "active"
                    ? "bg-stone-800 text-stone-100 shadow-xs"
                    : "text-stone-400 hover:text-stone-200"
                }`}
              >
                {tFilters("statusActive")}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={status === "voided"}
                onClick={() => {
                  setStatus("voided");
                  setPage(1);
                  fetchFilteredTransactions({ status: "voided", page: 1 });
                }}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  status === "voided"
                    ? "bg-rose-950/80 text-rose-200 border border-rose-800/60 shadow-xs"
                    : "text-stone-400 hover:text-stone-200"
                }`}
              >
                {tFilters("statusVoided")}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={status === "all"}
                onClick={() => {
                  setStatus("all");
                  setPage(1);
                  fetchFilteredTransactions({ status: "all", page: 1 });
                }}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  status === "all"
                    ? "bg-stone-800 text-stone-100 shadow-xs"
                    : "text-stone-400 hover:text-stone-200"
                }`}
              >
                {tFilters("statusAll")}
              </button>
            </div>
          </div>

          {/* Month shortcut or Date Range */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <label htmlFor="tx-filter-month" className="text-xs text-stone-400">
                {tFilters("monthLabel")}:
              </label>
              <input
                id="tx-filter-month"
                type="month"
                value={month}
                onChange={(e) => {
                  const val = e.target.value;
                  setMonth(val);
                  if (val) {
                    setFrom("");
                    setTo("");
                  }
                  setPage(1);
                  fetchFilteredTransactions({
                    month: val,
                    from: val ? "" : from,
                    to: val ? "" : to,
                    page: 1,
                  });
                }}
                className="rounded-lg border border-stone-800 bg-stone-900 px-2.5 py-1 text-xs text-stone-100 focus:border-stone-600 focus:outline-none"
              />
            </div>

            <span className="text-xs text-stone-500">|</span>

            <div className="flex items-center gap-1.5">
              <label htmlFor="tx-filter-from" className="text-xs text-stone-400">
                {tFilters("dateFromLabel")}:
              </label>
              <input
                id="tx-filter-from"
                type="date"
                value={from}
                onChange={(e) => {
                  const val = e.target.value;
                  setFrom(val);
                  if (val) setMonth("");
                  setPage(1);
                  fetchFilteredTransactions({
                    from: val,
                    month: "",
                    page: 1,
                  });
                }}
                className="rounded-lg border border-stone-800 bg-stone-900 px-2 py-1 text-xs text-stone-100 focus:border-stone-600 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <label htmlFor="tx-filter-to" className="text-xs text-stone-400">
                {tFilters("dateToLabel")}:
              </label>
              <input
                id="tx-filter-to"
                type="date"
                value={to}
                onChange={(e) => {
                  const val = e.target.value;
                  setTo(val);
                  if (val) setMonth("");
                  setPage(1);
                  fetchFilteredTransactions({
                    to: val,
                    month: "",
                    page: 1,
                  });
                }}
                className="rounded-lg border border-stone-800 bg-stone-900 px-2 py-1 text-xs text-stone-100 focus:border-stone-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Active filters badge & Reset button */}
          <div className="ml-auto flex items-center gap-2">
            {activeFilterCount > 0 && (
              <span className="rounded-md border border-stone-700 bg-stone-800/80 px-2 py-0.5 text-[11px] font-medium text-stone-300">
                {tFilters("activeFiltersCount", { count: activeFilterCount })}
              </span>
            )}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg border border-stone-700/80 bg-stone-800/60 px-2.5 py-1 text-xs font-medium text-stone-300 hover:bg-stone-800 hover:text-stone-100 transition-colors"
              >
                {tFilters("reset")}
              </button>
            )}
          </div>
        </div>
      </div>

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
            {hasActiveFilters
              ? tFilters("noResultsTitle")
              : t("list.emptyTitle")}
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-stone-400">
            {hasActiveFilters
              ? tFilters("noResultsDescription")
              : t("list.emptyDescription")}
          </p>
          {hasActiveFilters && (
            <div className="mt-4">
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg border border-stone-700 bg-stone-800 px-3 py-1.5 text-xs font-medium text-stone-200 hover:bg-stone-700 hover:text-white transition-colors"
              >
                {tFilters("reset")}
              </button>
            </div>
          )}
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

          {/* Pagination Controls */}
          <nav
            aria-label={tAccess("transactionPagination")}
            className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-stone-800/80 pt-4 sm:flex-row text-xs text-stone-400"
          >
            <div className="flex items-center gap-4">
              <span>
                {tFilters("showingCount", {
                  start: startRecord,
                  end: endRecord,
                  total: totalCount,
                })}
              </span>

              <div className="flex items-center gap-1.5">
                <label htmlFor="tx-page-size" className="text-stone-400">
                  {tFilters("pageSize")}:
                </label>
                <select
                  id="tx-page-size"
                  value={limit}
                  onChange={(e) => {
                    const newLimit = Number(e.target.value);
                    setLimit(newLimit);
                    setPage(1);
                    fetchFilteredTransactions({ limit: newLimit, page: 1 });
                  }}
                  className="rounded-md border border-stone-800 bg-stone-900 px-2 py-1 text-xs text-stone-200 focus:border-stone-600 focus:outline-none"
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span>
                {tFilters("pageLabel", {
                  current: page,
                  total: totalPages,
                })}
              </span>

              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  disabled={page <= 1 || isLoading}
                  onClick={() => {
                    const prevPage = page - 1;
                    setPage(prevPage);
                    fetchFilteredTransactions({ page: prevPage });
                  }}
                  className="rounded-lg border border-stone-800 bg-stone-900 px-2.5 py-1.5 text-xs font-medium text-stone-300 transition-colors hover:border-stone-700 hover:text-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {tFilters("prevPage")}
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages || isLoading}
                  onClick={() => {
                    const nextPage = page + 1;
                    setPage(nextPage);
                    fetchFilteredTransactions({ page: nextPage });
                  }}
                  className="rounded-lg border border-stone-800 bg-stone-900 px-2.5 py-1.5 text-xs font-medium text-stone-300 transition-colors hover:border-stone-700 hover:text-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {tFilters("nextPage")}
                </button>
              </div>
            </div>
          </nav>
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
          <div className="w-full max-w-xl max-h-[85vh] flex flex-col rounded-2xl border border-stone-800 bg-stone-900 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-stone-800 p-6 pb-4">
              <div>
                <h3
                  id="details-dialog-title"
                  className="text-lg font-semibold text-stone-100"
                >
                  {activeInspectTab === "details"
                    ? tDetails("title")
                    : tHistory("title")}
                </h3>
                <p className="text-xs text-stone-400">
                  {t("list.versionLabel", { version: inspectTx.version })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setInspectTx(null);
                  setActiveInspectTab("details");
                }}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-800 hover:text-stone-200"
                aria-label={tActions("close")}
              >
                ✕
              </button>
            </div>

            {/* Tab navigation */}
            <div className="flex border-b border-stone-800 px-6 gap-6 bg-stone-950/40">
              <button
                type="button"
                onClick={() => setActiveInspectTab("details")}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeInspectTab === "details"
                    ? "border-emerald-500 text-emerald-400 font-semibold"
                    : "border-transparent text-stone-400 hover:text-stone-200"
                }`}
              >
                {tHistory("tabDetails")}
              </button>
              <button
                type="button"
                onClick={() => setActiveInspectTab("history")}
                className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeInspectTab === "history"
                    ? "border-emerald-500 text-emerald-400 font-semibold"
                    : "border-transparent text-stone-400 hover:text-stone-200"
                }`}
              >
                <span>{tHistory("tabHistory")}</span>
                {historyData && historyData.length > 0 && (
                  <span className="rounded-full bg-stone-800 px-2 py-0.5 text-xs text-stone-300 font-mono">
                    {historyData.length}
                  </span>
                )}
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              {activeInspectTab === "details" ? (
                <>
                  <dl className="divide-y divide-stone-800 text-sm">
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
                </>
              ) : (
                <div
                  className="space-y-4"
                  aria-label={tAccess("transactionHistoryTimeline")}
                >
                  <p className="text-xs text-stone-400 leading-relaxed">
                    {tHistory("description")}
                  </p>

                  {historyLoading && (
                    <div className="py-12 text-center text-sm text-stone-400 flex flex-col items-center gap-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-600 border-t-emerald-500" />
                      <span>{tHistory("loading")}</span>
                    </div>
                  )}

                  {historyError && (
                    <div className="rounded-xl border border-rose-900/60 bg-rose-950/40 p-4 text-xs text-rose-300">
                      {tHistory("loadError")}
                    </div>
                  )}

                  {!historyLoading &&
                    !historyError &&
                    historyData &&
                    historyData.length === 0 && (
                      <div className="py-8 text-center text-sm text-stone-500">
                        {tHistory("empty")}
                      </div>
                    )}

                  {!historyLoading &&
                    !historyError &&
                    historyData &&
                    historyData.length > 0 && (
                      <ol className="relative border-l border-stone-800 ml-3 space-y-6">
                        {historyData.map((entry) => {
                          const isCreate = entry.operation === "create";
                          const isCorrection = entry.operation === "correction";
                          const isVoid = entry.operation === "void";
                          const isBaseline = entry.isBaseline;

                          const badgeColor = isCreate
                            ? "border-emerald-800/80 bg-emerald-950 text-emerald-300"
                            : isCorrection
                              ? "border-sky-800/80 bg-sky-950 text-sky-300"
                              : isVoid
                                ? "border-rose-800/80 bg-rose-950 text-rose-300"
                                : "border-stone-700 bg-stone-800 text-stone-300";

                          const dotColor = isCreate
                            ? "bg-emerald-500 ring-emerald-950"
                            : isCorrection
                              ? "bg-sky-500 ring-sky-950"
                              : isVoid
                                ? "bg-rose-500 ring-rose-950"
                                : "bg-stone-500 ring-stone-950";

                          return (
                            <li key={entry.id} className="ml-6">
                              <span
                                className={`absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full ring-4 ${dotColor}`}
                              />

                              <div className="rounded-xl border border-stone-800 bg-stone-950/60 p-4 shadow-xs">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-800/60 pb-2.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-stone-200">
                                      {tHistory("revisionLabel", {
                                        revision: entry.revision,
                                      })}
                                    </span>
                                    <span
                                      className={`rounded-md border px-2 py-0.5 text-xs font-medium ${badgeColor}`}
                                    >
                                      {tHistory(`operations.${entry.operation}`)}
                                    </span>
                                    <span className="rounded-md border border-stone-800 bg-stone-900 px-2 py-0.5 text-xs text-stone-400">
                                      {tHistory(`sources.${entry.source}`)}
                                    </span>
                                  </div>
                                  <time className="text-xs text-stone-400">
                                    {formatDateTime(entry.recordedAt)}
                                  </time>
                                </div>

                                <div className="mt-2 text-xs text-stone-400 flex items-center justify-between">
                                  {entry.actor?.displayName ? (
                                    <span>
                                      {tHistory("actor.by", {
                                        name: entry.actor.displayName,
                                      })}
                                    </span>
                                  ) : (
                                    <span className="italic text-stone-500">
                                      {tHistory("actor.unknown")}
                                    </span>
                                  )}
                                </div>

                                {isBaseline && (
                                  <p className="mt-2 text-xs text-amber-400/90 italic bg-amber-950/20 border border-amber-900/30 rounded-lg p-2">
                                    {tHistory("baselineNotice")}
                                  </p>
                                )}

                                {entry.voidReason && (
                                  <div className="mt-2 rounded-lg border border-rose-900/40 bg-rose-950/30 p-2 text-xs text-rose-300">
                                    <span className="font-medium text-rose-400">
                                      {tHistory("fields.fieldVoidReason")}:{" "}
                                    </span>
                                    <span className="italic">
                                      "{entry.voidReason}"
                                    </span>
                                  </div>
                                )}

                                {entry.changes.length > 0 ? (
                                  <ul className="mt-3 divide-y divide-stone-800/60 border-t border-stone-800/60 pt-2 text-xs">
                                    {entry.changes.map((c) => (
                                      <li
                                        key={c.field}
                                        className="flex flex-wrap items-baseline justify-between gap-2 py-1"
                                      >
                                        <span className="text-stone-400 font-medium">
                                          {tHistory(`fields.${c.fieldLabelKey}`)}:
                                        </span>
                                        <div className="flex items-center gap-1.5 font-mono text-xs">
                                          {c.before !== null && (
                                            <span className="text-stone-400 line-through">
                                              {c.before}
                                            </span>
                                          )}
                                          {c.before !== null && (
                                            <span className="text-stone-600">
                                              →
                                            </span>
                                          )}
                                          <span className="font-semibold text-stone-100">
                                            {c.after ?? "—"}
                                          </span>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  !isBaseline && (
                                    <p className="mt-2 text-xs text-stone-500 italic">
                                      {tHistory("noChanges")}
                                    </p>
                                  )
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                </div>
              )}
            </div>

            <div className="border-t border-stone-800 p-4 px-6 flex justify-end bg-stone-900">
              <button
                type="button"
                onClick={() => {
                  setInspectTx(null);
                  setActiveInspectTab("details");
                }}
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
