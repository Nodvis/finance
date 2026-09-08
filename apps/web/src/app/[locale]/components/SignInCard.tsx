"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { authClient } from "@/lib/auth/client";

const EMAIL_DRAFT_KEY = "nodvis_auth_email_draft";

export function SignInCard() {
  const t = useTranslations("Auth");
  const router = useRouter();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Restore email draft across language switches
  useEffect(() => {
    try {
      const savedEmail = sessionStorage.getItem(EMAIL_DRAFT_KEY);
      if (savedEmail) {
        setEmail(savedEmail);
      }
    } catch {
      // Ignore storage read errors
    }
  }, []);

  const handleEmailChange = (newEmail: string) => {
    setEmail(newEmail);
    try {
      sessionStorage.setItem(EMAIL_DRAFT_KEY, newEmail);
    } catch {
      // Ignore storage write errors
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (mode === "signin") {
        const res = await authClient.signIn.email({
          email: email.trim(),
          password,
        });

        if (res.error) {
          setErrorMessage(res.error.message || t("errorInvalidCredentials"));
        } else {
          try {
            sessionStorage.removeItem(EMAIL_DRAFT_KEY);
          } catch {
            // Ignore storage cleanup error
          }
          router.refresh();
        }
      } else {
        const res = await authClient.signUp.email({
          name: name.trim() || email.split("@")[0] || "User",
          email: email.trim(),
          password,
        });

        if (res.error) {
          setErrorMessage(res.error.message || t("errorSignUp"));
        } else {
          try {
            sessionStorage.removeItem(EMAIL_DRAFT_KEY);
          } catch {
            // Ignore storage cleanup error
          }
          router.refresh();
        }
      }
    } catch {
      setErrorMessage(mode === "signin" ? t("errorInvalidCredentials") : t("errorSignUp"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm backdrop-blur-xs sm:p-8 dark:border-stone-800 dark:bg-stone-900/80">
      <div className="mx-auto max-w-md">
        {/* Mode switcher tabs */}
        <div className="mb-6 flex rounded-lg border border-slate-200 bg-slate-100/80 p-1 dark:border-stone-800 dark:bg-stone-900">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setErrorMessage(null);
            }}
            className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-all ${
              mode === "signin"
                ? "bg-white text-slate-900 shadow-xs dark:bg-stone-800 dark:text-stone-100"
                : "text-slate-500 hover:text-slate-800 dark:text-stone-400 dark:hover:text-stone-200"
            }`}
          >
            {t("tabSignIn")}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setErrorMessage(null);
            }}
            className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-all ${
              mode === "signup"
                ? "bg-white text-slate-900 shadow-xs dark:bg-stone-800 dark:text-stone-100"
                : "text-slate-500 hover:text-slate-800 dark:text-stone-400 dark:hover:text-stone-200"
            }`}
          >
            {t("tabSignUp")}
          </button>
        </div>

        <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-stone-100">
          {mode === "signin" ? t("signInTitle") : t("signUpTitle")}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-stone-400">
          {mode === "signin" ? t("signInDescription") : t("signUpDescription")}
        </p>

        {errorMessage && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/80 dark:bg-rose-950/60 dark:text-rose-200"
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <div>
              <label
                htmlFor="signup-name"
                className="block text-sm font-medium text-slate-700 dark:text-stone-300"
              >
                {t("nameLabel")}
              </label>
              <input
                id="signup-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("namePlaceholder")}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="signin-email"
              className="block text-sm font-medium text-slate-700 dark:text-stone-300"
            >
              {t("emailLabel")}
            </label>
            <input
              id="signin-email"
              type="email"
              required
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              placeholder={t("emailPlaceholder")}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500"
            />
          </div>

          <div>
            <label
              htmlFor="signin-password"
              className="block text-sm font-medium text-slate-700 dark:text-stone-300"
            >
              {t("passwordLabel")}
            </label>
            <input
              id="signin-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-all hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 dark:bg-emerald-500 dark:text-stone-950 dark:hover:bg-emerald-400 dark:focus:ring-offset-stone-900"
          >
            {isSubmitting
              ? mode === "signin"
                ? t("signingIn")
                : t("signingUp")
              : mode === "signin"
                ? t("signInButton")
                : t("signUpButton")}
          </button>
        </form>
      </div>
    </div>
  );
}
