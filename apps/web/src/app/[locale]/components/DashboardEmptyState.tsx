import Link from "next/link";
import { ArrowRight, CircleCheck, CircleDot, Sparkles } from "lucide-react";

import { DashboardCard } from "./ui";

type Step = { label: string; complete: boolean; href: string };

type Props = {
  steps: Step[];
  title: string;
  description: string;
  nextTitle: string;
  nextDescription: string;
  done: string;
  locale: string;
};

export function DashboardEmptyState({ steps, title, description, nextTitle, nextDescription, done, locale }: Props) {
  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]" aria-labelledby="dashboard-empty-title">
      <DashboardCard className="dashboard-panel dashboard-panel-primary p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="finance-eyebrow text-[var(--finance-signal-dark)] dark:text-[var(--finance-signal)]">{title}</p>
            <h2 id="dashboard-empty-title" className="finance-section-title mt-1">{description}</h2>
          </div>
          <span className="finance-icon-box bg-[var(--finance-signal-soft)] text-[var(--finance-signal-dark)] dark:text-[var(--finance-signal)]"><Sparkles size={17} aria-hidden="true" /></span>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {steps.map((step) => (
            <Link key={step.label} href={step.href} className="group flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/60 px-3 py-2.5 text-sm transition hover:border-[var(--finance-signal-dark)] hover:bg-[var(--surface-muted)]">
              <span className="flex min-w-0 items-center gap-2"><span className={step.complete ? "text-[var(--finance-signal-dark)] dark:text-[var(--finance-signal)]" : "text-[var(--muted-foreground)]"}>{step.complete ? <CircleCheck size={17} aria-hidden="true" /> : <CircleDot size={17} aria-hidden="true" />}</span><span className="truncate">{step.label}</span></span>
              {!step.complete ? <ArrowRight size={14} className="shrink-0 text-[var(--muted-foreground)] transition group-hover:translate-x-0.5" aria-hidden="true" /> : <span className="text-xs text-[var(--muted-foreground)]">{done}</span>}
            </Link>
          ))}
        </div>
      </DashboardCard>
      <DashboardCard className="dashboard-panel p-5 sm:p-6">
        <p className="finance-eyebrow">{nextTitle}</p>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{nextDescription}</p>
        <Link href={`/${locale}/accounts`} className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[var(--finance-signal-dark)] hover:underline dark:text-[var(--finance-signal)]">{steps.find((step) => !step.complete)?.label ?? title}<ArrowRight size={14} aria-hidden="true" /></Link>
      </DashboardCard>
    </section>
  );
}
