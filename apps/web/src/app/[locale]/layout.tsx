import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";

import { routing } from "@/i18n/routing";
import { getCurrentSession } from "@/lib/auth/session";

import { AppFooter } from "./components/AppFooter";
import { AppHeader } from "./components/AppHeader";
import { PublicAuthHeader } from "./components/PublicAuthHeader";
import "../globals.css";

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: Pick<LocaleLayoutProps, "params">): Promise<Metadata> {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "Metadata" });

  return {
    title: t("title"),
    description: t("description"),
    icons: {
      icon: [
        { url: "/icons/favicon.ico" },
        { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
        { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { url: "/icons/favicon-48x48.png", sizes: "48x48", type: "image/png" },
        { url: "/icons/favicon-64x64.png", sizes: "64x64", type: "image/png" },
      ],
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    manifest: "/icons/site.webmanifest",
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const cookieStore = await cookies();
  const themeCookie =
    cookieStore.get("nodvis_theme")?.value ||
    cookieStore.get("theme")?.value;
  // Default new users to light finance UI without silently overriding an explicit existing preference
  const theme = themeCookie === "dark" ? "dark" : "light";

  const messages = await getMessages();
  const session = await getCurrentSession();

  return (
    <html
      lang={locale}
      className={theme}
      data-theme={theme}
      style={{ colorScheme: theme }}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('nodvis_theme');if(t==='dark'||t==='light'){document.documentElement.classList.remove('light','dark');document.documentElement.classList.add(t);document.documentElement.setAttribute('data-theme',t);document.documentElement.style.colorScheme=t;}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-slate-200 selection:text-slate-900 dark:bg-stone-950 dark:text-stone-100 dark:selection:bg-stone-800 dark:selection:text-stone-100">
        <NextIntlClientProvider messages={messages}>
          <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-stone-950 dark:text-stone-100">
            {session ? <AppHeader /> : <PublicAuthHeader />}
            <div id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
              {children}
            </div>
            <AppFooter />
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
