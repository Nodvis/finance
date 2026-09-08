"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import type { HouseholdAccessSummary } from "@nodvis/finance-db";
import type { SerializedHouseholdAccount } from "@/lib/accounts/serialization";
import type { AuthorizedHouseholdUserContext } from "@/lib/authorization/household";
import { formatAmountPresentation } from "@/lib/transactions/presentation";

const COMMON_CURRENCIES = ["PLN", "EUR", "USD", "GBP", "CHF"] as const;
const ACCOUNT_TYPES = ["checking", "savings", "cash", "credit_card"] as const;

type Member = {
  personId: string;
  displayName: string;
};

type AccountsViewProps = {
  householdContext: AuthorizedHouseholdUserContext;
  allHouseholds: HouseholdAccessSummary[];
  initialAccounts: SerializedHouseholdAccount[];
  members: Member[];
  locale: string;
};

export function AccountsView({
  householdContext,
  initialAccounts,
  members,
  locale,
}: AccountsViewProps) {
  const tAccounts = useTranslations("Accounts");
  const tAccess = useTranslations("Accessibility");
  const router = useRouter();

  const [accounts, setAccounts] = useState<SerializedHouseholdAccount[]>(initialAccounts);
  const [showArchived, setShowArchived] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SerializedHouseholdAccount | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Form states for creating account
  const [name, setName] = useState("");
  const [type, setType] = useState<(typeof ACCOUNT_TYPES)[number]>("checking");
  const [currency, setCurrency] = useState(householdContext.defaultCurrency);
  const [selectedOwnerIds, setSelectedOwnerIds] = useState<string[]>([
    householdContext.personId,
  ]);
  const [initialBalanceNatural, setInitialBalanceNatural] = useState("");
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Form states for editing account
  const [editName, setEditName] = useState("");
  const [editOwnerIds, setEditOwnerIds] = useState<string[]>([]);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const activeAccounts = accounts.filter((a) => a.archivedAt === null);
  const archivedAccounts = accounts.filter((a) => a.archivedAt !== null);

  const handleCreateSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (selectedOwnerIds.length === 0) {
      setStatusMessage({
        type: "error",
        text: tAccounts("form.errorOwnersRequired"),
      });
      return;
    }

    setIsSubmittingCreate(true);
    setStatusMessage(null);

    try {
      const payload = {
        name: name.trim(),
        type,
        currency,
        ownerPersonIds: selectedOwnerIds,
        initialBalance: initialBalanceNatural.trim()
          ? {
              amountNatural: initialBalanceNatural.trim(),
              capturedAt: new Date().toISOString(),
            }
          : null,
      };

      const res = await fetch(
        `/api/households/${householdContext.householdId}/accounts`,
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
          text: json.error || tAccounts("form.errorGeneric"),
        });
      } else {
        setAccounts((prev) => [...prev, json.data]);
        setName("");
        setType("checking");
        setInitialBalanceNatural("");
        setSelectedOwnerIds([householdContext.personId]);
        setIsCreating(false);
        setStatusMessage({
          type: "success",
          text: tAccounts("form.successAdd"),
        });
        router.refresh();
      }
    } catch {
      setStatusMessage({
        type: "error",
        text: tAccounts("form.errorGeneric"),
      });
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const startEdit = (acc: SerializedHouseholdAccount) => {
    setEditingAccount(acc);
    setEditName(acc.name);
    setEditOwnerIds(acc.ownerPersonIds);
    setStatusMessage(null);
  };

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingAccount) return;

    if (editOwnerIds.length === 0) {
      setStatusMessage({
        type: "error",
        text: tAccounts("form.errorOwnersRequired"),
      });
      return;
    }

    setIsSubmittingEdit(true);
    setStatusMessage(null);

    try {
      const payload = {
        name: editName.trim(),
        ownerPersonIds: editOwnerIds,
      };

      const res = await fetch(
        `/api/households/${householdContext.householdId}/accounts/${editingAccount.id}`,
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
          text: json.error || tAccounts("form.errorGeneric"),
        });
      } else {
        setAccounts((prev) =>
          prev.map((a) => (a.id === editingAccount.id ? json.data : a)),
        );
        setEditingAccount(null);
        setStatusMessage({
          type: "success",
          text: tAccounts("form.successEdit"),
        });
        router.refresh();
      }
    } catch {
      setStatusMessage({
        type: "error",
        text: tAccounts("form.errorGeneric"),
      });
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleArchive = async (accountId: string) => {
    if (!window.confirm(tAccounts("archiveConfirm"))) {
      return;
    }

    setActionLoadingId(accountId);
    setStatusMessage(null);

    try {
      const res = await fetch(
        `/api/households/${householdContext.householdId}/accounts/${accountId}/archive`,
        { method: "POST" },
      );
      const json = await res.json();
      if (!res.ok) {
        setStatusMessage({
          type: "error",
          text: json.error || tAccounts("form.errorGeneric"),
        });
      } else {
        setAccounts((prev) =>
          prev.map((a) => (a.id === accountId ? json.data : a)),
        );
        setStatusMessage({
          type: "success",
          text: tAccounts("form.successArchive"),
        });
        router.refresh();
      }
    } catch {
      setStatusMessage({
        type: "error",
        text: tAccounts("form.errorGeneric"),
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUnarchive = async (accountId: string) => {
    setActionLoadingId(accountId);
    setStatusMessage(null);

    try {
      const res = await fetch(
        `/api/households/${householdContext.householdId}/accounts/${accountId}/unarchive`,
        { method: "POST" },
      );
      const json = await res.json();
      if (!res.ok) {
        setStatusMessage({
          type: "error",
          text: json.error || tAccounts("form.errorGeneric"),
        });
      } else {
        setAccounts((prev) =>
          prev.map((a) => (a.id === accountId ? json.data : a)),
        );
        setStatusMessage({
          type: "success",
          text: tAccounts("form.successUnarchive"),
        });
        router.refresh();
      }
    } catch {
      setStatusMessage({
        type: "error",
        text: tAccounts("form.errorGeneric"),
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const toggleOwner = (personId: string, current: string[], setter: (val: string[]) => void) => {
    if (current.includes(personId)) {
      setter(current.filter((id) => id !== personId));
    } else {
      setter([...current, personId]);
    }
  };

  const getOwnerNames = (ownerPersonIds: string[]) => {
    return ownerPersonIds
      .map((id) => members.find((m) => m.personId === id)?.displayName || id)
      .join(", ");
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header Overview */}
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400/80">
          {tAccounts("eyebrow")}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-stone-100">
          {tAccounts("title")}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-500 sm:text-base dark:text-stone-400">
          {tAccounts("description")}
        </p>
      </header>

      {/* Status Feedback Notification */}
      {statusMessage && (
        <div
          role="alert"
          className={`rounded-lg border p-3 text-sm ${
            statusMessage.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/80 dark:bg-emerald-950/60 dark:text-emerald-200"
              : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/80 dark:bg-rose-950/60 dark:text-rose-200"
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300">
            {tAccounts("activeAccounts")}:{" "}
            <strong className="font-semibold text-slate-900 dark:text-stone-100">
              {activeAccounts.length}
            </strong>
          </span>
          {archivedAccounts.length > 0 && (
            <button
              type="button"
              onClick={() => setShowArchived(!showArchived)}
              className="text-xs text-slate-500 underline underline-offset-4 transition-colors hover:text-slate-800 focus:outline-none dark:text-stone-400 dark:hover:text-stone-200"
            >
              {showArchived
                ? tAccounts("hideArchived")
                : tAccounts("showArchived", { count: archivedAccounts.length })}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setIsCreating(true);
            setStatusMessage(null);
          }}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-emerald-500 dark:text-stone-950 dark:hover:bg-emerald-400"
        >
          + {tAccounts("actions.addAccount")}
        </button>
      </div>

      {/* Focused Create Account Modal / Dialog */}
      {isCreating && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={tAccess("createAccountForm")}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs overflow-y-auto dark:bg-black/60"
        >
          <div className="relative w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-stone-800 dark:bg-stone-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-stone-800">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-stone-100">
                {tAccounts("actions.addAccount")}
              </h2>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-xs text-slate-400 hover:text-slate-700 transition-colors focus:outline-none dark:text-stone-400 dark:hover:text-stone-200"
              >
                {tAccounts("actions.cancel")}
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="account-name"
                  className="block text-sm font-medium text-slate-700 dark:text-stone-300"
                >
                  {tAccounts("form.name")}
                </label>
                <input
                  id="account-name"
                  type="text"
                  required
                  maxLength={160}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={tAccounts("form.namePlaceholder")}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="account-type"
                    className="block text-sm font-medium text-slate-700 dark:text-stone-300"
                  >
                    {tAccounts("form.type")}
                  </label>
                  <select
                    id="account-type"
                    value={type}
                    onChange={(e) =>
                      setType(e.target.value as (typeof ACCOUNT_TYPES)[number])
                    }
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
                  >
                    {ACCOUNT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {tAccounts(`types.${t}`)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="account-currency"
                    className="block text-sm font-medium text-slate-700 dark:text-stone-300"
                  >
                    {tAccounts("form.currency")}
                  </label>
                  <select
                    id="account-currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
                  >
                    {COMMON_CURRENCIES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Same-Household Owners Multi-Select Checkboxes */}
              <div>
                <span className="block text-sm font-medium text-slate-700 dark:text-stone-300">
                  {tAccounts("form.owners")}
                </span>
                <p className="text-xs text-slate-500 dark:text-stone-400">
                  {tAccounts("form.ownersHelp")}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {members.map((m) => {
                    const isChecked = selectedOwnerIds.includes(m.personId);
                    return (
                      <label
                        key={m.personId}
                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                          isChecked
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-stone-500 dark:bg-stone-800 dark:text-stone-100"
                            : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:text-slate-800 dark:border-stone-800 dark:bg-stone-900/50 dark:text-stone-400 dark:hover:border-stone-700 dark:hover:text-stone-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          id={`owner-${m.personId}`}
                          checked={isChecked}
                          onChange={() =>
                            toggleOwner(
                              m.personId,
                              selectedOwnerIds,
                              setSelectedOwnerIds,
                            )
                          }
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-stone-700 dark:bg-stone-900"
                        />
                        <span>{m.displayName}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Initial Balance */}
              <div>
                <label
                  htmlFor="account-initial-balance"
                  className="block text-sm font-medium text-slate-700 dark:text-stone-300"
                >
                  {tAccounts("form.initialBalance")}
                </label>
                <input
                  id="account-initial-balance"
                  type="text"
                  value={initialBalanceNatural}
                  onChange={(e) => setInitialBalanceNatural(e.target.value)}
                  placeholder={tAccounts("form.initialBalancePlaceholder")}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-stone-400">
                  {tAccounts("form.initialBalanceHelp")}
                </p>
                {type === "credit_card" && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400/90">
                    {tAccounts("form.creditCardNotice")}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
                >
                  {tAccounts("actions.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 dark:bg-emerald-500 dark:text-stone-950 dark:hover:bg-emerald-400"
                >
                  {isSubmittingCreate
                    ? tAccounts("form.submittingAdd")
                    : tAccounts("form.submitAdd")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Focused Edit Account Modal */}
      {editingAccount && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={tAccess("editAccountForm")}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs overflow-y-auto dark:bg-black/60"
        >
          <div className="relative w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-stone-800 dark:bg-stone-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-stone-800">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-stone-100">
                {tAccounts("actions.edit")}: {editingAccount.name}
              </h2>
              <button
                type="button"
                onClick={() => setEditingAccount(null)}
                className="text-xs text-slate-400 hover:text-slate-700 transition-colors focus:outline-none dark:text-stone-400 dark:hover:text-stone-200"
              >
                {tAccounts("actions.cancel")}
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="edit-account-name"
                  className="block text-sm font-medium text-slate-700 dark:text-stone-300"
                >
                  {tAccounts("form.name")}
                </label>
                <input
                  id="edit-account-name"
                  type="text"
                  required
                  maxLength={160}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
                />
              </div>

              <div>
                <span className="block text-sm font-medium text-slate-700 dark:text-stone-300">
                  {tAccounts("form.owners")}
                </span>
                <p className="text-xs text-slate-500 dark:text-stone-400">
                  {tAccounts("form.ownersHelp")}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {members.map((m) => {
                    const isChecked = editOwnerIds.includes(m.personId);
                    return (
                      <label
                        key={m.personId}
                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                          isChecked
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-stone-500 dark:bg-stone-800 dark:text-stone-100"
                            : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:text-slate-800 dark:border-stone-800 dark:bg-stone-900/50 dark:text-stone-400 dark:hover:border-stone-700 dark:hover:text-stone-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() =>
                            toggleOwner(m.personId, editOwnerIds, setEditOwnerIds)
                          }
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-stone-700 dark:bg-stone-900"
                        />
                        <span>{m.displayName}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
                >
                  {tAccounts("actions.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 dark:bg-emerald-500 dark:text-stone-950 dark:hover:bg-emerald-400"
                >
                  {isSubmittingEdit
                    ? tAccounts("actions.saving")
                    : tAccounts("actions.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Active Accounts List */}
      <section
        aria-label={tAccess("accountsList")}
        className="flex flex-col gap-4"
      >
        <h2 className="text-sm font-semibold tracking-wide text-slate-700 uppercase dark:text-stone-300">
          {tAccounts("activeAccounts")}
        </h2>

        {activeAccounts.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-stone-800/80 dark:bg-stone-900/40">
            <h3 className="text-base font-semibold text-slate-800 dark:text-stone-200">
              {tAccounts("emptyActiveTitle")}
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-stone-400">
              {tAccounts("emptyActiveDescription")}
            </p>
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="mt-4 inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-emerald-500 dark:text-stone-950 dark:hover:bg-emerald-400"
            >
              + {tAccounts("actions.addAccount")}
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeAccounts.map((acc) => {
              const hasSnapshot = acc.balanceSnapshotMinor !== null;
              const minor = hasSnapshot ? BigInt(acc.balanceSnapshotMinor!) : null;
              const isCreditCard = acc.type === "credit_card";
              const isDebt = isCreditCard && minor !== null && minor < 0n;
              const isCredit = isCreditCard && minor !== null && minor > 0n;
              const isOverdraft = !isCreditCard && minor !== null && minor < 0n;

              return (
                <article
                  key={acc.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-colors hover:border-slate-300 dark:border-stone-800 dark:bg-stone-900/70 dark:hover:border-stone-700"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-stone-100">
                          {acc.name}
                        </h3>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:border-stone-700/80 dark:bg-stone-800 dark:text-stone-300">
                            {tAccounts(`types.${acc.type}`)}
                          </span>
                          <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-mono text-slate-600 dark:border-stone-700/80 dark:bg-stone-800 dark:text-stone-300">
                            {acc.currency}
                          </span>
                        </div>
                      </div>

                      {/* Financial State Badges */}
                      <div className="flex flex-col items-end gap-1">
                        {isDebt && (
                          <span className="rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                            {tAccounts("badges.debt")}
                          </span>
                        )}
                        {isCredit && (
                          <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            {tAccounts("badges.credit")}
                          </span>
                        )}
                        {isOverdraft && (
                          <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            {tAccounts("badges.overdraft")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Balance Snapshot Display */}
                    <div className="mt-4 border-t border-slate-100 pt-3 dark:border-stone-800/60">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-slate-500 dark:text-stone-400">
                          {hasSnapshot ? (
                            acc.balanceSnapshotAt ? (
                              <>
                                {tAccounts("capturedAtLabel")}{" "}
                                {new Date(acc.balanceSnapshotAt).toLocaleDateString(
                                  locale,
                                )}
                              </>
                            ) : null
                          ) : (
                            tAccounts("balanceUnknownHelp")
                          )}
                        </span>
                        <div className="text-right font-mono text-lg font-semibold tracking-tight text-slate-900 dark:text-stone-100">
                          {hasSnapshot ? (
                            formatAmountPresentation(
                              acc.balanceSnapshotMinor!,
                              acc.currency,
                              locale,
                            )
                          ) : (
                            <span className="text-slate-400 dark:text-stone-400">
                              —{" "}
                              <span className="text-xs font-sans font-normal">
                                ({tAccounts("balanceUnknown")})
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Owners */}
                    <div className="mt-3 text-xs text-slate-500 dark:text-stone-400">
                      <span>{tAccounts("ownersLabel")}: </span>
                      <span className="font-medium text-slate-700 dark:text-stone-300">
                        {getOwnerNames(acc.ownerPersonIds)}
                      </span>
                    </div>
                  </div>

                  {/* Actions (Import, Edit & Archive) */}
                  <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-stone-800/60">
                    <button
                      type="button"
                      onClick={() => router.push(`/${locale}/imports?accountId=${acc.id}`)}
                      className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100 focus:outline-none dark:border-amber-700/80 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-900/40"
                    >
                      {tAccounts("actions.importStatement")}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(acc)}
                      aria-label={`${tAccounts("actions.edit")} ${acc.name}`}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
                    >
                      {tAccounts("actions.edit")}
                    </button>
                    <button
                      type="button"
                      disabled={actionLoadingId === acc.id}
                      onClick={() => handleArchive(acc.id)}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-800 focus:outline-none disabled:opacity-50 dark:border-stone-800 dark:text-stone-400 dark:hover:border-stone-700 dark:hover:text-stone-300"
                    >
                      {actionLoadingId === acc.id
                        ? tAccounts("actions.archiving")
                        : tAccounts("actions.archive")}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Archived Accounts List */}
      {showArchived && (
        <section
          aria-label={tAccess("archivedAccountsList")}
          className="flex flex-col gap-4 border-t border-slate-200 pt-6 dark:border-stone-800/80"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-stone-400">
              {tAccounts("archivedAccounts")}
            </h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 font-mono dark:bg-stone-800 dark:text-stone-400">
              {archivedAccounts.length}
            </span>
          </div>

          {archivedAccounts.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-stone-400">
              {tAccounts("emptyArchivedDescription")}
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {archivedAccounts.map((acc) => (
                <article
                  key={acc.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200/60 bg-slate-50/50 p-5 opacity-80 transition-opacity hover:opacity-100 dark:border-stone-800/60 dark:bg-stone-900/40"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-slate-800 dark:text-stone-200">
                          {acc.name}
                        </h3>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:border-stone-700/60 dark:bg-stone-800/60 dark:text-stone-400">
                            {tAccounts(`types.${acc.type}`)}
                          </span>
                          <span className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-mono text-slate-500 dark:border-stone-700/60 dark:bg-stone-800/60 dark:text-stone-400">
                            {acc.currency}
                          </span>
                        </div>
                      </div>

                      <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400">
                        {tAccounts("badges.archived")}
                      </span>
                    </div>

                    <div className="mt-4 border-t border-slate-200/50 pt-3 text-xs text-slate-500 dark:border-stone-800/40 dark:text-stone-400">
                      <span>{tAccounts("ownersLabel")}: </span>
                      <span className="text-slate-700 dark:text-stone-300">
                        {getOwnerNames(acc.ownerPersonIds)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-end border-t border-slate-200/50 pt-3 dark:border-stone-800/40">
                    <button
                      type="button"
                      disabled={actionLoadingId === acc.id}
                      onClick={() => handleUnarchive(acc.id)}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
                    >
                      {actionLoadingId === acc.id
                        ? tAccounts("actions.unarchiving")
                        : tAccounts("actions.unarchive")}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
