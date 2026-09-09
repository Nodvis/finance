"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { AuthorizedHouseholdUserContext } from "@/lib/authorization/household";
import type { SerializedCategory } from "@/lib/categories/schema";
import type { SerializedCategorizationRule } from "@/lib/categorization-rules/schema";

export function RulesView({ householdContext, initialRules, categories }: { householdContext: AuthorizedHouseholdUserContext; initialRules: SerializedCategorizationRule[]; categories: SerializedCategory[] }) {
  const t = useTranslations("Rules");
  const router = useRouter();
  const [rules, setRules] = useState(initialRules);
  const [name, setName] = useState("");
  const [matchText, setMatchText] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [priority, setPriority] = useState("100");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
    <section className="grid gap-3">{rules.length === 0 ? <p className="rounded-2xl border border-dashed p-6 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">{t("empty")}</p> : rules.map((rule) => <article key={rule.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">{rule.name}</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t("explanation", { mode: rule.matchMode, text: rule.matchText, priority: rule.priority })}</p><p className="mt-1 text-xs text-slate-500">{rule.enabled ? t("enabled") : t("disabled")}</p></div><button onClick={() => toggleRule(rule)} className="rounded-lg border px-3 py-2 text-sm dark:border-slate-700">{rule.enabled ? t("disable") : t("enable")}</button></article>)}</section>
  </main>;
}
