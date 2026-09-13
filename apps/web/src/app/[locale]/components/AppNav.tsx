"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, BarChart3, CalendarDays, CreditCard, LayoutDashboard, ListFilter, MoreHorizontal, ReceiptText, Repeat2, Scale, Tags, Upload, WalletCards, Target, Landmark, X } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { FinanceBrand } from "./FinanceBrand";

type NavItem = readonly [string, string, typeof LayoutDashboard];
type NavGroup = { key: "primary" | "planning" | "wealth" | "organization" | "analysis"; items: readonly NavItem[] };

const GROUPS: readonly NavGroup[] = [
  { key: "primary", items: [["/", "home", LayoutDashboard], ["/transactions", "transactions", ReceiptText], ["/accounts", "accounts", WalletCards]] },
  { key: "planning", items: [["/budgets", "budgets", Landmark], ["/goals", "goals", Target], ["/forecast", "forecast", BarChart3], ["/plan", "plan", BarChart3], ["/upcoming", "upcoming", CalendarDays]] },
  { key: "wealth", items: [["/net-worth", "netWorth", Scale], ["/liabilities", "liabilities", CreditCard], ["/transfers", "transfers", ArrowLeftRight]] },
  { key: "organization", items: [["/categories", "categories", Tags], ["/recurring", "recurring", Repeat2], ["/rules", "rules", ListFilter], ["/imports", "imports", Upload]] },
  { key: "analysis", items: [["/analytics", "analytics", BarChart3]] },
] as const;
const ITEMS: readonly NavItem[] = GROUPS.flatMap((group) => group.items);
type Key = string;
type Props = { labels: Record<Key, string> & { more: string; closeMore: string; primary: string; planning: string; wealth: string; organization: string; analysis: string }; ariaLabel: string };

export function AppNav({ labels, ariaLabel }: Props) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const closeMore = () => { setMoreOpen(false); moreButtonRef.current?.focus(); };
  useEffect(() => { if (!moreOpen) return; closeButtonRef.current?.focus(); const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") closeMore(); }; window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown); }, [moreOpen]);
  const active = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);
  const renderItem = ([href, key, Icon]: NavItem) => <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} className={`finance-nav-item ${active(href) ? "finance-nav-item-active" : ""}`}><Icon size={18} strokeWidth={1.8} aria-hidden="true" /><span>{labels[key]}</span></Link>;

  return <>
    <nav className="finance-sidebar" aria-label={ariaLabel}>
      <Link href="/" aria-label={labels.home} className="finance-sidebar-brand"><FinanceBrand /></Link>
      {GROUPS.map((group) => <div key={group.key} className="finance-sidebar-group"><p className="finance-nav-heading">{labels[group.key]}</p>{group.items.map(renderItem)}</div>)}
    </nav>
    <nav className="finance-mobile-nav" aria-label={ariaLabel}>
      {(GROUPS[0]?.items ?? []).slice(0, 3).map(renderItem)}
      <button ref={moreButtonRef} type="button" onClick={() => setMoreOpen((open) => !open)} aria-expanded={moreOpen} aria-controls="mobile-more-menu" className={`finance-nav-item ${moreOpen ? "finance-nav-item-active" : ""}`}><MoreHorizontal size={18} strokeWidth={1.8} aria-hidden="true" /><span>{moreOpen ? labels.closeMore : labels.more}</span></button>
    </nav>
    {moreOpen ? <div id="mobile-more-menu" className="finance-mobile-more" role="dialog" aria-modal="true" aria-label={labels.more} onKeyDown={(event) => { if (event.key !== "Tab") return; const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("a,button")); const first = focusable[0]; const last = focusable.at(-1); if (!first || !last) return; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }}><div className="flex items-center justify-between border-b border-[var(--border)] pb-3"><p className="finance-section-title">{labels.more}</p><button ref={closeButtonRef} type="button" className="finance-icon-button" aria-label={labels.closeMore} onClick={closeMore}><X size={18} aria-hidden="true" /></button></div><div className="mt-3 grid gap-1">{ITEMS.slice(3).map(renderItem)}</div></div> : null}
  </>;
}
