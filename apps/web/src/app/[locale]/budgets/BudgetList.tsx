"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatAmountPresentation } from "@/lib/transactions/presentation";
import { parseNaturalDecimalToMinor } from "@/lib/transactions/money-entry";

type Budget = { id: string; categoryName: string; month: string; limitAmountMinor: string; spentAmountMinor: string; remainingAmountMinor: string; currency: string; isOverBudget: boolean; version: number };
type Labels = { spent: string; remaining: string; over: string; edit: string; archive: string; save: string; cancel: string; archiving: string; saving: string; invalid: string; archiveConfirm: string };

export function BudgetList({ initialBudgets, householdId, locale, labels }: { initialBudgets: Budget[]; householdId: string; locale: string; labels: Labels }) {
  const router = useRouter();
  const [budgets, setBudgets] = useState(initialBudgets);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  function begin(b: Budget) { setEditing(b.id); setDraft(formatAmountPresentation(b.limitAmountMinor, b.currency, locale).replace(/[^\d,.-]/g, "").replace(",", ".")); setError(null); }
  async function save(b: Budget) {
    const parsed = parseNaturalDecimalToMinor(draft, b.currency);
    if (!parsed.success || !parsed.amountMinor) { setError(labels.invalid); return; }
    setBusy(b.id); setError(null);
    const response = await fetch(`/api/households/${householdId}/budgets/${b.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ version: b.version, limitAmountMinor: parsed.amountMinor }) });
    if (!response.ok) { setBusy(null); setError(labels.invalid); return; }
    const json = await response.json() as { data: Budget };
    setBudgets((current) => current.map((item) => item.id === b.id ? json.data : item));
    setEditing(null); setBusy(null); router.refresh();
  }
  async function archive(b: Budget) {
    if (!window.confirm(labels.archiveConfirm)) return;
    setBusy(b.id); setError(null);
    setBudgets((current) => current.filter((item) => item.id !== b.id));
    const response = await fetch(`/api/households/${householdId}/budgets/${b.id}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ version: b.version }) });
    if (!response.ok) { setBudgets(initialBudgets); setError(labels.invalid); }
    setBusy(null); router.refresh();
  }
  return <section className="grid gap-4 sm:grid-cols-2">{budgets.map((b) => <article key={b.id} className="finance-card p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><h2 className="font-semibold">{b.categoryName}</h2><div className="flex flex-wrap gap-2"><button type="button" onClick={() => begin(b)} disabled={busy === b.id} className="rounded-lg border px-3 py-2 text-sm">{labels.edit}</button><button type="button" onClick={() => archive(b)} disabled={busy === b.id} className="rounded-lg border border-rose-300 px-3 py-2 text-sm text-rose-700">{busy === b.id ? labels.archiving : labels.archive}</button></div></div>
    {editing === b.id ? <div className="mt-4 flex flex-wrap gap-2"><input aria-label={labels.edit} autoFocus inputMode="decimal" value={draft} onChange={(e) => setDraft(e.target.value)} className="min-w-0 flex-1 rounded-lg border p-2 dark:bg-stone-900" /><button type="button" onClick={() => save(b)} disabled={busy === b.id} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">{busy === b.id ? labels.saving : labels.save}</button><button type="button" onClick={() => setEditing(null)} className="rounded-lg border px-3 py-2 text-sm">{labels.cancel}</button></div> : <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-500 dark:text-stone-400">{labels.spent}</dt><dd className="font-mono">{formatAmountPresentation(b.spentAmountMinor, b.currency, locale)}</dd></div><div><dt className="text-slate-500 dark:text-stone-400">{b.isOverBudget ? labels.over : labels.remaining}</dt><dd className={`font-mono ${b.isOverBudget ? "text-rose-700" : "text-emerald-700"}`}>{formatAmountPresentation(b.remainingAmountMinor, b.currency, locale)}</dd></div></dl>}
    {error ? <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p> : null}
  </article>)}</section>;
}
