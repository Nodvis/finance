"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import type { HouseholdAccessSummary } from "@nodvis/finance-db";
import { SignOutButton } from "./SignOutButton";

export function HouseholdSelectionCard({
  households,
  email,
}: {
  households: HouseholdAccessSummary[];
  email?: string;
}) {
  const tAuth = useTranslations("Auth");
  const tSelection = useTranslations("HouseholdSelection");
  const tAccess = useTranslations("Accessibility");
  const router = useRouter();

  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSelect = async (householdId: string) => {
    setSelectingId(householdId);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/households/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ householdId }),
      });

      if (!res.ok) {
        const data = await res.json();
        setErrorMessage(data.error || "Failed to select household");
      } else {
        router.refresh();
      }
    } catch {
      setErrorMessage("Failed to select household");
    } finally {
      setSelectingId(null);
    }
  };

  return (
    <div
      aria-label={tAccess("householdSelection")}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8 dark:border-stone-800 dark:bg-stone-900/80"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5 dark:border-stone-800/80">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-stone-100">
            {tSelection("title")}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-stone-400">
            {tSelection("description")}
          </p>
          {email && (
            <p className="mt-2 text-xs font-mono text-slate-400 dark:text-stone-400">
              {tAuth("signedInAs")}: {email}
            </p>
          )}
        </div>
        <SignOutButton />
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/80 dark:bg-rose-950/60 dark:text-rose-200"
        >
          {errorMessage}
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {households.map((h) => (
          <div
            key={h.householdId}
            className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition-colors hover:border-slate-300 dark:border-stone-800 dark:bg-stone-900/50 dark:hover:border-stone-700"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-900 dark:text-stone-100">
                  {h.householdName}
                </h3>
                <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-mono text-slate-700 dark:border-stone-700/80 dark:bg-stone-800 dark:text-stone-300">
                  {h.defaultCurrency}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-stone-400">
                {h.personDisplayName}
              </p>
            </div>

            <button
              type="button"
              disabled={selectingId !== null}
              onClick={() => handleSelect(h.householdId)}
              className="mt-4 w-full rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 dark:bg-emerald-500 dark:text-stone-950 dark:hover:bg-emerald-400"
            >
              {selectingId === h.householdId
                ? tSelection("selecting")
                : tSelection("selectButton")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
