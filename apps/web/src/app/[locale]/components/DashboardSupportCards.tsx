import Link from "next/link";
import { ArrowRight, CircleCheck, CircleDot, Plus, WalletCards } from "lucide-react";

import { formatAmountPresentation } from "@/lib/transactions/presentation";
import type { SerializedSavingsGoal } from "@/lib/savings-goals/serialization";
import type { SerializedTransaction } from "@/lib/transactions/schema";
import type { SerializedHouseholdOverview } from "@/lib/overview/schema";
import { DashboardCard } from "./ui";

type Account = { id: string; name: string };
type Budget = { id: string; categoryName: string; limitAmountMinor: string; spentAmountMinor: string; currency: string; isOverBudget: boolean };

type Labels = {
  attention: string; calm: string; account: string; balance: string; transaction: string; budget: string; goal: string; add: string; create: string; view: string;
  upcoming: string; overdue: string; missingBalance: string; setupTitle: string; setupDescription: string; done: string;
  budgets: string; budgetsEmpty: string; goals: string; goalsEmpty: string; recent: string; recentEmpty: string; allTransactions: string; spent: string; saved: string; target: string; income: string; expense: string; transfer: string;
};

type Props = {
  overview: SerializedHouseholdOverview;
  accounts: Account[];
  budgets: Budget[];
  goals: SerializedSavingsGoal[];
  transactions: SerializedTransaction[];
  locale: string;
  labels: Labels;
};

function progressPercent(spent: string, limit: string) {
  try {
    const total = BigInt(limit);
    if (total <= 0n) return 0;
    return Math.min(100, Number((BigInt(spent) * 10000n) / total) / 100);
  } catch {
    return 0;
  }
}

function transactionDescription(tx: SerializedTransaction, labels: Labels) {
  if (tx.kind === "expense") return tx.payee || labels.expense;
  if (tx.kind === "income") return tx.source || labels.income;
  return labels.transfer;
}

