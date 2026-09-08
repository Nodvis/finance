"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import type {
  HouseholdAccountSummary,
  HouseholdCategorySummary,
} from "@nodvis/finance-db";
import { parseNaturalDecimalToMinor } from "@/lib/transactions/money-entry";
import { formatAmountPresentation } from "@/lib/transactions/presentation";

type TransactionFormsProps = {
  householdId: string;
  accounts: HouseholdAccountSummary[];
  categories?: HouseholdCategorySummary[];
  defaultCurrency: string;
  locale: string;
};

type TabKind = "expense" | "income" | "transfer";

const DRAFT_STORAGE_KEY = "nodvis_tx_form_draft";

function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function TransactionForms({
  householdId,
  accounts,
  categories = [],
  defaultCurrency,
  locale,
}: TransactionFormsProps) {
  const t = useTranslations("Transactions");
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabKind>("expense");
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    accounts[0]?.id ?? "",
  );
  const [fromAccountId, setFromAccountId] = useState<string>(
    accounts[0]?.id ?? "",
  );
  const [toAccountId, setToAccountId] = useState<string>(
    accounts[1]?.id ?? "",
  );

  const [amountInput, setAmountInput] = useState("");
  const [payee, setPayee] = useState("");
  const [source, setSource] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [occurredOn, setOccurredOn] = useState(getTodayDateString());

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Restore draft state from sessionStorage across locale switches/page reloads
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.activeTab) setActiveTab(draft.activeTab);
        if (draft.selectedAccountId && accounts.some((a) => a.id === draft.selectedAccountId)) {
          setSelectedAccountId(draft.selectedAccountId);
        }
        if (draft.fromAccountId && accounts.some((a) => a.id === draft.fromAccountId)) {
          setFromAccountId(draft.fromAccountId);
        }
        if (draft.toAccountId && accounts.some((a) => a.id === draft.toAccountId)) {
          setToAccountId(draft.toAccountId);
        }
        if (draft.amountInput) setAmountInput(draft.amountInput);
        if (draft.payee) setPayee(draft.payee);
        if (draft.source) setSource(draft.source);
        if (draft.categoryId) setCategoryId(draft.categoryId);
        if (draft.occurredOn) setOccurredOn(draft.occurredOn);
      }
    } catch {
      // Ignore storage read errors
    }
  }, [accounts]);

  // Persist draft to sessionStorage whenever form values change
  useEffect(() => {
    try {
      const draft = {
        activeTab,
        selectedAccountId,
        fromAccountId,
        toAccountId,
        amountInput,
        payee,
        source,
        categoryId,
        occurredOn,
      };
      sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Ignore storage write errors
    }
  }, [
    activeTab,
    selectedAccountId,
    fromAccountId,
    toAccountId,
    amountInput,
    payee,
    source,
    categoryId,
    occurredOn,
  ]);

  const availableCategories = useMemo(() => {
    if (!categories) return [];
    if (activeTab === "expense") {
      return categories.filter(
        (c) =>
          !c.archivedAt &&
          (c.applicability === "expense" || c.applicability === "both"),
      );
    }
    if (activeTab === "income") {
      return categories.filter(
        (c) =>
          !c.archivedAt &&
          (c.applicability === "income" || c.applicability === "both"),
      );
    }
    return [];
  }, [categories, activeTab]);

  // Selected account for expense/income
  const selectedAccount = useMemo(() => {
    return accounts.find((a) => a.id === selectedAccountId) ?? accounts[0];
  }, [accounts, selectedAccountId]);

  // Selected fromAccount for transfer
  const selectedFromAccount = useMemo(() => {
    return accounts.find((a) => a.id === fromAccountId) ?? accounts[0];
  }, [accounts, fromAccountId]);

  // Eligible toAccounts for transfer: different account and matching currency
  const eligibleToAccounts = useMemo(() => {
    if (!selectedFromAccount) return [];
    return accounts.filter(
      (a) =>
        a.id !== selectedFromAccount.id &&
        a.currency === selectedFromAccount.currency,
    );
  }, [accounts, selectedFromAccount]);

  // Current currency for amount preview and fraction digit parsing
  const currentCurrency =
    activeTab === "transfer"
      ? selectedFromAccount?.currency ?? defaultCurrency
      : selectedAccount?.currency ?? defaultCurrency;

  // Natural decimal conversion using exact BigInt arithmetic
  const parseResult = useMemo(
    () => parseNaturalDecimalToMinor(amountInput, currentCurrency),
    [amountInput, currentCurrency],
  );

  // Live amount preview formatted to user locale
  const formattedPreview = useMemo(() => {
    if (!parseResult.success || !parseResult.amountMinor) return null;
    return formatAmountPresentation(
      parseResult.amountMinor,
      currentCurrency,
      locale,
    );
  }, [parseResult, locale, currentCurrency]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setNotification(null);

    const parseRes = parseNaturalDecimalToMinor(amountInput, currentCurrency);
    if (!parseRes.success || !parseRes.amountMinor) {
      setNotification({
        type: "error",
        message: t("form.amountRequired"),
      });
      return;
    }

    const minorUnits = parseRes.amountMinor;
    setIsSubmitting(true);

    try {
      let payload: Record<string, unknown>;

      if (activeTab === "expense") {
        if (!payee.trim()) {
          setNotification({ type: "error", message: t("form.payeeRequired") });
          setIsSubmitting(false);
          return;
        }
        payload = {
          kind: "expense",
          accountId: selectedAccountId || selectedAccount?.id,
          categoryId: categoryId ? categoryId : null,
          amountMinor: minorUnits,
          currency: selectedAccount?.currency ?? defaultCurrency,
          payee: payee.trim(),
          occurredOn,
        };
      } else if (activeTab === "income") {
        if (!source.trim()) {
          setNotification({ type: "error", message: t("form.sourceRequired") });
          setIsSubmitting(false);
          return;
        }
        payload = {
          kind: "income",
          accountId: selectedAccountId || selectedAccount?.id,
          categoryId: categoryId ? categoryId : null,
          amountMinor: minorUnits,
          currency: selectedAccount?.currency ?? defaultCurrency,
          source: source.trim(),
          occurredOn,
        };
      } else {
        // transfer
        if (!fromAccountId || !toAccountId || fromAccountId === toAccountId) {
          setNotification({
            type: "error",
            message: t("form.transferSameAccountError"),
          });
          setIsSubmitting(false);
          return;
        }
        payload = {
          kind: "transfer",
          fromAccountId,
          toAccountId,
          amountMinor: minorUnits,
          currency: selectedFromAccount?.currency ?? defaultCurrency,
          occurredOn,
        };
      }

      const res = await fetch(`/api/households/${householdId}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        setNotification({
          type: "error",
          message: errJson.error || t("form.errorGeneric"),
        });
      } else {
        setNotification({
          type: "success",
          message: t("form.success"),
        });
        setAmountInput("");
        setPayee("");
        setSource("");
        setCategoryId("");
        try {
          sessionStorage.removeItem(DRAFT_STORAGE_KEY);
        } catch {
          // Ignore storage cleanup error
        }
        router.refresh();
      }
    } catch {
      setNotification({
        type: "error",
        message: t("form.errorGeneric"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (accounts.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-800 bg-stone-900/80 p-6 shadow-xs backdrop-blur-xs">
        <h2 className="text-lg font-semibold text-stone-100">
          {t("sectionTitle")}
        </h2>
        <p className="mt-2 text-sm text-stone-400">
          {t("form.noAccounts")}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-800 bg-stone-900/80 p-6 shadow-xs backdrop-blur-xs">
      <header className="mb-5">
        <h2 className="text-xl font-semibold tracking-tight text-stone-100">
          {t("sectionTitle")}
        </h2>
        <p className="mt-1 text-sm text-stone-400">
          {t("sectionDescription")}
        </p>
      </header>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label={t("sectionTitle")}
        className="flex gap-2 border-b border-stone-800 pb-3"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "expense"}
          onClick={() => {
            setActiveTab("expense");
            setNotification(null);
          }}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-rose-500/50 ${
            activeTab === "expense"
              ? "bg-rose-950/70 text-rose-200 border border-rose-800/60 shadow-xs"
              : "text-stone-400 hover:bg-stone-800/60 hover:text-stone-200"
          }`}
        >
          {t("tabs.expense")}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "income"}
          onClick={() => {
            setActiveTab("income");
            setNotification(null);
          }}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${
            activeTab === "income"
              ? "bg-emerald-950/70 text-emerald-200 border border-emerald-800/60 shadow-xs"
              : "text-stone-400 hover:bg-stone-800/60 hover:text-stone-200"
          }`}
        >
          {t("tabs.income")}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "transfer"}
          onClick={() => {
            setActiveTab("transfer");
            setNotification(null);
          }}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-sky-500/50 ${
            activeTab === "transfer"
              ? "bg-sky-950/70 text-sky-200 border border-sky-800/60 shadow-xs"
              : "text-stone-400 hover:bg-stone-800/60 hover:text-stone-200"
          }`}
        >
          {t("tabs.transfer")}
        </button>
      </div>

      {notification && (
        <div
          role="alert"
          className={`mt-4 rounded-lg p-3 text-sm border ${
            notification.type === "success"
              ? "bg-emerald-950/50 text-emerald-200 border-emerald-900"
              : "bg-rose-950/50 text-rose-200 border-rose-900"
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Transfer requires 2 accounts check */}
      {activeTab === "transfer" && accounts.length < 2 ? (
        <div className="mt-5 rounded-lg border border-amber-900/60 bg-amber-950/30 p-4 text-sm text-amber-200">
          <p className="font-medium">{t("form.transferRequiresTwoAccounts")}</p>
          <p className="mt-1 text-xs opacity-90">
            {t("form.transferInvariantNotice")}
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {activeTab === "transfer" && (
            <div className="rounded-lg border border-stone-800 bg-stone-950/60 p-3 text-xs text-stone-400">
              {t("form.transferInvariantNotice")}
            </div>
          )}

          {/* Account Selection */}
          {activeTab === "transfer" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="from-account"
                  className="block text-sm font-medium text-stone-300"
                >
                  {t("form.fromAccount")}
                </label>
                <select
                  id="from-account"
                  value={fromAccountId}
                  onChange={(e) => {
                    const newFrom = e.target.value;
                    setFromAccountId(newFrom);
                    const newFromAcc = accounts.find((a) => a.id === newFrom);
                    const firstEligible = accounts.find(
                      (a) => a.id !== newFrom && a.currency === newFromAcc?.currency,
                    );
                    if (firstEligible) {
                      setToAccountId(firstEligible.id);
                    }
                  }}
                  className="mt-1 block w-full rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-100 shadow-xs focus:border-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"
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
                  htmlFor="to-account"
                  className="block text-sm font-medium text-stone-300"
                >
                  {t("form.toAccount")}
                </label>
                <select
                  id="to-account"
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-100 shadow-xs focus:border-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"
                >
                  {eligibleToAccounts.length === 0 ? (
                    <option disabled value="">
                      {t("form.transferNoMatchingCurrency")}
                    </option>
                  ) : (
                    eligibleToAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.currency})
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label
                htmlFor="single-account"
                className="block text-sm font-medium text-stone-300"
              >
                {t("form.account")}
              </label>
              <select
                id="single-account"
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-100 shadow-xs focus:border-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.currency})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Payee / Source */}
          {activeTab === "expense" && (
            <div>
              <label
                htmlFor="expense-payee"
                className="block text-sm font-medium text-stone-300"
              >
                {t("form.payee")}
              </label>
              <input
                id="expense-payee"
                type="text"
                required
                maxLength={160}
                value={payee}
                onChange={(e) => setPayee(e.target.value)}
                placeholder={t("form.payeePlaceholder")}
                className="mt-1 block w-full rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-500 shadow-xs focus:border-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
            </div>
          )}

          {activeTab === "income" && (
            <div>
              <label
                htmlFor="income-source"
                className="block text-sm font-medium text-stone-300"
              >
                {t("form.source")}
              </label>
              <input
                id="income-source"
                type="text"
                required
                maxLength={160}
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder={t("form.sourcePlaceholder")}
                className="mt-1 block w-full rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-500 shadow-xs focus:border-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
            </div>
          )}

          {/* Category Selection (Expense & Income only) */}
          {activeTab !== "transfer" && (
            <div>
              <label
                htmlFor="transaction-category"
                className="block text-sm font-medium text-stone-300"
              >
                {t("form.category")}
              </label>
              <select
                id="transaction-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-100 shadow-xs focus:border-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"
              >
                <option value="">
                  {t("form.selectCategory")}
                </option>
                {availableCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-stone-400">
                {t("form.categoryHelp")}
              </p>
            </div>
          )}

          {/* Amount (Natural Decimal Input) & Currency */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label
                htmlFor="amount-input"
                className="block text-sm font-medium text-stone-300"
              >
                {t("form.amountMinor")}
              </label>
              <input
                id="amount-input"
                type="text"
                inputMode="decimal"
                required
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder={t("form.amountMinorPlaceholder")}
                className="mt-1 block w-full rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-sm font-mono text-stone-100 placeholder:text-stone-500 shadow-xs focus:border-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
              <p className="mt-1 text-xs text-stone-400">
                {t("form.amountHelp")}
              </p>
              {formattedPreview && (
                <p className="mt-1.5 text-xs text-stone-400">
                  {t("form.amountPreview")}:{" "}
                  <span className="font-semibold text-stone-100 font-mono">
                    {formattedPreview}
                  </span>
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="transaction-currency"
                className="block text-sm font-medium text-stone-300"
              >
                {t("form.currency")}
              </label>
              <input
                id="transaction-currency"
                type="text"
                readOnly
                value={currentCurrency}
                className="mt-1 block w-full rounded-lg border border-stone-800 bg-stone-950 px-3 py-2 text-sm font-mono font-semibold text-stone-300 shadow-xs"
              />
            </div>
          </div>

          {/* Date */}
          <div>
            <label
              htmlFor="occurred-on"
              className="block text-sm font-medium text-stone-300"
            >
              {t("form.date")}
            </label>
            <input
              id="occurred-on"
              type="date"
              required
              value={occurredOn}
              onChange={(e) => setOccurredOn(e.target.value)}
              className="mt-1 block w-full max-w-xs rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-100 shadow-xs focus:border-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={
                isSubmitting ||
                (activeTab === "transfer" && eligibleToAccounts.length === 0)
              }
              className="rounded-lg bg-stone-100 px-5 py-2.5 text-sm font-semibold text-stone-900 shadow-sm transition-all hover:bg-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 focus:ring-offset-stone-900 disabled:opacity-50"
            >
              {isSubmitting
                ? t("form.submitting")
                : activeTab === "expense"
                  ? t("form.submitExpense")
                  : activeTab === "income"
                    ? t("form.submitIncome")
                    : t("form.submitTransfer")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
