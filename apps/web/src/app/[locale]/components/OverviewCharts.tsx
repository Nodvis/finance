"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getCurrencyFractionDigits } from "@/lib/transactions/money-entry";

type CurrencyFlow = { currency: string; incomeMinor: string; spendingMinor: string; netCashFlowMinor: string; transactionCount: number };
type Category = { categoryName: string | null; categoryId: string | null; amountMinor: string; currency: string; percentage: number; transactionCount: number };

type Props = { flows: CurrencyFlow[]; categories: Category[]; locale: string; labels: { cashFlow: string; income: string; spending: string; net: string; spendingBreakdown: string; empty: string; incomeDescription: string; spendingDescription: string; uncategorized: string } };

function boundedMinor(value: string) {
  try {
    const parsed = BigInt(value);
    const max = BigInt(Number.MAX_SAFE_INTEGER);
    return Number(parsed > max ? max : parsed < -max ? -max : parsed);
  } catch {
    return 0;
  }
}

function formatMinor(value: string, currency: string, locale: string, fallback: string) {
  try {
    const minor = BigInt(value);
    const sign = minor < 0n ? "−" : "";
    const absolute = minor < 0n ? -minor : minor;
    const fractionDigits = getCurrencyFractionDigits(currency);
    const formatted = new Intl.NumberFormat(locale, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(absolute);
    return `${sign}${formatted} ${currency}`;
  } catch {
    return fallback;
  }
}

export function OverviewCharts({ flows, categories, locale, labels }: Props) {
  const chartData = flows.map((item) => ({ ...item, income: boundedMinor(item.incomeMinor), spending: boundedMinor(item.spendingMinor), net: boundedMinor(item.netCashFlowMinor) }));
  const pieData = categories.slice(0, 6).map((item) => ({ name: item.categoryName ?? labels.uncategorized, value: Math.max(item.percentage, 0) }));
  const colors = ["#C7F36A", "#8DB83E", "#AAB4C0", "#66717F", "#D8DEE5", "#454D58"];
  const colorFor = (index: number) => colors[index % colors.length] ?? colors[0] ?? "#C7F36A";

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
      <section className="finance-card p-5" aria-labelledby="cash-flow-chart-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="finance-eyebrow">{labels.cashFlow}</p><h2 id="cash-flow-chart-title" className="finance-section-title">{labels.income} / {labels.spending}</h2></div>
          {flows.length ? <span className="finance-chart-legend"><i className="bg-[var(--finance-signal)]" />{labels.income}<i className="ml-2 bg-slate-400" />{labels.spending}</span> : null}
        </div>
        {chartData.length ? <div className="mt-5 h-56 w-full" role="img" aria-label={`${labels.cashFlow}: ${chartData.map((item) => `${item.currency}, ${formatMinor(item.netCashFlowMinor, item.currency, locale, labels.empty)}`).join("; ")}`}>
          <ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="currency" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickFormatter={(value) => new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value)} /><Tooltip formatter={(value, name, item) => { const currency = (item as { payload?: { currency?: string } }).payload?.currency ?? ""; return [formatMinor(String(value), currency, locale, labels.empty), String(name)]; }} /><Bar dataKey="income" name={labels.income} fill="#C7F36A" radius={[5, 5, 0, 0]} /><Bar dataKey="spending" name={labels.spending} fill="#858C96" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer>
        </div> : <div className="mt-5"><EmptyChart label={labels.empty} /></div>}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">{chartData.map((item) => <div key={item.currency} className="rounded-xl bg-[var(--surface-muted)] p-3"><p className="text-xs text-[var(--muted-foreground)]">{item.currency} · {labels.net}</p><p className="mt-1 font-mono text-sm font-semibold text-[var(--foreground)]">{formatMinor(item.netCashFlowMinor, item.currency, locale, labels.empty)}</p></div>)}</div>
      </section>
      <section className="finance-card p-5" aria-labelledby="spending-chart-title">
        <p className="finance-eyebrow">{labels.spendingBreakdown}</p><h2 id="spending-chart-title" className="finance-section-title">{labels.spending}</h2>
        {pieData.length ? <><div className="mt-4 h-44" role="img" aria-label={`${labels.spendingBreakdown}: ${pieData.map((item) => `${item.name} ${item.value}%`).join(", ")}`}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={2} stroke="none">{pieData.map((item, index) => <Cell key={item.name} fill={colorFor(index)} />)}</Pie><Tooltip formatter={(value) => [`${value}%`, labels.spending]} /></PieChart></ResponsiveContainer></div><ul className="space-y-2" aria-label={labels.spendingDescription}>{pieData.map((item, index) => <li key={item.name} className="flex items-center justify-between gap-3 text-xs"><span className="flex min-w-0 items-center gap-2 truncate text-[var(--muted-foreground)]"><i className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colorFor(index) }} />{item.name}</span><span className="font-mono font-medium text-[var(--foreground)]">{item.value.toFixed(1)}%</span></li>)}</ul></> : <div className="mt-5"><EmptyChart label={labels.empty} /></div>}
      </section>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) { return <div className="flex min-h-44 items-center justify-center rounded-xl border border-dashed border-[var(--border)] px-5 text-center text-sm text-[var(--muted-foreground)]">{label}</div>; }