export function DashboardSupportCards({ overview, accounts, budgets, goals, transactions, locale, labels }: Props) {
  const attention: Array<{ label: string; href: string; tone: "warning" | "neutral" }> = [];
  if (overview.availableCash.missingAccounts.length > 0 || overview.availableCash.staleAccounts.length > 0) attention.push({ label: labels.missingBalance, href: `/${locale}/accounts`, tone: "warning" });
  if ((overview.upcoming?.overdueCount ?? 0) > 0) attention.push({ label: `${labels.overdue}: ${overview.upcoming?.overdueCount}`, href: `/${locale}/upcoming`, tone: "warning" });
  if ((overview.upcoming?.upcomingCount ?? 0) > 0) attention.push({ label: `${labels.upcoming}: ${overview.upcoming?.upcomingCount}`, href: `/${locale}/upcoming`, tone: "neutral" });
  if (budgets.length === 0) attention.push({ label: labels.budget, href: `/${locale}/budgets`, tone: "neutral" });
  if (goals.length === 0) attention.push({ label: labels.goal, href: `/${locale}/goals`, tone: "neutral" });

  const setupSteps = [
    { label: labels.account, complete: accounts.length > 0, href: `/${locale}/accounts` },
    { label: labels.balance, complete: overview.availableCash.freshAccountsCount > 0, href: `/${locale}/accounts` },
    { label: labels.transaction, complete: transactions.length > 0, href: `/${locale}/transactions` },
    { label: labels.budget, complete: budgets.length > 0, href: `/${locale}/budgets` },
    { label: labels.goal, complete: goals.length > 0, href: `/${locale}/goals` },
  ];
  const showSetup = accounts.length === 0 || transactions.length === 0;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
      <DashboardCard className="dashboard-panel dashboard-panel-primary p-5 sm:p-6" aria-label={labels.setupTitle}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="finance-eyebrow text-[var(--finance-signal-dark)] dark:text-[var(--finance-signal)]">{showSetup ? labels.setupTitle : labels.recent}</p>
            <h2 className="finance-section-title mt-1">{showSetup ? labels.setupDescription : labels.recent}</h2>
          </div>
          {showSetup ? <span className="finance-icon-box bg-[var(--finance-signal-soft)] text-[var(--finance-signal-dark)] dark:text-[var(--finance-signal)]"><WalletCards size={17} aria-hidden="true" /></span> : null}
        </div>
        {showSetup ? (
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {setupSteps.map((step) => (
              <Link key={step.label} href={step.href} className="group flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/60 px-3 py-2.5 text-sm transition hover:border-[var(--finance-signal-dark)] hover:bg-[var(--surface-muted)]">
                <span className="flex min-w-0 items-center gap-2"><span className={step.complete ? "text-[var(--finance-signal-dark)] dark:text-[var(--finance-signal)]" : "text-[var(--muted-foreground)]"}>{step.complete ? <CircleCheck size={17} aria-hidden="true" /> : <CircleDot size={17} aria-hidden="true" />}</span><span className="truncate">{step.label}</span></span>
                {!step.complete ? <ArrowRight size={14} className="shrink-0 text-[var(--muted-foreground)] transition group-hover:translate-x-0.5" aria-hidden="true" /> : <span className="text-xs text-[var(--muted-foreground)]">{labels.done}</span>}
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {transactions.slice(0, 6).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-3 last:border-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-3"><span className={`finance-transaction-dot ${tx.kind}`} aria-hidden="true"><CircleDot size={13} /></span><div className="min-w-0"><p className="truncate text-sm font-semibold">{transactionDescription(tx, labels)}</p><p className="truncate text-xs text-[var(--muted-foreground)]">{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(tx.occurredOn))}</p></div></div>
                <p className={`shrink-0 font-mono text-sm font-semibold ${tx.kind === "income" ? "text-[var(--finance-signal-dark)] dark:text-[var(--finance-signal)]" : ""}`}>{tx.kind === "income" ? "+" : tx.kind === "expense" ? "−" : ""}{formatAmountPresentation(tx.amount.amountMinor, tx.amount.currency, locale)}</p>
              </div>
            ))}
            {transactions.length === 0 ? <div className="finance-empty-state py-7"><p className="text-sm font-semibold">{labels.recentEmpty}</p><Link href={`/${locale}/transactions`} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--finance-signal-dark)] underline-offset-4 hover:underline dark:text-[var(--finance-signal)]">{labels.add}<ArrowRight size={14} aria-hidden="true" /></Link></div> : null}
            {transactions.length > 0 ? <Link href={`/${locale}/transactions`} className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)]">{labels.allTransactions}<ArrowRight size={14} aria-hidden="true" /></Link> : null}
          </div>
        )}
      </DashboardCard>

      <DashboardCard className="dashboard-panel p-5 sm:p-6" aria-label={labels.attention}>
        <div className="flex items-start justify-between gap-4"><div><p className="finance-eyebrow">{labels.attention}</p><h2 className="finance-section-title mt-1">{attention.length ? labels.attention : labels.calm}</h2></div><span className={`finance-icon-box ${attention.length ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" : "bg-[var(--finance-signal-soft)] text-[var(--finance-signal-dark)] dark:text-[var(--finance-signal)]"}`}><CircleCheck size={17} aria-hidden="true" /></span></div>
        {attention.length ? <ul className="mt-5 space-y-2">{attention.slice(0, 5).map((item) => <li key={item.label}><Link href={item.href} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm transition hover:border-[var(--finance-signal-dark)]"><span className="flex min-w-0 items-center gap-2"><span className={`h-2 w-2 shrink-0 rounded-full ${item.tone === "warning" ? "bg-amber-500" : "bg-[var(--finance-signal-dark)] dark:bg-[var(--finance-signal)]"}`} aria-hidden="true" /><span className="truncate">{item.label}</span></span><ArrowRight size={14} className="shrink-0 text-[var(--muted-foreground)]" aria-hidden="true" /></Link></li>)}</ul> : <p className="mt-5 text-sm leading-6 text-[var(--muted-foreground)]">{labels.calm}</p>}
      </DashboardCard>

      <DashboardCard className="dashboard-panel p-5" aria-label={labels.budgets}>
        <div className="flex items-start justify-between gap-3"><div><p className="finance-eyebrow">{labels.budgets}</p><h2 className="finance-section-title mt-1">{budgets.length ? labels.budgets : labels.budgetsEmpty}</h2></div><Link href={`/${locale}/budgets`} className="finance-icon-button h-8 w-8" aria-label={labels.view}><ArrowRight size={15} aria-hidden="true" /></Link></div>
        {budgets.length ? <div className="mt-5 space-y-4">{budgets.slice(0, 3).map((budget) => { const progress = progressPercent(budget.spentAmountMinor, budget.limitAmountMinor); return <div key={budget.id}><div className="flex items-center justify-between gap-3 text-sm"><span className="truncate font-semibold">{budget.categoryName}</span><span className="shrink-0 font-mono text-xs text-[var(--muted-foreground)]">{formatAmountPresentation(budget.spentAmountMinor, budget.currency, locale)} / {formatAmountPresentation(budget.limitAmountMinor, budget.currency, locale)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]"><div className={`h-full rounded-full transition-all ${budget.isOverBudget ? "bg-rose-500" : "bg-[var(--finance-signal-dark)] dark:bg-[var(--finance-signal)]"}`} style={{ width: `${progress}%` }} /></div></div>})}</div> : <Link href={`/${locale}/budgets`} className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[var(--finance-signal-dark)] hover:underline dark:text-[var(--finance-signal)]">{labels.create}<Plus size={14} aria-hidden="true" /></Link>}
      </DashboardCard>

      <DashboardCard className="dashboard-panel p-5" aria-label={labels.goals}>
        <div className="flex items-start justify-between gap-3"><div><p className="finance-eyebrow">{labels.goals}</p><h2 className="finance-section-title mt-1">{goals.length ? goals[0]?.name : labels.goalsEmpty}</h2></div><Link href={`/${locale}/goals`} className="finance-icon-button h-8 w-8" aria-label={labels.view}><ArrowRight size={15} aria-hidden="true" /></Link></div>
        {goals.length && goals[0] ? <div className="mt-5"><div className="flex items-center justify-between text-sm"><span className="text-[var(--muted-foreground)]">{labels.saved}</span><span className="font-mono font-semibold">{formatAmountPresentation(goals[0].currentAmountMinor, goals[0].currency, locale)} / {formatAmountPresentation(goals[0].targetAmountMinor, goals[0].currency, locale)}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]"><div className="h-full rounded-full bg-[var(--finance-signal-dark)] dark:bg-[var(--finance-signal)]" style={{ width: `${Math.min(100, goals[0].calculation.progressPercentage)}%` }} /></div><p className="mt-2 text-xs text-[var(--muted-foreground)]">{goals[0].calculation.progressPercentage.toFixed(0)}% · {labels.target}: {goals[0].currency}</p></div> : <Link href={`/${locale}/goals`} className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[var(--finance-signal-dark)] hover:underline dark:text-[var(--finance-signal)]">{labels.create}<Plus size={14} aria-hidden="true" /></Link>}
      </DashboardCard>
    </div>
  );
}
