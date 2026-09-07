"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import type { HouseholdAccessSummary } from "@nodvis/finance-db";
import type { SerializedHouseholdAccount } from "@/lib/accounts/serialization";
import type { AuthorizedHouseholdUserContext } from "@/lib/authorization/household";
import { formatAmountPresentation } from "@/lib/transactions/presentation";
import { SignOutButton } from "../components/SignOutButton";

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
  allHouseholds,
  initialAccounts,
  members,
  locale,
}: AccountsViewProps) {
  const tAccounts = useTranslations("Accounts");
  const tHousehold = useTranslations("Household");
  const tSelection = useTranslations("HouseholdSelection");
  const tAccess = useTranslations("Accessibility");
  const router = useRouter();

  const [accounts, setAccounts] = useState<SerializedHouseholdAccount[]>(initialAccounts);
  const [showArchived, setShowArchived] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SerializedHouseholdAccount | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [isSwitchingHousehold, setIsSwitchingHousehold] = useState(false);
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

  const handleSwitchHousehold = async (targetHouseholdId: string) => {
    try {
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
    }
  };

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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header Overview */}
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
          {tAccounts("eyebrow")}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-100 sm:text-3xl">
          {tAccounts("title")}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-stone-400 sm:text-base">
          {tAccounts("description")}
        </p>
      </header>

      {/* Household Context Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-800 bg-stone-900/60 p-4 shadow-xs backdrop-blur-xs">
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div>
            <span className="text-stone-400">{tHousehold("label")}: </span>
            <span className="font-semibold text-stone-100">
              {householdContext.householdName}
            </span>
          </div>
          <div>
            <span className="text-stone-400">{tHousehold("member")}: </span>
            <span className="font-medium text-stone-200">
              {householdContext.personDisplayName}
            </span>
          </div>
          <div>
            <span className="text-stone-400">{tHousehold("currency")}: </span>
            <span className="font-mono font-semibold text-stone-100">
              {householdContext.defaultCurrency}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {allHouseholds.length > 1 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSwitchingHousehold(!isSwitchingHousehold)}
                className="rounded-lg border border-stone-700 bg-stone-800 px-3 py-1.5 text-xs font-medium text-stone-200 transition-colors hover:bg-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-400"
              >
                {tSelection("switchButton")}
              </button>

              {isSwitchingHousehold && (
                <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-stone-700 bg-stone-900 p-2 shadow-xl backdrop-blur-md">
                  <p className="px-2 py-1 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                    {tSelection("title")}
                  </p>
                  {allHouseholds.map((h) => (
                    <button
                      key={h.householdId}
                      type="button"
                      onClick={() => {
                        setIsSwitchingHousehold(false);
                        handleSwitchHousehold(h.householdId);
                      }}
                      className={`w-full rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                        h.householdId === householdContext.householdId
                          ? "bg-stone-800 font-semibold text-stone-100"
                          : "text-stone-300 hover:bg-stone-800/60 hover:text-stone-100"
                      }`}
                    >
                      <div>{h.householdName}</div>
                      <div className="text-[10px] text-stone-400 font-mono">
                        {h.defaultCurrency}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <SignOutButton />
        </div>
      </div>

      {/* Status Feedback Notification */}
      {statusMessage && (
        <div
          role="alert"
          className={`rounded-lg border p-3 text-sm ${
            statusMessage.type === "success"
              ? "border-emerald-900/80 bg-emerald-950/60 text-emerald-200"
              : "border-rose-900/80 bg-rose-950/60 text-rose-200"
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-stone-900 border border-stone-800 px-3 py-1.5 text-xs text-stone-300">
            {tAccounts("activeAccounts")}:{" "}
            <strong className="text-stone-100 font-semibold">
              {activeAccounts.length}
            </strong>
          </span>
          {archivedAccounts.length > 0 && (
            <button
              type="button"
              onClick={() => setShowArchived(!showArchived)}
              className="text-xs text-stone-400 hover:text-stone-200 transition-colors underline underline-offset-4 focus:outline-none"
            >
              {showArchived
                ? tAccounts("hideArchived")
                : tAccounts("showArchived", { count: archivedAccounts.length })}
            </button>
          )}
        </div>

        {!isCreating && (
          <button
            type="button"
            onClick={() => {
              setIsCreating(true);
              setStatusMessage(null);
            }}
            className="rounded-lg bg-stone-100 px-4 py-2 text-xs font-semibold text-stone-900 shadow-sm transition-all hover:bg-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-400"
          >
            + {tAccounts("actions.addAccount")}
          </button>
        )}
      </div>

      {/* Create Account Form */}
      {isCreating && (
        <div
          aria-label={tAccess("createAccountForm")}
          className="rounded-2xl border border-stone-800 bg-stone-900/80 p-6 shadow-xs backdrop-blur-xs"
        >
          <div className="flex items-center justify-between border-b border-stone-800/80 pb-4">
            <h2 className="text-lg font-semibold tracking-tight text-stone-100">
              {tAccounts("actions.addAccount")}
            </h2>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="text-xs text-stone-400 hover:text-stone-200 transition-colors focus:outline-none"
            >
              {tAccounts("actions.cancel")}
            </button>
          </div>

          <form onSubmit={handleCreateSubmit} className="mt-5 max-w-xl space-y-4">
            <div>
              <label
                htmlFor="account-name"
                className="block text-sm font-medium text-stone-300"
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
                className="mt-1 block w-full rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-500 shadow-xs focus:border-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="account-type"
                  className="block text-sm font-medium text-stone-300"
                >
                  {tAccounts("form.type")}
                </label>
                <select
                  id="account-type"
                  value={type}
                  onChange={(e) =>
                    setType(e.target.value as (typeof ACCOUNT_TYPES)[number])
                  }
                  className="mt-1 block w-full rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-100 shadow-xs focus:border-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"
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
                  className="block text-sm font-medium text-stone-300"
                >
                  {tAccounts("form.currency")}
                </label>
                <select
                  id="account-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-100 shadow-xs focus:border-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"
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
              <span className="block text-sm font-medium text-stone-300">
                {tAccounts("form.owners")}
              </span>
              <p className="text-xs text-stone-400">
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
                          ? "border-stone-500 bg-stone-800 text-stone-100"
                          : "border-stone-800 bg-stone-900/50 text-stone-400 hover:border-stone-700 hover:text-stone-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() =>
                          toggleOwner(
                            m.personId,
                            selectedOwnerIds,
                            setSelectedOwnerIds,
                          )
                        }
                        className="rounded border-stone-700 bg-stone-900 text-stone-100 focus:ring-stone-400"
                      />
                      <span>{m.displayName}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Initial Balance (Optional, Preserves Unknown Balance as Unknown) */}
            <div>
              <label
                htmlFor="account-initial-balance"
                className="block text-sm font-medium text-stone-300"
              >
                {tAccounts("form.initialBalance")}
              </label>
              <input
                id="account-initial-balance"
                type="text"
                value={initialBalanceNatural}
                onChange={(e) => setInitialBalanceNatural(e.target.value)}
                placeholder={tAccounts("form.initialBalancePlaceholder")}
                className="mt-1 block w-full rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-500 shadow-xs focus:border-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400 font-mono"
              />
              <p className="mt-1 text-xs text-stone-400">
                {tAccounts("form.initialBalanceHelp")}
              </p>
              {type === "credit_card" && (
                <p className="mt-1 text-xs text-amber-400/90">
                  {tAccounts("form.creditCardNotice")}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmittingCreate}
                className="rounded-lg bg-stone-100 px-4 py-2 text-xs font-semibold text-stone-900 shadow-sm transition-all hover:bg-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-400 disabled:opacity-50"
              >
                {isSubmittingCreate
                  ? tAccounts("form.submittingAdd")
                  : tAccounts("form.submitAdd")}
              </button>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="rounded-lg border border-stone-700 px-4 py-2 text-xs font-medium text-stone-300 transition-colors hover:bg-stone-800 focus:outline-none"
              >
                {tAccounts("actions.cancel")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Account Modal / Drawer */}
      {editingAccount && (
        <div
          aria-label={tAccess("editAccountForm")}
          className="rounded-2xl border border-stone-800 bg-stone-900/90 p-6 shadow-md backdrop-blur-xs"
        >
          <div className="flex items-center justify-between border-b border-stone-800/80 pb-4">
            <h2 className="text-lg font-semibold tracking-tight text-stone-100">
              {tAccounts("actions.edit")}: {editingAccount.name}
            </h2>
            <button
              type="button"
              onClick={() => setEditingAccount(null)}
              className="text-xs text-stone-400 hover:text-stone-200 transition-colors focus:outline-none"
            >
              {tAccounts("actions.cancel")}
            </button>
          </div>

          <form onSubmit={handleEditSubmit} className="mt-5 max-w-xl space-y-4">
            <div>
              <label
                htmlFor="edit-account-name"
                className="block text-sm font-medium text-stone-300"
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
                className="mt-1 block w-full rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-100 shadow-xs focus:border-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
            </div>

            <div>
              <span className="block text-sm font-medium text-stone-300">
                {tAccounts("form.owners")}
              </span>
              <p className="text-xs text-stone-400">
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
                          ? "border-stone-500 bg-stone-800 text-stone-100"
                          : "border-stone-800 bg-stone-900/50 text-stone-400 hover:border-stone-700 hover:text-stone-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() =>
                          toggleOwner(m.personId, editOwnerIds, setEditOwnerIds)
                        }
                        className="rounded border-stone-700 bg-stone-900 text-stone-100 focus:ring-stone-400"
                      />
                      <span>{m.displayName}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmittingEdit}
                className="rounded-lg bg-stone-100 px-4 py-2 text-xs font-semibold text-stone-900 shadow-sm transition-all hover:bg-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-400 disabled:opacity-50"
              >
                {isSubmittingEdit
                  ? tAccounts("actions.saving")
                  : tAccounts("actions.save")}
              </button>
              <button
                type="button"
                onClick={() => setEditingAccount(null)}
                className="rounded-lg border border-stone-700 px-4 py-2 text-xs font-medium text-stone-300 transition-colors hover:bg-stone-800 focus:outline-none"
              >
                {tAccounts("actions.cancel")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active Accounts List */}
      <section
        aria-label={tAccess("accountsList")}
        className="flex flex-col gap-4"
      >
        <h2 className="text-sm font-semibold tracking-wide text-stone-300 uppercase">
          {tAccounts("activeAccounts")}
        </h2>

        {activeAccounts.length === 0 ? (
          <div className="rounded-2xl border border-stone-800/80 bg-stone-900/40 p-8 text-center">
            <h3 className="text-base font-semibold text-stone-200">
              {tAccounts("emptyActiveTitle")}
            </h3>
            <p className="mt-1 text-sm text-stone-400">
              {tAccounts("emptyActiveDescription")}
            </p>
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
                  className="flex flex-col justify-between rounded-2xl border border-stone-800 bg-stone-900/70 p-5 shadow-xs backdrop-blur-xs transition-colors hover:border-stone-700"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-stone-100">
                          {acc.name}
                        </h3>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="rounded-md border border-stone-700/80 bg-stone-800 px-2 py-0.5 text-[11px] font-medium text-stone-300">
                            {tAccounts(`types.${acc.type}`)}
                          </span>
                          <span className="rounded-md border border-stone-700/80 bg-stone-800 px-1.5 py-0.5 text-[11px] font-mono text-stone-300">
                            {acc.currency}
                          </span>
                        </div>
                      </div>

                      {/* Financial State Badges */}
                      <div className="flex flex-col items-end gap-1">
                        {isDebt && (
                          <span className="rounded-md border border-rose-800 bg-rose-950/60 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                            {tAccounts("badges.debt")}
                          </span>
                        )}
                        {isCredit && (
                          <span className="rounded-md border border-emerald-800 bg-emerald-950/60 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                            {tAccounts("badges.credit")}
                          </span>
                        )}
                        {isOverdraft && (
                          <span className="rounded-md border border-amber-800 bg-amber-950/60 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                            {tAccounts("badges.overdraft")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Balance Snapshot Display */}
                    <div className="mt-4 border-t border-stone-800/60 pt-3">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-stone-400">
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
                        <div className="text-right font-mono text-lg font-semibold tracking-tight text-stone-100">
                          {hasSnapshot ? (
                            formatAmountPresentation(
                              acc.balanceSnapshotMinor!,
                              acc.currency,
                              locale,
                            )
                          ) : (
                            <span className="text-stone-400">
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
                    <div className="mt-3 text-xs text-stone-400">
                      <span className="text-stone-400">
                        {tAccounts("ownersLabel")}:{" "}
                      </span>
                      <span className="text-stone-300 font-medium">
                        {getOwnerNames(acc.ownerPersonIds)}
                      </span>
                    </div>
                  </div>

                  {/* Actions (Edit & Archive) */}
                  <div className="mt-5 flex items-center justify-end gap-2 border-t border-stone-800/60 pt-3">
                    <button
                      type="button"
                      onClick={() => startEdit(acc)}
                      className="rounded-lg border border-stone-700 bg-stone-800 px-2.5 py-1 text-xs font-medium text-stone-200 transition-colors hover:bg-stone-700 focus:outline-none"
                    >
                      {tAccounts("actions.edit")}
                    </button>
                    <button
                      type="button"
                      disabled={actionLoadingId === acc.id}
                      onClick={() => handleArchive(acc.id)}
                      className="rounded-lg border border-stone-800 px-2.5 py-1 text-xs font-medium text-stone-400 transition-colors hover:border-stone-700 hover:text-stone-300 focus:outline-none disabled:opacity-50"
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
          className="flex flex-col gap-4 border-t border-stone-800/80 pt-6"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-wide text-stone-400 uppercase">
              {tAccounts("archivedAccounts")}
            </h2>
            <span className="rounded-full bg-stone-800 px-2 py-0.5 text-[10px] text-stone-400 font-mono">
              {archivedAccounts.length}
            </span>
          </div>

          {archivedAccounts.length === 0 ? (
            <p className="text-xs text-stone-400">
              {tAccounts("emptyArchivedDescription")}
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {archivedAccounts.map((acc) => (
                <article
                  key={acc.id}
                  className="flex flex-col justify-between rounded-2xl border border-stone-800/60 bg-stone-900/40 p-5 opacity-75 transition-opacity hover:opacity-100"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-stone-200">
                          {acc.name}
                        </h3>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="rounded-md border border-stone-700/60 bg-stone-800/60 px-2 py-0.5 text-[11px] font-medium text-stone-400">
                            {tAccounts(`types.${acc.type}`)}
                          </span>
                          <span className="rounded-md border border-stone-700/60 bg-stone-800/60 px-1.5 py-0.5 text-[11px] font-mono text-stone-400">
                            {acc.currency}
                          </span>
                        </div>
                      </div>

                      <span className="rounded-md border border-stone-700 bg-stone-800 px-2 py-0.5 text-[10px] font-medium text-stone-400">
                        {tAccounts("badges.archived")}
                      </span>
                    </div>

                    <div className="mt-4 border-t border-stone-800/40 pt-3 text-xs text-stone-400">
                      <span className="text-stone-400">
                        {tAccounts("ownersLabel")}:{" "}
                      </span>
                      <span className="text-stone-300">
                        {getOwnerNames(acc.ownerPersonIds)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-end border-t border-stone-800/40 pt-3">
                    <button
                      type="button"
                      disabled={actionLoadingId === acc.id}
                      onClick={() => handleUnarchive(acc.id)}
                      className="rounded-lg border border-stone-700 bg-stone-800 px-2.5 py-1 text-xs font-medium text-stone-200 transition-colors hover:bg-stone-700 focus:outline-none disabled:opacity-50"
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
