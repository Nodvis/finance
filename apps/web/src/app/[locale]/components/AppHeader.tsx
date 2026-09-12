import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { getCurrentUserHouseholdsStatus } from "@/lib/authorization/household";

import { AppNav } from "./AppNav";
import { ProfileMenu } from "./ProfileMenu";
import { ThemeToggle } from "./ThemeToggle";
import { FinanceBrand } from "./FinanceBrand";
import { Settings } from "lucide-react";

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
    <>
      <header role="banner" className="finance-topbar">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-xl focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-xs focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-lime-300 dark:focus:bg-stone-100 dark:focus:text-stone-900">
        {tNav("skipToContent")}
      </a>
      <div className="finance-topbar-inner">
          <Link href="/" aria-label={tNav("brand")} className="finance-mobile-brand"><FinanceBrand /></Link>
          <div className="min-w-0">
            <p className="finance-topbar-kicker">{tNav("tagline")}</p>
            {activeHousehold ? <p className="truncate text-sm font-semibold text-[var(--foreground)]">{activeHousehold.householdName}</p> : null}
          </div>
          {session ? (
            <div className="flex shrink-0 items-center gap-2">
              <ThemeToggle />
              <Link href="/settings" aria-label={tSettings("openSettings")} title={tSettings("openSettings")} className="finance-icon-button">
                <Settings size={17} strokeWidth={1.8} aria-hidden="true" />
              </Link>
              <ProfileMenu name={session.user.name} email={session.user.email} labels={{ open: tProfile("open", { name: "{name}" }), account: tProfile("account"), profile: tProfile("profile") }} />
            </div>
          ) : null}
      </div>
    </header>
    {session ? <AppNav labels={{ home: tNav("home"), accounts: tNav("accounts"), transactions: tNav("transactions"), categories: tNav("categories"), imports: tNav("imports"), transfers: tNav("transfers"), liabilities: tNav("liabilities"), upcoming: tNav("upcoming"), rules: tNav("rules"), recurring: tNav("recurring"), analytics: tNav("analytics"), forecast: tNav("forecast"), more: tNav("more"), closeMore: tNav("closeMore"), primary: tNav("primary"), planning: tNav("planning"), settings: tNav("settings") }} ariaLabel={tAccess("mainNavigation")} /> : null}
    </>
  );
}