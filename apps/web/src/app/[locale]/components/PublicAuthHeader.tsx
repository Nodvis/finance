import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { FinanceBrand } from "./FinanceBrand";

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
          aria-label={tNav("brand")}
          className="flex items-center rounded-lg p-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <span className="w-[166px]"><FinanceBrand /></span>
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
