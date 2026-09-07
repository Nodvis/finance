"use client";

import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { LOCALE_CONFIGS, LOCALES, type AppLocale } from "@/i18n/config";
import { usePathname, useRouter } from "@/i18n/navigation";

export function LanguageSwitcher() {
  const t = useTranslations("LanguageSwitcher");
  const currentLocale = useLocale() as AppLocale;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleSwitchLocale = (nextLocale: AppLocale) => {
    if (nextLocale === currentLocale) return;

    // Persist locale preference in NEXT_LOCALE cookie across sessions/reloads
    if (typeof document !== "undefined") {
      document.cookie = `NEXT_LOCALE=${nextLocale};path=/;max-age=31536000;SameSite=Lax`;
    }

    // Preserve route pathname and query parameters
    const queryString = searchParams?.toString();
    const targetPath = queryString ? `${pathname}?${queryString}` : pathname;

    router.replace(targetPath, { locale: nextLocale });
  };

  return (
    <nav
      aria-label={t("label")}
      className="inline-flex items-center rounded-lg border border-stone-800 bg-stone-900/90 p-1 shadow-xs backdrop-blur-xs"
    >
      <div className="flex items-center gap-1" role="group" aria-label={t("label")}>
        {LOCALES.map((localeCode) => {
          const config = LOCALE_CONFIGS[localeCode];
          const isActive = localeCode === currentLocale;
          const accessibleLabel = t(config.switchLabelKey);

          return (
            <button
              key={localeCode}
              type="button"
              onClick={() => handleSwitchLocale(localeCode)}
              aria-current={isActive ? "page" : undefined}
              aria-label={accessibleLabel}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-1 focus:ring-offset-stone-900 ${
                isActive
                  ? "bg-stone-800 text-stone-100 font-semibold shadow-xs"
                  : "text-stone-400 hover:bg-stone-800/60 hover:text-stone-200"
              }`}
            >
              <span className="font-mono text-[11px] uppercase tracking-wider">
                {localeCode}
              </span>
              <span className="hidden sm:inline text-stone-300">
                · {config.nativeName}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
