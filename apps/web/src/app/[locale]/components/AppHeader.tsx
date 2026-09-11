import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { getCurrentUserHouseholdsStatus } from "@/lib/authorization/household";

import { AppNav } from "./AppNav";
import { ProfileMenu } from "./ProfileMenu";
import { ThemeToggle } from "./ThemeToggle";
import { FinanceBrand } from "./FinanceBrand";

export async function AppHeader() {
  const tNav = await getTranslations("Navigation");
  const tAccess = await getTranslations("Accessibility");
  const tSettings = await getTranslations("Settings");
  const tProfile = await getTranslations("ProfileMenu");
  const session = await getCurrentSession();

  let activeHousehold: { householdName: string } | null = null;
  if (session) {
    try {
      const status = await getCurrentUserHouseholdsStatus();
      if (status.status === "single" || status.status === "multiple_selected") {
        activeHousehold = { householdName: status.activeContext.householdName };
      }
    } catch {
      // The shell remains useful if the optional household context is unavailable.
    }
  }

  return (
    <header role="banner" className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-xl dark:border-stone-800/80 dark:bg-stone-950/90">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-xl focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-xs focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:bg-stone-100 dark:focus:text-stone-900">
        {tNav("skipToContent")}
      </a>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-16 items-center justify-between gap-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" aria-label={tNav("brand")} className="group flex min-w-0 shrink-0 items-center rounded-xl p-1 transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-950">
              <span className="hidden w-[166px] sm:block"><FinanceBrand /></span>
              <span className="w-[52px] sm:hidden"><FinanceBrand compact /></span>
            </Link>
            {activeHousehold ? (
              <div className="hidden min-w-0 border-l border-slate-200 pl-3 dark:border-stone-800 sm:block">
                <p className="truncate text-sm font-medium text-slate-800 dark:text-stone-200">{activeHousehold.householdName}</p>
              </div>
            ) : null}
          </div>
          {session ? (
            <div className="flex shrink-0 items-center gap-2">
              <ThemeToggle />
              <Link href="/settings" aria-label={tSettings("openSettings")} title={tSettings("openSettings")} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100 dark:focus-visible:ring-offset-stone-950">
                <span aria-hidden="true">⚙</span>
              </Link>
              <ProfileMenu name={session.user.name} email={session.user.email} labels={{ open: tProfile("open", { name: "{name}" }), account: tProfile("account"), profile: tProfile("profile") }} />
            </div>
          ) : null}
        </div>
        {session ? <AppNav labels={{ home: tNav("home"), accounts: tNav("accounts"), transactions: tNav("transactions"), categories: tNav("categories"), imports: tNav("imports"), transfers: tNav("transfers"), liabilities: tNav("liabilities"), upcoming: tNav("upcoming"), rules: tNav("rules"), recurring: tNav("recurring"), analytics: tNav("analytics"), forecast: tNav("forecast") }} ariaLabel={tAccess("mainNavigation")} /> : null}
      </div>
    </header>
  );
}