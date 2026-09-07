"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { authClient } from "@/lib/auth/client";

const EMAIL_DRAFT_KEY = "nodvis_auth_email_draft";

export function SignInCard() {
  const t = useTranslations("Auth");
  const router = useRouter();

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
    } catch {
      setErrorMessage(t("errorInvalidCredentials"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-stone-800 bg-stone-900/80 p-6 shadow-xs backdrop-blur-xs">
      <div className="max-w-md">
        <h2 className="text-xl font-semibold tracking-tight text-stone-100">
          {t("signInTitle")}
        </h2>
        <p className="mt-1 text-sm text-stone-400">
          {t("signInDescription")}
        </p>

        {errorMessage && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-rose-900/80 bg-rose-950/60 p-3 text-sm text-rose-200"
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="signin-email"
              className="block text-sm font-medium text-stone-300"
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
              className="mt-1 block w-full rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-500 shadow-xs focus:border-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
          </div>

          <div>
            <label
              htmlFor="signin-password"
              className="block text-sm font-medium text-stone-300"
            >
              {t("passwordLabel")}
            </label>
            <input
              id="signin-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-500 shadow-xs focus:border-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-stone-100 px-4 py-2.5 text-sm font-semibold text-stone-900 shadow-sm transition-all hover:bg-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 focus:ring-offset-stone-900 disabled:opacity-50"
          >
            {isSubmitting ? t("signingIn") : t("signInButton")}
          </button>
        </form>
      </div>
    </div>
  );
}
