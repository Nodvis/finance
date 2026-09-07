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
      className="rounded-2xl border border-stone-800 bg-stone-900/80 p-6 shadow-xs backdrop-blur-xs"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-800/80 pb-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-stone-100">
            {tSelection("title")}
          </h2>
          <p className="mt-1 text-sm text-stone-400">
            {tSelection("description")}
          </p>
          {email && (
            <p className="mt-2 text-xs font-mono text-stone-400">
              {tAuth("signedInAs")}: {email}
            </p>
          )}
        </div>
        <SignOutButton />
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="mt-5 rounded-lg border border-rose-900/80 bg-rose-950/60 p-3 text-sm text-rose-200"
        >
          {errorMessage}
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {households.map((h) => (
          <div
            key={h.householdId}
            className="flex flex-col justify-between rounded-xl border border-stone-800 bg-stone-900/50 p-4 transition-colors hover:border-stone-700"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-stone-100">
                  {h.householdName}
                </h3>
                <span className="rounded-md border border-stone-700/80 bg-stone-800 px-2 py-0.5 text-xs font-mono text-stone-300">
                  {h.defaultCurrency}
                </span>
              </div>
              <p className="mt-1 text-xs text-stone-400">
                {h.personDisplayName}
              </p>
            </div>

            <button
              type="button"
              disabled={selectingId !== null}
              onClick={() => handleSelect(h.householdId)}
              className="mt-4 w-full rounded-lg bg-stone-100 px-3 py-2 text-xs font-semibold text-stone-900 shadow-sm transition-all hover:bg-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-400 disabled:opacity-50"
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
