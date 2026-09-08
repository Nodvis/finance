import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";

export async function PublicAuthHeader() {
  const tNav = await getTranslations("Navigation");
  const tAccess = await getTranslations("Accessibility");

  return (
    <header
      role="banner"
      className="border-b border-slate-200/80 bg-white/90 dark:border-stone-800/80 dark:bg-stone-950/90"
    >
      <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.8.9.7c1.2.9 3.1.9 4.2 0 1.2-.9 1.2-2.3 0-3.2-.6-.4-1.3-.7-2.1-.7-.7 0-1.5-.2-2-.7-1.1-.9-1.1-2.3 0-3.2 1.1-.9 2.9-.9 4 0l.4.3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </span>
          <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-stone-100">{tNav("brand")}</span>
        </Link>
        <div className="flex items-center gap-2" role="region" aria-label={tAccess("languageNavigation")}>
          <ThemeToggle />
          <Suspense fallback={<div className="h-8 w-20 rounded-lg bg-slate-100 dark:bg-stone-900" />}>
            <LanguageSwitcher />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
