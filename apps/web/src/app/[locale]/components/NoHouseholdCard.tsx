"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { SignOutButton } from "./SignOutButton";

const COMMON_CURRENCIES = ["PLN", "EUR", "USD", "GBP", "CHF"] as const;

export function NoHouseholdCard({
  email,
  defaultDisplayName,
}: {
  email?: string;
  defaultDisplayName?: string;
}) {
  const tAuth = useTranslations("Auth");
  const tOnboarding = useTranslations("Onboarding");
  const tAccess = useTranslations("Accessibility");
  const router = useRouter();

  const [householdName, setHouseholdName] = useState("");
  const [currency, setCurrency] = useState<string>("PLN");
  const [displayName, setDisplayName] = useState(defaultDisplayName || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/households", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: householdName.trim(),
          defaultCurrency: currency,
          personDisplayName: displayName.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || tOnboarding("errorGeneric"));
      } else {
        router.refresh();
      }
    } catch {
      setErrorMessage(tOnboarding("errorGeneric"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      aria-label={tAccess("onboarding")}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8 dark:border-stone-800 dark:bg-stone-900/80"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5 dark:border-stone-800/80">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-stone-100">
            {tOnboarding("title")}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-stone-400">
            {tOnboarding("description")}
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

      <form onSubmit={handleSubmit} className="mt-5 max-w-md space-y-4">
        <div>
          <label
            htmlFor="onboarding-name"
            className="block text-sm font-medium text-slate-700 dark:text-stone-300"
          >
            {tOnboarding("householdName")}
          </label>
          <input
            id="onboarding-name"
            type="text"
            required
            maxLength={160}
            value={householdName}
            onChange={(e) => setHouseholdName(e.target.value)}
            placeholder={tOnboarding("householdNamePlaceholder")}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500"
          />
        </div>

        <div>
          <label
            htmlFor="onboarding-currency"
            className="block text-sm font-medium text-slate-700 dark:text-stone-300"
          >
            {tOnboarding("defaultCurrency")}
          </label>
          <select
            id="onboarding-currency"
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

        <div>
          <label
            htmlFor="onboarding-person"
            className="block text-sm font-medium text-slate-700 dark:text-stone-300"
          >
            {tOnboarding("yourName")}
          </label>
          <input
            id="onboarding-person"
            type="text"
            maxLength={160}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={tOnboarding("yourNamePlaceholder")}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-all hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 dark:bg-emerald-500 dark:text-stone-950 dark:hover:bg-emerald-400"
        >
          {isSubmitting ? tOnboarding("submitting") : tOnboarding("submit")}
        </button>
      </form>
    </div>
  );
}
