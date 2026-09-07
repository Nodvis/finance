import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";

import { routing } from "@/i18n/routing";

import { AppFooter } from "./components/AppFooter";
import { AppHeader } from "./components/AppHeader";
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

  const messages = await getMessages();

  return (
    <html lang={locale} className="dark">
      <body className="min-h-screen bg-stone-950 text-stone-100 antialiased selection:bg-stone-800 selection:text-stone-100">
        <NextIntlClientProvider messages={messages}>
          <div className="flex min-h-screen flex-col bg-stone-950 text-stone-100">
            <AppHeader />
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
