"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { parseNaturalDecimalToMinor } from "@/lib/transactions/money-entry";
import { formatAmountPresentation, minorUnitsToDecimalString } from "@/lib/transactions/presentation";
import type { HouseholdCategorySummary } from "@nodvis/finance-db";
import type { SerializedExpenseTransaction } from "@/lib/transactions/schema";

export function SplitEditor({ transaction, categories, householdId, onClose, onSaved }: { transaction: SerializedExpenseTransaction; categories: HouseholdCategorySummary[]; householdId: string; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("Transactions.split");
  const locale = useLocale();
  const [rows, setRows] = useState([{ categoryId: categories[0]?.id ?? "", amount: "" }, { categoryId: categories[1]?.id ?? "", amount: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(transaction.version);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/households/${householdId}/transactions/${transaction.id}/split`).then((res) => res.ok ? res.json() : null).then((body) => {
      if (cancelled || !body?.data) return;
      setVersion(body.data.version);
      if (body.data.allocations.length >= 2) setRows(body.data.allocations.map((a: { categoryId: string; amountMinor: string; currency: string }) => ({ categoryId: a.categoryId, amount: minorUnitsToDecimalString(a.amountMinor, a.currency) })));
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [householdId, transaction.id]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const allocations = rows.map((r) => { const parsed = parseNaturalDecimalToMinor(r.amount, transaction.amount.currency); return parsed.success && parsed.amountMinor ? { categoryId: r.categoryId, amount: { amountMinor: parsed.amountMinor.toString(), currency: transaction.amount.currency } } : null; });
    if (allocations.some((a) => !a) || allocations.some((a) => !a!.categoryId)) { setError(t("invalidAmount")); return; }
    setSaving(true);
    const res = await fetch(`/api/households/${householdId}/transactions/${transaction.id}/split`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedVersion: version, allocations }) });
    if (!res.ok) { await res.json().catch(() => null); setError(res.status === 409 ? t("conflict") : res.status === 400 ? t("invalidAmount") : t("error")); setSaving(false); return; }
    onSaved(); onClose();
  }
  return <div role="dialog" aria-modal="true" aria-labelledby="split-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><form onSubmit={submit} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 dark:bg-stone-900"><h2 id="split-title" className="text-lg font-semibold">{t("title")}</h2><p className="text-sm text-slate-600 dark:text-stone-400">{t("description", { amount: formatAmountPresentation(transaction.amount.amountMinor, transaction.amount.currency, locale) })}</p>{rows.map((row, i) => <div className="flex gap-2" key={i}><select aria-label={t("category")} required value={row.categoryId} onChange={(e) => setRows((old) => old.map((x, j) => j === i ? { ...x, categoryId: e.target.value } : x))} className="min-w-0 flex-1 rounded-lg border p-2 dark:bg-stone-950">{categories.filter((c) => c.id === row.categoryId || !rows.some((x) => x.categoryId === c.id)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><input aria-label={t("amount")} required inputMode="decimal" value={row.amount} onChange={(e) => setRows((old) => old.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} className="w-32 rounded-lg border p-2 dark:bg-stone-950" placeholder={t("placeholder")} /></div>)}{error && <p role="alert" className="text-sm text-rose-600">{error}</p>}<div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border px-3 py-2">{t("cancel")}</button><button type="submit" disabled={saving} className="rounded-lg bg-emerald-600 px-3 py-2 text-white">{saving ? t("saving") : t("save")}</button></div></form></div>;
}
