import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { getCurrentUserHouseholdsStatus } from "@/lib/authorization/household";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { SignOutButton } from "./SignOutButton";
import { ThemeToggle } from "./ThemeToggle";

export async function AppHeader() {
  const tNav = await getTranslations("Navigation");
  const tAccess = await getTranslations("Accessibility");
  const tAuth = await getTranslations("Auth");
  const session = await getCurrentSession();

  let activeHousehold: { householdName: string; defaultCurrency: string } | null = null;
  if (session) {
    try {
      const status = await getCurrentUserHouseholdsStatus();
      if (status.status === "single" || status.status === "multiple_selected") {
        activeHousehold = {
          householdName: status.activeContext.householdName,
          defaultCurrency: status.activeContext.defaultCurrency,
        };
      }
    } catch {
      // Ignore errors when fetching household status
    }
  }

  return (
    <header
      role="banner"
      className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-stone-800/80 dark:bg-stone-950/80"
    >
      {/* Accessible skip link for keyboard & screen-reader navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-xs focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:bg-stone-100 dark:focus:text-stone-900"
      >
        {tNav("skipToContent")}
      </a>

      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="group flex items-center gap-2.5 rounded-md p-1 -m-1 transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 border border-emerald-200 shadow-xs dark:bg-stone-800 dark:border-stone-700/60">
              <svg
                className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                />
              </svg>
            </div>
            <div>
              <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-stone-100">
                {tNav("brand")}
              </span>
              <span className="hidden md:inline-block ml-2 text-xs text-slate-500 dark:text-stone-400">
                · {tNav("tagline")}
              </span>
            </div>
          </Link>

          {/* Active household indicator (authenticated only) */}
          {activeHousehold && (
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100/70 px-2.5 py-0.5 text-[11px] font-medium text-slate-700 dark:border-stone-800 dark:bg-stone-900/60 dark:text-stone-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              <span>{activeHousehold.householdName}</span>
              <span className="font-mono text-slate-400 dark:text-stone-500">({activeHousehold.defaultCurrency})</span>
            </span>
          )}
        </div>

        {/* Authenticated navigation links - strictly separated: shown ONLY when session exists */}
        {session ? (
          <nav
            className="order-3 flex w-full items-center gap-1 overflow-x-auto border-t border-slate-200/70 pt-3 sm:order-none sm:w-auto sm:border-t-0 sm:pt-0 dark:border-stone-800/70"
            aria-label={tAccess("mainNavigation")}
          >
            <Link
              href="/"
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-stone-300 dark:hover:bg-stone-800/80 dark:hover:text-stone-100"
            >
              {tNav("home")}
            </Link>
            <Link
              href="/accounts"
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-stone-300 dark:hover:bg-stone-800/80 dark:hover:text-stone-100"
            >
              {tNav("accounts")}
            </Link>
            <Link
              href="/categories"
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-stone-300 dark:hover:bg-stone-800/80 dark:hover:text-stone-100"
            >
              {tNav("categories")}
            </Link>
            <Link
              href="/imports"
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-stone-300 dark:hover:bg-stone-800/80 dark:hover:text-stone-100"
            >
              {tNav("imports")}
            </Link>
            <Link
              href="/transfers"
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-stone-300 dark:hover:bg-stone-800/80 dark:hover:text-stone-100"
            >
              {tNav("transfers")}
            </Link>
            <Link
              href="/liabilities"
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-stone-300 dark:hover:bg-stone-800/80 dark:hover:text-stone-100"
            >
              {tNav("liabilities")}
            </Link>
            <Link
              href="/rules"
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-stone-300 dark:hover:bg-stone-800/80 dark:hover:text-stone-100"
            >
              {tNav("rules")}
            </Link>
          </nav>
        ) : null}

        {/* Global actions: Theme Toggle + Language Switcher + User Context */}
        <div
          className="ml-auto flex items-center gap-2"
          role="region"
          aria-label={tAccess("languageNavigation")}
        >
          <ThemeToggle />

          <Suspense
            fallback={
              <div className="h-7 w-20 rounded-lg bg-slate-100 dark:bg-stone-900 animate-pulse" />
            }
          >
            <LanguageSwitcher />
          </Suspense>

          {session ? (
            <div className="hidden items-center gap-3 border-l border-slate-200 pl-3 sm:flex dark:border-stone-800">
              <span
                className="max-w-40 truncate text-xs text-slate-500 dark:text-stone-400"
                title={session.user.email}
              >
                {tAuth("signedInAs")}: {session.user.name ?? session.user.email}
              </span>
              <SignOutButton />
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
