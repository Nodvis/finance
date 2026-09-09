"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { AuthorizedHouseholdUserContext } from "@/lib/authorization/household";
import type { SerializedCategory } from "@/lib/categories/schema";
import type { SerializedCategorizationRule } from "@/lib/categorization-rules/schema";
import type { SerializedTransaction } from "@/lib/transactions/schema";

type PreviewItem = { transactionId: string; currentCategoryId: string | null; proposedCategoryId: string | null; status: "match" | "manual_override" | "conflict" | "no_match"; explanation: string; ruleId: string | null };

export function RulesView({ householdContext, initialRules, categories, transactions }: { householdContext: AuthorizedHouseholdUserContext; initialRules: SerializedCategorizationRule[]; categories: SerializedCategory[]; transactions: SerializedTransaction[] }) {
  const t = useTranslations("Rules");
  const router = useRouter();
  const [rules, setRules] = useState(initialRules);
  const [name, setName] = useState("");
  const [matchText, setMatchText] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [priority, setPriority] = useState("100");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<PreviewItem[]>([]);
  const [learningCategoryIds, setLearningCategoryIds] = useState<Record<string, string>>({});

  async function createRule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage(null);
    const category = categories.find((item) => item.id === categoryId);
    const response = await fetch(`/api/households/${householdContext.householdId}/categorization-rules`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, matchField: "counterparty", matchMode: "contains", matchText, applicability: category?.applicability === "income" ? "income" : "expense", categoryId, priority: Number.parseInt(priority, 10) || 100 }) });
    const json = await response.json();
    if (response.ok) { setRules((current) => [...current, json.data]); setName(""); setMatchText(""); setMessage(t("created")); router.refresh(); }
    else setMessage(json.error ?? t("error"));
    setBusy(false);
  }

  async function toggleRule(rule: SerializedCategorizationRule) {
    const response = await fetch(`/api/households/${householdContext.householdId}/categorization-rules/${rule.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !rule.enabled }) });
    const json = await response.json();
    if (response.ok) setRules((current) => current.map((item) => item.id === rule.id ? json.data : item));
    else setMessage(json.error ?? t("error"));
  }

  async function applyRules(previewOnly: boolean) {
    if (selectedTransactionIds.length === 0) return;
    setBusy(true); setMessage(null);
    const response = await fetch(`/api/households/${householdContext.householdId}/categorization-rules/apply`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transactionIds: selectedTransactionIds, previewOnly }) });
    const json = await response.json();
    if (response.ok) { setPreview(json.data.results ?? json.data.preview ?? json.data); setMessage(t(previewOnly ? "previewed" : "applied")); if (!previewOnly) router.refresh(); }
    else setMessage(json.error ?? t("error"));
    setBusy(false);
  }

  async function learnFromTransaction(transaction: SerializedTransaction) {
    const selectedCategoryId = learningCategoryIds[transaction.id];
    if (!selectedCategoryId) return;
    const matchText = transaction.kind === "expense" ? transaction.payee : transaction.kind === "income" ? transaction.source : "";
    if (!matchText) return;
    setBusy(true); setMessage(null);
    const response = await fetch(`/api/households/${householdContext.householdId}/categorization-rules`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: t("learnedRuleName", { matchText }), matchField: "counterparty", matchMode: "exact", matchText, applicability: transaction.kind === "income" ? "income" : "expense", categoryId: selectedCategoryId, priority: 100 }) });
    const json = await response.json();
    if (response.ok) { setRules((current) => [...current, json.data]); setMessage(t("learned")); router.refresh(); }
    else setMessage(json.error ?? t("error"));
    setBusy(false);
  }

  function transactionDescription(transaction: SerializedTransaction) {
    return transaction.kind === "expense" ? transaction.payee : transaction.kind === "income" ? transaction.source : t("transfer");
  }

  return <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
    <header><p className="text-sm font-medium text-indigo-600 dark:text-indigo-300">{t("eyebrow")}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{t("title")}</h1><p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">{t("description")}</p></header>
    {message && <p role="status" className="rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900">{message}</p>}
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><h2 className="text-lg font-semibold">{t("createTitle")}</h2><form onSubmit={createRule} className="mt-4 grid gap-4 sm:grid-cols-2">
      <label className="grid gap-1 text-sm"><span>{t("name")}</span><input required value={name} onChange={(event) => setName(event.target.value)} className="rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" /></label>
      <label className="grid gap-1 text-sm"><span>{t("matchText")}</span><input required value={matchText} onChange={(event) => setMatchText(event.target.value)} className="rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" /></label>
      <label className="grid gap-1 text-sm"><span>{t("category")}</span><select required value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950">{categories.filter((item) => item.archivedAt === null).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="grid gap-1 text-sm"><span>{t("priority")}</span><input type="number" min="0" value={priority} onChange={(event) => setPriority(event.target.value)} className="rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" /></label>
      <button disabled={busy || !categoryId} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2">{busy ? t("saving") : t("save")}</button>
    </form></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><h2 className="text-lg font-semibold">{t("selectionTitle")}</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t("selectionDescription")}</p><div className="mt-4 grid gap-2">{transactions.length === 0 ? <p className="rounded-xl border border-dashed p-4 text-sm dark:border-slate-700">{t("noUncategorized")}</p> : transactions.map((transaction) => <label key={transaction.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm dark:border-slate-700"><input type="checkbox" checked={selectedTransactionIds.includes(transaction.id)} onChange={(event) => { setPreview([]); setSelectedTransactionIds((current) => event.target.checked ? [...current, transaction.id] : current.filter((id) => id !== transaction.id)); }} /><span className="min-w-0 flex-1 truncate">{transactionDescription(transaction)}</span><span className="text-slate-500">{transaction.occurredOn.slice(0, 10)}</span><select aria-label={t("learnCategory", { description: transactionDescription(transaction) })} value={learningCategoryIds[transaction.id] ?? ""} onChange={(event) => setLearningCategoryIds((current) => ({ ...current, [transaction.id]: event.target.value }))} className="rounded-lg border px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950"><option value="">{t("chooseCategory")}</option>{categories.filter((item) => item.archivedAt === null).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button type="button" disabled={busy || !learningCategoryIds[transaction.id]} onClick={() => learnFromTransaction(transaction)} className="rounded-lg border px-2 py-1 text-xs font-semibold disabled:opacity-50 dark:border-slate-700">{t("learn")}</button></label>)}</div><div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={busy || selectedTransactionIds.length === 0} onClick={() => applyRules(true)} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50 dark:border-slate-700">{t("preview")}</button><button type="button" disabled={busy || selectedTransactionIds.length === 0 || preview.length === 0} onClick={() => applyRules(false)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{t("apply")}</button></div>{preview.length > 0 && <div className="mt-4 grid gap-2">{preview.map((item) => <p key={item.transactionId} className="rounded-xl border p-3 text-sm dark:border-slate-700">{item.explanation}</p>)}</div>}</section>
    <section className="grid gap-3">{rules.length === 0 ? <p className="rounded-2xl border border-dashed p-6 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">{t("empty")}</p> : rules.map((rule) => <article key={rule.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">{rule.name}</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t("explanation", { mode: rule.matchMode, text: rule.matchText, priority: rule.priority })}</p><p className="mt-1 text-xs text-slate-500">{rule.enabled ? t("enabled") : t("disabled")}</p></div><button onClick={() => toggleRule(rule)} className="rounded-lg border px-3 py-2 text-sm dark:border-slate-700">{rule.enabled ? t("disable") : t("enable")}</button></article>)}</section>
  </main>;
}
