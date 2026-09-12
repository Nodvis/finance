"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { authClient } from "@/lib/auth/client";
import { getLocaleConfig, type AppLocale } from "@/i18n/config";

const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;

type HouseholdResponse = {
  householdId: string;
  personId: string;
};

export function SetupWizard({ locale }: { locale: string }) {
  const t = useTranslations("Setup");
  const router = useRouter();
  const initialLocale: AppLocale = locale === "en" ? "en" : "pl";
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [householdName, setHouseholdName] = useState("");
  const [currency, setCurrency] = useState(getLocaleConfig(initialLocale).defaultCurrency);
  const [selectedLocale, setSelectedLocale] = useState<AppLocale>(initialLocale);
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState("checking");
  const [household, setHousehold] = useState<HouseholdResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordScore = useMemo(() => {
    let score = 0;
    if (password.length >= PASSWORD_MIN_LENGTH) score += 1;
    if (password.length >= 16) score += 1;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;
    return score;
  }, [password]);

  const handleOwnerSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(t("passwordTooShort", { count: PASSWORD_MIN_LENGTH }));
      return;
    }
    if (password.length > PASSWORD_MAX_LENGTH) {
      setError(t("passwordTooLong", { count: PASSWORD_MAX_LENGTH }));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("passwordMismatch"));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await authClient.signUp.email({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      if (result.error) {
        setError(t("ownerCreationError"));
        return;
      }
      setStep(3);
    } catch {
      setError(t("ownerCreationError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleHouseholdSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/households", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: householdName.trim(),
          defaultCurrency: currency,
          personDisplayName: name.trim(),
          bootstrap: true,
        }),
      });
      if (!response.ok) {
        setError(response.status === 409 ? t("alreadyInitialized") : t("householdCreationError"));
        return;
      }
      const payload = (await response.json()) as { data: HouseholdResponse };
      setHousehold(payload.data);
      setStep(4);
    } catch {
      setError(t("householdCreationError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const finish = async (withAccount: boolean) => {
    setError(null);
    setIsSubmitting(true);
    try {
      if (withAccount && household && accountName.trim()) {
        const response = await fetch(`/api/households/${household.householdId}/accounts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: accountName.trim(),
            type: accountType,
            currency,
            ownerPersonIds: [household.personId],
          }),
        });
        if (!response.ok) {
          setError(t("accountCreationError"));
          return;
        }
      }
      document.cookie = `NEXT_LOCALE=${selectedLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
      router.refresh();
    } catch {
      setError(t("accountCreationError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col justify-center px-4 py-8 sm:px-6 lg:py-12">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900 sm:p-8" aria-labelledby="setup-title">
        <div className="mb-8 flex items-center justify-between gap-3" aria-label={t("progressLabel")}>
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className={`h-1.5 flex-1 rounded-full ${item <= step ? "bg-emerald-500" : "bg-slate-200 dark:bg-stone-700"}`} />
          ))}
        </div>

        {step === 1 && (
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">Nodvis Finance</p>
            <h1 id="setup-title" className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-stone-100">{t("welcomeTitle")}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-stone-400">{t("welcomeDescription")}</p>
            <button type="button" onClick={() => setStep(2)} className="mt-8 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2">{t("continue")}</button>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleOwnerSubmit}>
            <h1 id="setup-title" className="text-2xl font-bold tracking-tight text-slate-900 dark:text-stone-100">{t("ownerTitle")}</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-stone-400">{t("ownerDescription")}</p>
            {error && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200">{error}</p>}
            <div className="mt-6 space-y-4">
              <label className="block text-sm font-medium">{t("displayName")}
                <input required value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" className="mt-1 block w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 dark:border-stone-700" />
              </label>
              <label className="block text-sm font-medium">{t("email")}
                <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className="mt-1 block w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 dark:border-stone-700" />
              </label>
              <label className="block text-sm font-medium">{t("password")}
                <input required minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" className="mt-1 block w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 dark:border-stone-700" />
              </label>
              <div aria-live="polite" className="text-xs text-slate-500 dark:text-stone-400">{t("passwordStrength", { score: passwordScore })}</div>
              <label className="block text-sm font-medium">{t("confirmPassword")}
                <input required minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" className="mt-1 block w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 dark:border-stone-700" />
              </label>
            </div>
            <button disabled={isSubmitting} className="mt-6 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{isSubmitting ? t("saving") : t("continue")}</button>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleHouseholdSubmit}>
            <h1 id="setup-title" className="text-2xl font-bold tracking-tight text-slate-900 dark:text-stone-100">{t("householdTitle")}</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-stone-400">{t("householdDescription")}</p>
            {error && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200">{error}</p>}
            <div className="mt-6 space-y-4">
              <label className="block text-sm font-medium">{t("householdName")}
                <input required value={householdName} onChange={(event) => setHouseholdName(event.target.value)} placeholder={t("householdNamePlaceholder")} className="mt-1 block w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 dark:border-stone-700" />
              </label>
              <label className="block text-sm font-medium">{t("currency")}
                <input required maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} className="mt-1 block w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 uppercase dark:border-stone-700" />
              </label>
              <label className="block text-sm font-medium">{t("language")}
                <select value={selectedLocale} onChange={(event) => { const nextLocale = event.target.value as AppLocale; setSelectedLocale(nextLocale); setCurrency(getLocaleConfig(nextLocale).defaultCurrency); }} className="mt-1 block w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 dark:border-stone-700">
                  <option value="pl">Polski</option>
                  <option value="en">English</option>
                </select>
              </label>
            </div>
            <button disabled={isSubmitting} className="mt-6 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{isSubmitting ? t("saving") : t("continue")}</button>
          </form>
        )}

        {step === 4 && (
          <div>
            <h1 id="setup-title" className="text-2xl font-bold tracking-tight text-slate-900 dark:text-stone-100">{t("accountTitle")}</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-stone-400">{t("accountDescription")}</p>
            {error && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200">{error}</p>}
            <div className="mt-6 space-y-4">
              <label className="block text-sm font-medium">{t("accountName")}
                <input value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder={t("accountNamePlaceholder")} className="mt-1 block w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 dark:border-stone-700" />
              </label>
              <label className="block text-sm font-medium">{t("accountType")}
                <select value={accountType} onChange={(event) => setAccountType(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 dark:border-stone-700">
                  <option value="checking">{t("checking")}</option>
                  <option value="savings">{t("savings")}</option>
                  <option value="cash">{t("cash")}</option>
                  <option value="credit_card">{t("creditCard")}</option>
                </select>
              </label>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button type="button" disabled={isSubmitting} onClick={() => finish(false)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold dark:border-stone-700">{t("skip")}</button>
              <button type="button" disabled={isSubmitting || !accountName.trim()} onClick={() => finish(true)} className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{isSubmitting ? t("saving") : t("finish")}</button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
