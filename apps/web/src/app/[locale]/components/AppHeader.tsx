import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { SignOutButton } from "./SignOutButton";

export async function AppHeader() {
  const tNav = await getTranslations("Navigation");
  const tAccess = await getTranslations("Accessibility");
  const tAuth = await getTranslations("Auth");
  const session = await getCurrentSession();

  return (
    <header
      role="banner"
      className="sticky top-0 z-40 w-full border-b border-stone-800/80 bg-stone-950/80 backdrop-blur-md"
    >
      {/* Accessible skip link for keyboard & screen-reader navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-stone-100 focus:px-4 focus:py-2 focus:text-xs focus:font-semibold focus:text-stone-900 focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-stone-400"
      >
        {tNav("skipToContent")}
      </a>

      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="group flex items-center gap-2.5 transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-stone-500 rounded-md p-1 -m-1"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-800 border border-stone-700/60 shadow-xs">
              <svg
                className="h-4 w-4 text-stone-200"
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
              <span className="text-sm font-semibold tracking-tight text-stone-100">
                {tNav("brand")}
              </span>
              <span className="hidden md:inline-block ml-2 text-xs text-stone-400">
                · {tNav("tagline")}
              </span>
            </div>
          </Link>

          <span className="hidden sm:inline-flex items-center rounded-full border border-stone-800 bg-stone-900/60 px-2 py-0.5 text-[10px] font-medium text-stone-400">
            {tNav("privateBadge")}
          </span>
        </div>

        {/* Navigation links */}
        <nav
          className="order-3 flex w-full items-center gap-1 overflow-x-auto border-t border-stone-800/70 pt-3 sm:order-none sm:w-auto sm:border-t-0 sm:pt-0"
          aria-label={tAccess("mainNavigation")}
        >
          <Link
            href="/"
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-stone-300 transition-colors hover:bg-stone-800/80 hover:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-400"
          >
            {tNav("home")}
          </Link>
          <Link
            href="/accounts"
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-stone-300 transition-colors hover:bg-stone-800/80 hover:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-400"
          >
            {tNav("accounts")}
          </Link>
          <Link
            href="/categories"
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-stone-300 transition-colors hover:bg-stone-800/80 hover:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-400"
          >
            {tNav("categories")}
          </Link>
          <Link
            href="/imports"
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-stone-300 transition-colors hover:bg-stone-800/80 hover:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-400"
          >
            {tNav("imports")}
          </Link>
        </nav>

        {/* Global actions: Language Switcher */}
        <div
          className="ml-auto flex items-center gap-2"
          role="region"
          aria-label={tAccess("languageNavigation")}
        >
          <Suspense
            fallback={
              <div className="h-7 w-20 rounded-lg bg-stone-900 animate-pulse" />
            }
          >
            <LanguageSwitcher />
          </Suspense>
          {session ? (
            <div className="hidden items-center gap-3 border-l border-stone-800 pl-3 sm:flex">
              <span className="max-w-40 truncate text-xs text-stone-400" title={session.user.email}>
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
