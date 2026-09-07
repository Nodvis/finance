import { useTranslations } from "next-intl";

export function AppFooter() {
  const tFooter = useTranslations("Footer");

  return (
    <footer
      role="contentinfo"
      className="mt-auto border-t border-stone-800/80 bg-stone-950/60 py-8 text-xs text-stone-500"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
        <p className="text-center sm:text-left text-stone-400">
          {tFooter("tagline")}
        </p>
        <p className="max-w-md text-center sm:text-right text-[11px] text-stone-500">
          {tFooter("privacyNote")}
        </p>
      </div>
    </footer>
  );
}
