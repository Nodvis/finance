"use client";

import { Link, usePathname } from "@/i18n/navigation";

const ITEMS = [
  ["/", "home"],
  ["/accounts", "accounts"],
  ["/categories", "categories"],
  ["/imports", "imports"],
  ["/transfers", "transfers"],
  ["/liabilities", "liabilities"],
  ["/upcoming", "upcoming"],
  ["/rules", "rules"],
  ["/recurring", "recurring"],
  ["/analytics", "analytics"],
  ["/forecast", "forecast"],
] as const;

type Props = { labels: Record<(typeof ITEMS)[number][1], string>; ariaLabel: string };

export function AppNav({ labels, ariaLabel }: Props) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={ariaLabel}
      className="flex min-w-0 justify-start overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:justify-center sm:overflow-visible"
    >
      <div className="flex shrink-0 items-center gap-1 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-1 shadow-xs dark:border-stone-800/80 dark:bg-stone-900/60 sm:flex-wrap sm:justify-center">
        {ITEMS.map(([href, key]) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`relative whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-stone-950 ${
                active
                  ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-200/80 dark:bg-stone-800 dark:text-stone-50 dark:ring-stone-700"
                  : "text-slate-600 hover:bg-white/80 hover:text-slate-950 dark:text-stone-400 dark:hover:bg-stone-800/70 dark:hover:text-stone-100"
              }`}
            >
              {labels[key]}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
