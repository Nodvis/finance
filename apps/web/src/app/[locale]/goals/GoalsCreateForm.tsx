"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseNaturalDecimalToMinor } from "@/lib/transactions/money-entry";

type Props = { householdId: string; labels: { name: string; target: string; currency: string; date: string; submit: string; invalid: string } };

export function GoalsCreateForm({ householdId, labels }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [currency, setCurrency] = useState("PLN");
  const [targetDate, setTargetDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseNaturalDecimalToMinor(target, currency);
    if (!parsed.success || !parsed.amountMinor) { setError(labels.invalid); return; }
    const response = await fetch(`/api/households/${householdId}/goals`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, targetAmountMinor: parsed.amountMinor, currency, targetDate: targetDate || null }) });
    if (!response.ok) { setError(labels.invalid); return; }
    setName(""); setTarget(""); setTargetDate(""); setError(null); setOpen(false); router.refresh();
  }
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white dark:bg-stone-100 dark:text-stone-900">{labels.submit}</button>;
  return <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-slate-200 p-4 dark:border-stone-700 sm:grid-cols-2" aria-label={labels.submit}>
    <label className="grid gap-1 text-sm font-medium">{labels.name}<input required value={name} onChange={(e) => setName(e.target.value)} className="rounded-lg border p-2 dark:border-stone-600 dark:bg-stone-900" /></label>
    <label className="grid gap-1 text-sm font-medium">{labels.target}<input required inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} className="rounded-lg border p-2 dark:border-stone-600 dark:bg-stone-900" /></label>
    <label className="grid gap-1 text-sm font-medium">{labels.currency}<input required maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} className="rounded-lg border p-2 uppercase dark:border-stone-600 dark:bg-stone-900" /></label>
    <label className="grid gap-1 text-sm font-medium">{labels.date}<input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="rounded-lg border p-2 dark:border-stone-600 dark:bg-stone-900" /></label>
    {error ? <p role="alert" className="text-sm text-rose-700 sm:col-span-2">{error}</p> : null}
    <button type="submit" className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white sm:col-span-2">{labels.submit}</button>
  </form>;
}
