import { getTranslations } from "next-intl/server";

export default async function HomePage() {
  const t = await getTranslations("HomePage");

  const summaryCards = [
    { key: "available", label: t("cards.available") },
    { key: "upcoming", label: t("cards.upcoming") },
    { key: "debt", label: t("cards.debt") },
  ] as const;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-5 py-10 sm:px-8 lg:px-12">
      <header className="flex max-w-3xl flex-col gap-3">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500 dark:text-stone-400">
          {t("eyebrow")}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          {t("title")}
        </h1>
        <p className="max-w-2xl text-base leading-7 text-stone-600 dark:text-stone-300">
          {t("description")}
        </p>
      </header>

      <section
        aria-label={t("summaryLabel")}
        className="grid gap-4 md:grid-cols-3"
      >
        {summaryCards.map((card) => (
          <article
            key={card.key}
            className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900"
          >
            <p className="text-sm font-medium text-stone-500 dark:text-stone-400">
              {card.label}
            </p>
            <p className="mt-5 text-3xl font-semibold">—</p>
            <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
              {t("noData")}
            </p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-dashed border-stone-300 p-6 dark:border-stone-700">
        <h2 className="text-lg font-semibold">{t("next.title")}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600 dark:text-stone-300">
          {t("next.description")}
        </p>
      </section>
    </main>
  );
}
