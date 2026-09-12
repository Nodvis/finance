import type { ReactNode } from "react";

type DashboardCardProps = {
  children: ReactNode;
  className?: string;
  as?: "article" | "section";
};

export function DashboardCard({ children, className = "", as = "article" }: DashboardCardProps) {
  const Card = as;
  return (
    <Card className={`finance-card ${className}`}>
      {children}
    </Card>
  );
}

export function SectionHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow ? <p className="finance-eyebrow">{eyebrow}</p> : null}
        <h2 className="finance-section-title">{title}</h2>
        {description ? <p className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function MetricCard({ label, value, detail, tone = "neutral", icon }: { label: string; value: string; detail?: ReactNode; tone?: "neutral" | "positive" | "warning"; icon?: ReactNode }) {
  return (
    <DashboardCard className="flex min-h-40 flex-col justify-between p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="finance-eyebrow">{label}</p>
        {icon ? <span className="finance-icon-box" aria-hidden="true">{icon}</span> : null}
      </div>
      <div>
        <p className={`finance-metric ${tone === "positive" ? "text-[var(--finance-signal-dark)] dark:text-[var(--finance-signal)]" : tone === "warning" ? "text-amber-700 dark:text-amber-300" : "text-[var(--foreground)]"}`}>{value}</p>
        {detail ? <div className="mt-2 text-xs text-[var(--muted-foreground)]">{detail}</div> : null}
      </div>
    </DashboardCard>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="finance-empty-state">
      <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
      {description ? <p className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</p> : null}
    </div>
  );
}

export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "positive" | "warning" | "danger" }) {
  const tones = {
    neutral: "bg-[var(--surface-muted)] text-[var(--muted-foreground)]",
    positive: "bg-[var(--finance-signal-soft)] text-[var(--finance-signal-dark)] dark:text-[var(--finance-signal)]",
    warning: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
    danger: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}
