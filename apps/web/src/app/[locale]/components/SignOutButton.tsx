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
      onClick={handleSignOut}
      disabled={isSigningOut}
      className="rounded-lg border border-stone-800 bg-stone-900 px-3 py-1.5 text-xs font-medium text-stone-300 shadow-xs transition-colors hover:bg-stone-800 hover:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-500 disabled:opacity-50"
    >
      {isSigningOut ? t("signingIn") : t("signOutButton")}
    </button>
  );
}
