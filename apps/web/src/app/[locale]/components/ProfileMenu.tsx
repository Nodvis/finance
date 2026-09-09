"use client";

import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { SignOutButton } from "./SignOutButton";

type Props = { name: string | null | undefined; email: string; labels: { open: string; account: string; profile: string } };

export function ProfileMenu({ name, email, labels }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const displayName = name?.trim() || email;
  const initials = displayName.slice(0, 1).toUpperCase();

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={labels.open.replace("{name}", displayName)}
        onClick={() => setOpen((value) => !value)}
        className="flex max-w-48 items-center gap-2 rounded-xl border border-slate-200/90 bg-white/80 px-2 py-1.5 text-left shadow-xs transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:border-stone-800 dark:bg-stone-900/80 dark:hover:bg-stone-800"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          {initials}
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block max-w-32 truncate text-xs font-semibold text-slate-800 dark:text-stone-100">{displayName}</span>
          <span className="block text-[10px] text-slate-500 dark:text-stone-400">{labels.account}</span>
        </span>
        <svg className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.51a.75.75 0 0 1-1.08 0l-4.25-4.51a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" /></svg>
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10 dark:border-stone-800 dark:bg-stone-900">
          <div className="border-b border-slate-100 px-3 pb-3 pt-2 dark:border-stone-800">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-stone-100">{displayName}</p>
            <p className="truncate text-xs text-slate-500 dark:text-stone-400">{email}</p>
          </div>
          <Link role="menuitem" href="/settings" onClick={() => setOpen(false)} className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-stone-200 dark:hover:bg-stone-800">
            <span aria-hidden="true">◉</span>{labels.profile}
          </Link>
          <div className="mt-1 rounded-xl px-3 py-2 [&_button]:w-full [&_button]:justify-start [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-0 [&_button]:py-2 [&_button]:shadow-none">
            <SignOutButton />
          </div>
        </div>
      ) : null}
    </div>
  );
}
