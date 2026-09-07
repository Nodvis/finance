"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import type { HouseholdAccountSummary } from "@nodvis/finance-db";
import { formatAmountPresentation } from "@/lib/transactions/presentation";

type TransactionFormsProps = {
  householdId: string;
  accounts: HouseholdAccountSummary[];
  defaultCurrency: string;
  locale: string;
};

type TabKind = "expense" | "income" | "transfer";

function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseToMinorString(input: string): string | null {
  const trimmed = input.trim().replace(",", ".");
  if (/^[1-9]\d*$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/^([1-9]\d*)\.(\d{1,2})$/);
  if (match && match[1] && match[2]) {
    const whole = match[1];
    const fraction = match[2].padEnd(2, "0");
    return `${whole}${fraction}`;
  }
  return null;
}

export function TransactionForms({
  householdId,
  accounts,
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
  const [occurredOn, setOccurredOn] = useState(getTodayDateString());

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

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

  // Current currency for amount preview
  const currentCurrency =
    activeTab === "transfer"
      ? selectedFromAccount?.currency ?? defaultCurrency
      : selectedAccount?.currency ?? defaultCurrency;

  // Live amount preview
  const parsedMinor = useMemo(
    () => parseToMinorString(amountInput),
    [amountInput],
  );

  const formattedPreview = useMemo(() => {
    if (!parsedMinor) return null;
    return formatAmountPresentation(parsedMinor, currentCurrency, locale);
  }, [parsedMinor, locale, currentCurrency]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setNotification(null);

    const minorUnits = parseToMinorString(amountInput);
    if (!minorUnits) {
      setNotification({
        type: "error",
        message: t("form.amountRequired"),
      });
      return;
    }

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
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900">
        <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
          {t("sectionTitle")}
        </h2>
        <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
          {t("form.noAccounts")}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900">
      <header className="mb-5">
        <h2 className="text-xl font-semibold text-stone-900 dark:text-stone-100">
          {t("sectionTitle")}
        </h2>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          {t("sectionDescription")}
        </p>
      </header>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label={t("sectionTitle")}
        className="flex gap-2 border-b border-stone-200 pb-3 dark:border-stone-800"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "expense"}
          onClick={() => {
            setActiveTab("expense");
            setNotification(null);
          }}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "expense"
              ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200"
              : "text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
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
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "income"
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"
              : "text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
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
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "transfer"
              ? "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200"
              : "text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
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
              ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-900"
              : "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:border-rose-900"
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Transfer requires 2 accounts check */}
      {activeTab === "transfer" && accounts.length < 2 ? (
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-medium">{t("form.transferRequiresTwoAccounts")}</p>
          <p className="mt-1 text-xs opacity-90">
            {t("form.transferInvariantNotice")}
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {activeTab === "transfer" && (
            <div className="rounded-lg bg-stone-50 p-3 text-xs text-stone-600 dark:bg-stone-800/60 dark:text-stone-300">
              {t("form.transferInvariantNotice")}
            </div>
          )}

          {/* Account Selection */}
          {activeTab === "transfer" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="from-account"
                  className="block text-sm font-medium text-stone-700 dark:text-stone-300"
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
                  className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
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
                  className="block text-sm font-medium text-stone-700 dark:text-stone-300"
                >
                  {t("form.toAccount")}
                </label>
                <select
                  id="to-account"
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
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
                className="block text-sm font-medium text-stone-700 dark:text-stone-300"
              >
                {t("form.account")}
              </label>
              <select
                id="single-account"
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
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
                className="block text-sm font-medium text-stone-700 dark:text-stone-300"
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
                className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              />
            </div>
          )}

          {activeTab === "income" && (
            <div>
              <label
                htmlFor="income-source"
                className="block text-sm font-medium text-stone-700 dark:text-stone-300"
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
                className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              />
            </div>
          )}

          {/* Amount Minor (Exact String) & Currency */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label
                htmlFor="amount-minor"
                className="block text-sm font-medium text-stone-700 dark:text-stone-300"
              >
                {t("form.amountMinor")}
              </label>
              <input
                id="amount-minor"
                type="text"
                inputMode="numeric"
                required
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder={t("form.amountMinorPlaceholder")}
                className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              />
              <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                {t("form.amountHelp")}
              </p>
              {formattedPreview && (
                <p className="mt-1 text-xs font-medium text-stone-700 dark:text-stone-300">
                  {t("form.amountPreview")}:{" "}
                  <span className="font-semibold text-stone-900 dark:text-stone-100">
                    {formattedPreview}
                  </span>{" "}
                  <span className="text-stone-400">
                    ({parsedMinor} minor units)
                  </span>
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="transaction-currency"
                className="block text-sm font-medium text-stone-700 dark:text-stone-300"
              >
                {t("form.currency")}
              </label>
              <input
                id="transaction-currency"
                type="text"
                readOnly
                value={currentCurrency}
                className="mt-1 block w-full rounded-lg border border-stone-200 bg-stone-100 px-3 py-2 text-sm font-semibold text-stone-700 shadow-sm dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300"
              />
            </div>
          </div>

          {/* Date */}
          <div>
            <label
              htmlFor="occurred-on"
              className="block text-sm font-medium text-stone-700 dark:text-stone-300"
            >
              {t("form.date")}
            </label>
            <input
              id="occurred-on"
              type="date"
              required
              value={occurredOn}
              onChange={(e) => setOccurredOn(e.target.value)}
              className="mt-1 block w-full max-w-xs rounded-lg border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={
                isSubmitting ||
                (activeTab === "transfer" && eligibleToAccounts.length === 0)
              }
              className="rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-medium text-white shadow hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:ring-offset-2 disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
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
