"use client";

import { useState } from "react";
import { ArrowLeftRight, BarChart3, CalendarDays, CreditCard, LayoutDashboard, ListFilter, MoreHorizontal, ReceiptText, Repeat2, Tags, Upload, WalletCards, X } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { FinanceBrand } from "./FinanceBrand";

const ITEMS = [
  ["/", "home", LayoutDashboard], ["/accounts", "accounts", WalletCards], ["/transactions", "transactions", ReceiptText], ["/categories", "categories", Tags], ["/imports", "imports", Upload], ["/transfers", "transfers", ArrowLeftRight], ["/liabilities", "liabilities", CreditCard], ["/upcoming", "upcoming", CalendarDays], ["/rules", "rules", ListFilter], ["/recurring", "recurring", Repeat2], ["/analytics", "analytics", BarChart3], ["/forecast", "forecast", BarChart3],
] as const;
type Key = (typeof ITEMS)[number][1];
type Props = { labels: Record<Key, string> & { more: string; closeMore: string; primary: string; planning: string; settings: string }; ariaLabel: string };

export function AppNav({ labels, ariaLabel }: Props) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const active = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);
  const primary = ITEMS.slice(0, 4);
  const planning = ITEMS.slice(4, 8);
  const secondary = ITEMS.slice(8);
  const renderItem = ([href, key, Icon]: (typeof ITEMS)[number]) => <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} className={`finance-nav-item ${active(href) ? "finance-nav-item-active" : ""}`}><Icon size={18} strokeWidth={1.8} aria-hidden="true" /><span>{labels[key]}</span></Link>;

  return <>
    <nav className="finance-sidebar" aria-label={ariaLabel}>
      <Link href="/" aria-label={labels.home} className="finance-sidebar-brand"><FinanceBrand /></Link>
      <div className="finance-sidebar-group"><p className="finance-nav-heading">{labels.primary}</p>{primary.map(renderItem)}</div>
      <div className="finance-sidebar-group"><p className="finance-nav-heading">{labels.planning}</p>{planning.map(renderItem)}</div>
      <div className="finance-sidebar-group"><p className="finance-nav-heading">{labels.settings}</p>{secondary.map(renderItem)}</div>
    </nav>
    <nav className="finance-mobile-nav" aria-label={ariaLabel}>
      {primary.slice(0, 3).map(renderItem)}
      <button type="button" onClick={() => setMoreOpen((open) => !open)} aria-expanded={moreOpen} aria-controls="mobile-more-menu" className={`finance-nav-item ${moreOpen ? "finance-nav-item-active" : ""}`}><MoreHorizontal size={18} strokeWidth={1.8} aria-hidden="true" /><span>{moreOpen ? labels.closeMore : labels.more}</span></button>
    </nav>
    {moreOpen ? <div id="mobile-more-menu" className="finance-mobile-more" role="dialog" aria-label={labels.more}><div className="flex items-center justify-between border-b border-[var(--border)] pb-3"><p className="finance-section-title">{labels.more}</p><button type="button" className="finance-icon-button" aria-label={labels.closeMore} onClick={() => setMoreOpen(false)}><X size={18} aria-hidden="true" /></button></div><div className="mt-3 grid gap-1">{[...planning, ...secondary].map(renderItem)}</div></div> : null}
  </>;
}
