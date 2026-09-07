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
      className="rounded-2xl border border-stone-800 bg-stone-900/80 p-6 shadow-xs backdrop-blur-xs"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-800/80 pb-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-stone-100">
            {tOnboarding("title")}
          </h2>
          <p className="mt-1 text-sm text-stone-400">
            {tOnboarding("description")}
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

      <form onSubmit={handleSubmit} className="mt-5 max-w-md space-y-4">
        <div>
          <label
            htmlFor="onboarding-name"
            className="block text-sm font-medium text-stone-300"
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
            className="mt-1 block w-full rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-500 shadow-xs focus:border-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"
          />
        </div>

        <div>
          <label
            htmlFor="onboarding-currency"
            className="block text-sm font-medium text-stone-300"
          >
            {tOnboarding("defaultCurrency")}
          </label>
          <select
            id="onboarding-currency"
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

        <div>
          <label
            htmlFor="onboarding-person"
            className="block text-sm font-medium text-stone-300"
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
            className="mt-1 block w-full rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-500 shadow-xs focus:border-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-stone-100 px-4 py-2.5 text-sm font-semibold text-stone-900 shadow-sm transition-all hover:bg-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 focus:ring-offset-stone-900 disabled:opacity-50"
        >
          {isSubmitting ? tOnboarding("submitting") : tOnboarding("submit")}
        </button>
      </form>
    </div>
  );
}
