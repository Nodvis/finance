"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { authClient } from "@/lib/auth/client";

export function SignOutButton() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await authClient.signOut();
      router.refresh();
    } catch {
      setIsSigningOut(false);
    }
  };

  return (
    <button
      type="button"
      data-testid="sign-out-button"
      onClick={handleSignOut}
      disabled={isSigningOut}
      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100"
    >
      {isSigningOut ? t("signingIn") : t("signOutButton")}
    </button>
  );
}
