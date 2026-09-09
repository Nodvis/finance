import { getTranslations } from "next-intl/server";

import { getCurrentSession } from "@/lib/auth/session";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { ThemeToggle } from "../components/ThemeToggle";

export default async function SettingsPage() {
  const t = await getTranslations("Settings");
  const session = await getCurrentSession();

  if (!session) return null;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">{t("eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-stone-50">{t("title")}</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-stone-400">{t("description")}</p>
      </div>
      <div className="grid gap-4">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <h2 className="text-base font-semibold text-slate-900 dark:text-stone-100">{t("appearance")}</h2>
          <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-stone-950">
            <div><p className="text-sm font-medium text-slate-800 dark:text-stone-200">{t("theme")}</p><p className="text-xs text-slate-500 dark:text-stone-400">{t("themeDescription")}</p></div>
            <ThemeToggle />
          </div>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <h2 className="text-base font-semibold text-slate-900 dark:text-stone-100">{t("language")}</h2>
          <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-stone-950">
            <div><p className="text-sm font-medium text-slate-800 dark:text-stone-200">{t("languageLabel")}</p><p className="text-xs text-slate-500 dark:text-stone-400">{t("languageDescription")}</p></div>
            <LanguageSwitcher />
          </div>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <h2 className="text-base font-semibold text-slate-900 dark:text-stone-100">{t("account")}</h2>
          <p className="mt-3 truncate text-sm text-slate-600 dark:text-stone-400">{session.user.name || session.user.email}</p>
        </section>
      </div>
    </main>
  );
}
